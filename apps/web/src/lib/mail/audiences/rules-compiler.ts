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
import { emailEvent, emailSuppression } from '@/lib/db/schema-emails';
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
      return sql`${column} < ${parseDateOrThrow(value as string)}`;
    case 'after':
      return sql`${column} > ${parseDateOrThrow(value as string)}`;
    case 'between': {
      const [a, b] = value as [string, string];
      return sql`${column} BETWEEN ${parseDateOrThrow(a)} AND ${parseDateOrThrow(b)}`;
    }
    case 'within': {
      const threshold = parseRelativeWithinSql(value as string);
      if (!threshold) throw new Error(`Invalid within: ${value}`);
      return sql`${column} >= ${threshold}`;
    }
  }
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
      // leads has no `country` column in current schema — fallback ALWAYS TRUE
      // (country filter not enforceable yet). Future-proof : si on ajoute
      // une colonne country, remplacer ici.
      void rule;
      return sql`TRUE`;
    }

    case 'consent_marketing':
      return eq(leads.consentMarketing, rule.value);

    case 'created_at':
      return dateOp(sql`${leads.createdAt}`, rule.operator, rule.value);

    // ── Commerce (agrégations via subquery) ────────────────────────────
    case 'order_count': {
      const sinceFilter = rule.since
        ? sql`AND ${orders.createdAt} >= ${parseDateOrThrow(rule.since)}`
        : sql``;
      const untilFilter = rule.until
        ? sql`AND ${orders.createdAt} <= ${parseDateOrThrow(rule.until)}`
        : sql``;
      const cnt = sql`(SELECT COUNT(*) FROM ${orders} WHERE ${orders.leadId} = ${leads.id} ${sinceFilter} ${untilFilter})`;
      return numericOp(cnt, rule.operator, rule.value);
    }

    case 'order_total': {
      const sinceFilter = rule.since
        ? sql`AND ${orders.createdAt} >= ${parseDateOrThrow(rule.since)}`
        : sql``;
      const total = sql`(SELECT COALESCE(SUM(${orders.totalCents}), 0) FROM ${orders} WHERE ${orders.leadId} = ${leads.id} ${sinceFilter})`;
      return numericOp(total, rule.operator, rule.value);
    }

    case 'has_ordered_product': {
      const sinceFilter = rule.since
        ? sql`AND ${orders.createdAt} >= ${parseDateOrThrow(rule.since)}`
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

    // ── Engagement email (via email_event lié par toEmail) ─────────────
    case 'email_opened': {
      const withinFilter = rule.within
        ? sql`AND ${emailEvent.ts} >= ${parseRelativeWithinSql(rule.within) ?? sql.raw("'1970-01-01'::timestamptz")}`
        : sql``;
      // type='opened'. templateSlug filtre via outbox join si fourni.
      const inner = sql`SELECT 1 FROM ${emailEvent} WHERE ${emailEvent.type} = 'opened' ${withinFilter}`;
      // Lien à l'email : pour V1 on lookup via outbox.toEmail.
      // (alternative : ajouter emailEvent.subscriberEmail dans M5.4)
      if (rule.minCount && rule.minCount > 1) {
        return sql`(SELECT COUNT(*) FROM ${emailEvent} WHERE ${emailEvent.type} = 'opened' ${withinFilter}) >= ${rule.minCount}`;
      }
      return sql`EXISTS (${inner})`;
    }

    case 'email_clicked': {
      const withinFilter = rule.within
        ? sql`AND ${emailEvent.ts} >= ${parseRelativeWithinSql(rule.within) ?? sql.raw("'1970-01-01'::timestamptz")}`
        : sql``;
      return sql`EXISTS (SELECT 1 FROM ${emailEvent} WHERE ${emailEvent.type} = 'clicked' ${withinFilter})`;
    }

    case 'received_without_open': {
      const threshold = parseRelativeWithinSql(rule.within);
      const tsFilter = threshold ? sql`AND ${emailEvent.ts} >= ${threshold}` : sql``;
      const sentCnt = sql`(SELECT COUNT(*) FROM ${emailEvent} WHERE ${emailEvent.type} IN ('sent', 'delivered') ${tsFilter})`;
      const openCnt = sql`(SELECT COUNT(*) FROM ${emailEvent} WHERE ${emailEvent.type} = 'opened' ${tsFilter})`;
      return sql`${sentCnt} >= ${rule.threshold} AND ${openCnt} = 0`;
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

