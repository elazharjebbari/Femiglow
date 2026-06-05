/**
 * Rules compiler — RulesGroup/Rule → Drizzle SQL (M5.3.1-2-3).
 *
 * Le compilateur transforme un RulesJson en fragments SQL composables :
 *   compileRulesToSql(rules, exclusions) → { where: SQL, joins?: SQL[] }
 *
 * Le `where` est utilisable dans `.where(...)` d'un SELECT sur `leads`.
 * Les `joins` (si nécessaires) sont ajoutés au SELECT en amont.
 *
 * Sécurité :
 *  - Aucune string-concat (paramétrisation Drizzle native).
 *  - DoS protection : validateDepth() avant compilation.
 *  - Validation : tous les inputs passent par Zod (caller responsibility,
 *    le compileur trust son input typé Rule).
 *
 * Cf. docs/emailing/admin-evolution/02-backend/03-rules-compiler.md
 *    docs/emailing/admin-evolution/00-architecture/05-adr.md ADR-004
 */
import 'server-only';
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { leads, userEvent, orders, leadTag } from '@/lib/db/schema';
import {
  emailEvent,
  emailOutbox,
  emailSubscriberLink,
  emailSuppression,
} from '@/lib/db/schema-emails';
import {
  validateDepth,
  type ExclusionFlags,
  type Rule,
  type RulesGroup,
} from './rules-types';

// lead_tag (M5.5) pas encore livré : has_tag / not_has_tag retournent
// respectivement FALSE / TRUE — fallback safe. Quand M5.5 mergeera la
// table lead_tag, on remplacera ces fallbacks par les vraies subqueries
// EXISTS. Branche M5.3 standalone n'utilise pas de tags pour ses V1.

// ── Country → indicatif (R-011) ───────────────────────────────────────────
//
// `leads` n'a pas de colonne `country`. Le seul signal de pays disponible est
// l'indicatif E.164 du numéro stocké dans `leads.phone` (`+212…`, `+33…`).
// On dérive donc le pays du préfixe d'appel, en réutilisant la convention de
// `src/lib/phone.ts` (table `COUNTRIES`). Sans cette table, la règle `country`
// retournait `TRUE` → ciblage hors périmètre = envoi de masse hors cible
// (écart A-AUD-1). Le mapping ci-dessous couvre les pays de l'autocomplete
// admin (CountryAutocomplete) + les marchés diaspora de phone.ts.
//
// Un code pays inconnu → aucun match (FALSE) : on ne peut pas filtrer dessus,
// et il vaut mieux ne cibler personne que toute la base.
const COUNTRY_CALLING_CODE: Record<string, string> = {
  MA: '212',
  FR: '33',
  DZ: '213',
  TN: '216',
  BE: '32',
  CH: '41',
  CA: '1',
  US: '1',
  GB: '44',
  DE: '49',
  IT: '39',
  ES: '34',
  PT: '351',
  NL: '31',
  LU: '352',
  SN: '221',
  CI: '225',
  CM: '237',
  EG: '20',
  AE: '971',
  SA: '966',
};

/**
 * Construit le prédicat SQL `country` sur `leads.phone` (E.164).
 *
 * - `eq 'MA'`     → `leads.phone LIKE '+212%'`
 * - `in [..]`     → OR des préfixes correspondants
 * - code inconnu  → ignoré (n'élargit jamais l'ensemble)
 * - aucun code valide → `FALSE` (ne cible personne plutôt que tout le monde)
 *
 * La valeur passe par un paramètre Drizzle (`${prefix}`) — pas de concat de
 * l'opérande : seul le préfixe d'appel (issu de la table interne, jamais de
 * l'input brut) est interpolé, et la valeur LIKE est bindée.
 */
function compileCountry(
  operator: 'eq' | 'in',
  value: string | string[],
): SQL {
  const codes = (Array.isArray(value) ? value : [value])
    .map((c) => String(c).trim().toUpperCase())
    .filter((c) => c.length > 0);
  void operator; // eq et in se compilent de la même façon (OR sur les préfixes)

  const prefixes = Array.from(
    new Set(
      codes
        .map((c) => COUNTRY_CALLING_CODE[c])
        .filter((cc): cc is string => Boolean(cc)),
    ),
  );

  if (prefixes.length === 0) {
    // Code(s) pays inconnu(s) ou liste vide → ne cible personne.
    return sql`FALSE`;
  }

  const likeFragments = prefixes.map(
    (cc) => sql`${leads.phone} LIKE ${'+' + cc + '%'}`,
  );
  return likeFragments.length === 1
    ? likeFragments[0]!
    : (or(...likeFragments) as SQL);
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convertit un `within` (ex. "30d", "12h", ou ISO date) en expression SQL.
 *
 * Retour : un fragment SQL prêt à être interpolé via le tag `sql`. Le format
 * Date JS produit `Tue Apr 14 2026 ...` quand drizzle bind un Date sans type
 * column → Postgres rejette le format. On force donc une expression
 * `now() - interval '...'` ou un `timestamptz` ISO littéral.
 */
function parseRelativeWithinSql(within: string | undefined): SQL | null {
  if (!within) return null;
  const m = /^(\d+)([smhd])$/i.exec(within.trim());
  if (m) {
    const n = Number(m[1]);
    const unit = m[2]!.toLowerCase();
    const interval =
      unit === 's' ? `${n} seconds` :
      unit === 'm' ? `${n} minutes` :
      unit === 'h' ? `${n} hours` :
      `${n} days`;
    return sql.raw(`(now() - interval '${interval}')`);
  }
  // Fallback ISO timestamp literal.
  const d = new Date(within);
  if (!Number.isFinite(d.getTime())) return null;
  return sql.raw(`('${d.toISOString()}'::timestamptz)`);
}

// `parseRelativeWithin` removed — the Date-returning version produced
// bad parameter bindings ("Tue Apr 14 2026 ..." instead of ISO format).
// Use `parseRelativeWithinSql` everywhere (returns a SQL fragment).

function parseDateOrThrow(value: string): Date {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return d;
}

/**
 * Valide une date et renvoie un fragment SQL `'<ISO>'::timestamptz`.
 *
 * POURQUOI un fragment et pas un bind `${date}` ? — Binder un objet `Date` JS
 * cru dans un template `sql` postgres-js lève `ERR_INVALID_ARG_TYPE` (le driver
 * attend une string/Buffer). C'est le piège §8 du harnais : « Date JS dans un
 * template sql postgres-js → ${d.toISOString()}::timestamptz ». On normalise
 * donc en ISO + cast explicite. L'ISO provient de `Date.toISOString()` (jamais
 * de l'input brut), donc aucune injection possible via ce chemin.
 */
function dateLiteralSql(value: string): SQL {
  const d = parseDateOrThrow(value);
  return sql.raw(`('${d.toISOString()}'::timestamptz)`);
}

// ── Operator → SQL builder ───────────────────────────────────────────────

function numericOp(
  column: ReturnType<typeof sql>,
  operator: 'gte' | 'lte' | 'eq' | 'gt' | 'lt' | 'between',
  value: number | [number, number],
): SQL {
  switch (operator) {
    case 'gte':
      return sql`${column} >= ${value}`;
    case 'lte':
      return sql`${column} <= ${value}`;
    case 'gt':
      return sql`${column} > ${value}`;
    case 'lt':
      return sql`${column} < ${value}`;
    case 'eq':
      return sql`${column} = ${value}`;
    case 'between': {
      const [lo, hi] = value as [number, number];
      return sql`${column} BETWEEN ${lo} AND ${hi}`;
    }
  }
}

function dateOp(
  column: ReturnType<typeof sql>,
  operator: 'before' | 'after' | 'between' | 'within',
  value: string | [string, string],
): SQL {
  switch (operator) {
    case 'before':
      return sql`${column} < ${dateLiteralSql(value as string)}`;
    case 'after':
      return sql`${column} > ${dateLiteralSql(value as string)}`;
    case 'between': {
      const [a, b] = value as [string, string];
      return sql`${column} BETWEEN ${dateLiteralSql(a)} AND ${dateLiteralSql(b)}`;
    }
    case 'within': {
      const threshold = parseRelativeWithinSql(value as string);
      if (!threshold) throw new Error(`Invalid within: ${value}`);
      return sql`${column} >= ${threshold}`;
    }
  }
}

// ── Engagement email — corrélation évènement ↔ lead (fix A-AUD-2) ─────────
//
// `email_event` ne porte PAS l'adresse du destinataire. La corrélation passe
// par deux chemins, selon la provenance de l'évènement :
//   (a) transactionnel (Stalwart) : event.outbox_id → email_outbox.to_email ;
//   (b) campagne (Listmonk)       : event.subscriber_id (text) →
//       email_subscriber_link.listmonk_subscriber_id, lié par email.
// AVANT ce fix, le sous-SELECT était GLOBAL (aucune corrélation au lead) :
// un seul `opened` n'importe où dans la base faisait matcher TOUTE l'audience
// (tout-ou-rien — écart A-AUD-2, prouvé par AUD-CMP-023/025 version bug).
//
// `templateSlug` (email_opened) ne s'applique qu'au volet transactionnel —
// `template` vit sur email_outbox ; les évènements campagne sont alors exclus.
function correlatedEmailEventBody(
  types: readonly ('sent' | 'delivered' | 'opened' | 'clicked')[],
  opts: { within?: string; templateSlug?: string; urlPattern?: string },
): SQL {
  // `types` est une constante interne (jamais un input utilisateur) → littéral.
  const typeCond =
    types.length === 1
      ? sql`${emailEvent.type} = ${sql.raw(`'${types[0]}'`)}`
      : sql`${emailEvent.type} IN (${sql.raw(types.map((t) => `'${t}'`).join(', '))})`;
  const withinFilter = opts.within
    ? sql`AND ${emailEvent.ts} >= ${parseRelativeWithinSql(opts.within) ?? sql.raw("'1970-01-01'::timestamptz")}`
    : sql``;
  // urlPattern = substring (échappement ILIKE, même convention que
  // email_pattern contains) — bindé, pas concaténé.
  const urlFilter = opts.urlPattern
    ? sql`AND ${emailEvent.linkUrl} ILIKE ${'%' + opts.urlPattern.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'}`
    : sql``;
  const templateFilter = opts.templateSlug
    ? sql`AND ${emailOutbox.template} = ${opts.templateSlug}`
    : sql``;

  const outboxBranch = sql`(${emailEvent.outboxId} IS NOT NULL AND EXISTS (
    SELECT 1 FROM ${emailOutbox}
    WHERE ${emailOutbox.id} = ${emailEvent.outboxId}
      AND lower(${emailOutbox.toEmail}) = lower(${leads.email})
      ${templateFilter}
  ))`;
  const subscriberBranch = sql`(${emailEvent.subscriberId} IS NOT NULL AND EXISTS (
    SELECT 1 FROM ${emailSubscriberLink}
    WHERE ${emailSubscriberLink.listmonkSubscriberId} IS NOT NULL
      AND ${emailSubscriberLink.listmonkSubscriberId}::text = ${emailEvent.subscriberId}
      AND lower(${emailSubscriberLink.email}) = lower(${leads.email})
  ))`;
  const correlation = opts.templateSlug
    ? outboxBranch
    : sql`(${outboxBranch} OR ${subscriberBranch})`;

  return sql`FROM ${emailEvent}
    WHERE ${typeCond}
      ${withinFilter}
      ${urlFilter}
      AND ${correlation}`;
}

// ── Compile a single Rule → SQL ──────────────────────────────────────────

function compileRule(rule: Rule): SQL {
  switch (rule.kind) {
    // ── Identité ───────────────────────────────────────────────────────
    case 'email_pattern': {
      const op = rule.operator;
      if (op === 'equals') {
        return eq(leads.email, rule.value as string);
      }
      if (op === 'in') {
        const arr = Array.isArray(rule.value) ? rule.value : [rule.value];
        return inArray(leads.email, arr);
      }
      // contains / starts / ends → ILIKE
      const v = (rule.value as string).replace(/%/g, '\\%').replace(/_/g, '\\_');
      const pattern = op === 'contains' ? `%${v}%` : op === 'starts' ? `${v}%` : `%${v}`;
      return sql`${leads.email} ILIKE ${pattern}`;
    }

    case 'country': {
      // R-011 — dérive le pays du préfixe E.164 de `leads.phone` (pas de
      // colonne `country` dans le schéma). Voir `compileCountry`.
      return compileCountry(rule.operator, rule.value);
    }

    case 'consent_marketing':
      return eq(leads.consentMarketing, rule.value);

    case 'created_at':
      return dateOp(sql`${leads.createdAt}`, rule.operator, rule.value);

    // ── Commerce (agrégations via subquery) ────────────────────────────
    case 'order_count': {
      const sinceFilter = rule.since
        ? sql`AND ${orders.createdAt} >= ${dateLiteralSql(rule.since)}`
        : sql``;
      const untilFilter = rule.until
        ? sql`AND ${orders.createdAt} <= ${dateLiteralSql(rule.until)}`
        : sql``;
      const cnt = sql`(SELECT COUNT(*) FROM ${orders} WHERE ${orders.leadId} = ${leads.id} ${sinceFilter} ${untilFilter})`;
      return numericOp(cnt, rule.operator, rule.value);
    }

    case 'order_total': {
      const sinceFilter = rule.since
        ? sql`AND ${orders.createdAt} >= ${dateLiteralSql(rule.since)}`
        : sql``;
      const total = sql`(SELECT COALESCE(SUM(${orders.totalCents}), 0) FROM ${orders} WHERE ${orders.leadId} = ${leads.id} ${sinceFilter})`;
      return numericOp(total, rule.operator, rule.value);
    }

    case 'has_ordered_product': {
      const sinceFilter = rule.since
        ? sql`AND ${orders.createdAt} >= ${dateLiteralSql(rule.since)}`
        : sql``;
      // orders.formContext or items table — for simplicity we use a
      // generic EXISTS on orders joined to order_items by sku.
      return sql`EXISTS (
        SELECT 1 FROM ${orders}
        WHERE ${orders.leadId} = ${leads.id}
          AND ${orders.formId} = ${rule.productId}
          ${sinceFilter}
      )`;
    }

    case 'last_order_at': {
      const lastOrder = sql`(SELECT MAX(${orders.createdAt}) FROM ${orders} WHERE ${orders.leadId} = ${leads.id})`;
      return dateOp(lastOrder, rule.operator, rule.value);
    }

    // ── Engagement email (corrélé au lead — fix A-AUD-2) ───────────────
    case 'email_opened': {
      const body = correlatedEmailEventBody(['opened'], {
        within: rule.within,
        templateSlug: rule.templateSlug,
      });
      if (rule.minCount && rule.minCount > 1) {
        return sql`(SELECT COUNT(*) ${body}) >= ${rule.minCount}`;
      }
      return sql`EXISTS (SELECT 1 ${body})`;
    }

    case 'email_clicked': {
      const body = correlatedEmailEventBody(['clicked'], {
        within: rule.within,
        urlPattern: rule.urlPattern,
      });
      if (rule.minCount && rule.minCount > 1) {
        return sql`(SELECT COUNT(*) ${body}) >= ${rule.minCount}`;
      }
      return sql`EXISTS (SELECT 1 ${body})`;
    }

    case 'received_without_open': {
      // Corrélé par lead : ≥ threshold envois reçus, 0 ouverture — pour CE lead.
      const sentBody = correlatedEmailEventBody(['sent', 'delivered'], {
        within: rule.within,
      });
      const openBody = correlatedEmailEventBody(['opened'], { within: rule.within });
      return sql`(SELECT COUNT(*) ${sentBody}) >= ${rule.threshold}
        AND (SELECT COUNT(*) ${openBody}) = 0`;
    }

    // ── Activité (user_event) ──────────────────────────────────────────
    case 'inactive_since': {
      const threshold = sql`now() - interval '${sql.raw(String(rule.days))} days'`;
      return sql`NOT EXISTS (
        SELECT 1 FROM ${userEvent}
        WHERE ${userEvent.email} = ${leads.email}
          AND ${userEvent.ts} >= ${threshold}
      )`;
    }

    case 'session_count': {
      const withinFilter = rule.within
        ? sql`AND ${userEvent.ts} >= ${parseRelativeWithinSql(rule.within) ?? sql.raw("'1970-01-01'::timestamptz")}`
        : sql``;
      const cnt = sql`(
        SELECT COUNT(DISTINCT ${userEvent.sessionId})
        FROM ${userEvent}
        WHERE ${userEvent.email} = ${leads.email}
          AND ${userEvent.sessionId} IS NOT NULL
          ${withinFilter}
      )`;
      return numericOp(cnt, rule.operator, rule.value);
    }

    // ── Tags (lead_tag, M5.5) ─────────────────────────────────────────
    case 'has_tag':
      return sql`EXISTS (
        SELECT 1 FROM ${leadTag}
        WHERE ${leadTag.leadId} = ${leads.id}
          AND ${leadTag.tag} = ${rule.tag}
      )`;

    case 'not_has_tag':
      return sql`NOT EXISTS (
        SELECT 1 FROM ${leadTag}
        WHERE ${leadTag.leadId} = ${leads.id}
          AND ${leadTag.tag} = ${rule.tag}
      )`;
  }
}

// ── Compile a RulesGroup recursively ─────────────────────────────────────

function compileGroup(group: RulesGroup): SQL {
  if (group.conditions.length === 0) {
    // Empty `all` group matches everything ; empty `any` group matches nothing.
    return group.kind === 'all' ? sql`TRUE` : sql`FALSE`;
  }
  const fragments: SQL[] = group.conditions.map((c) =>
    'conditions' in c && Array.isArray(c.conditions) ? compileGroup(c as RulesGroup) : compileRule(c as Rule),
  );
  return group.kind === 'all' ? (and(...fragments) as SQL) : (or(...fragments) as SQL);
}

// ── Apply exclusions ─────────────────────────────────────────────────────

function applyExclusions(base: SQL, flags: ExclusionFlags): SQL {
  const reasons: string[] = [];
  if (flags.hard_bounce) reasons.push('hard_bounce');
  if (flags.unsubscribe) reasons.push('unsubscribe');
  if (flags.manual_suppression) reasons.push('manual_admin');

  let result: SQL = base;
  if (reasons.length > 0) {
    const notSuppressed = sql`${leads.email} NOT IN (
      SELECT ${emailSuppression.email} FROM ${emailSuppression}
      WHERE ${emailSuppression.reason}::text IN (${sql.join(reasons.map((r) => sql`${r}`), sql`, `)})
    )`;
    result = and(result, notSuppressed) as SQL;
  }
  if (flags.marketing_optout) {
    result = and(result, eq(leads.consentMarketing, true)) as SQL;
  }
  return result;
}

// ── Public API ───────────────────────────────────────────────────────────

export type CompileResult = {
  where: SQL;
};

/**
 * Compile un RulesGroup en SQL prêt à être appliqué via `.where()` sur
 * un `SELECT FROM leads`.
 *
 * @throws Error si depth > 4 ou date invalide
 */
export function compileRulesToSql(
  rules: RulesGroup,
  exclusions: ExclusionFlags,
): CompileResult {
  validateDepth(rules);
  const baseWhere = compileGroup(rules);
  const withExclusions = applyExclusions(baseWhere, exclusions);
  return { where: withExclusions };
}

// Re-export pour pratique (test imports)
export { compileGroup, compileRule, applyExclusions };

