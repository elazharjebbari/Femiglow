/**
 * Factory de defaults pour chaque Rule kind (M5.3.7).
 *
 * Quand l'admin clique "Ajouter un critère → Nombre de commandes", on
 * insère un Rule pré-rempli sensé. Centralisation pour éviter les
 * placeholders incohérents partout.
 */
import type { Rule, RuleKind, RulesGroup } from '@/lib/mail/audiences/rules-types';
import { TAGS_ENABLED } from '@/lib/mail/audiences/tags-flag';
import { countryLabel } from './countries';

const nf = new Intl.NumberFormat('fr-FR');

export type RuleMenuItem = {
  kind: RuleKind;
  label: string;
  /**
   * AUD-01 : item présent mais non sélectionnable. Tant que M5.5 (moteur de
   * tags) n'est pas livré, has_tag/not_has_tag compileraient des EXISTS sur
   * une table lead_tag quasi vide (drift uuid) : has_tag ciblerait ~0 contact
   * et not_has_tag TOUTE la base — sans aucun signal pour l'opératrice.
   */
  disabled?: boolean;
  disabledHint?: string;
};

export const RULE_CATEGORIES: { label: string; items: RuleMenuItem[] }[] = [
  {
    label: '🧍 Identité',
    items: [
      { kind: 'email_pattern', label: 'Email contient / commence / finit par' },
      { kind: 'country', label: 'Pays' },
      { kind: 'consent_marketing', label: 'Consent marketing' },
      { kind: 'created_at', label: "Date d'inscription" },
    ],
  },
  {
    label: '🛒 Commerce',
    items: [
      { kind: 'order_count', label: 'Nombre de commandes' },
      { kind: 'order_total', label: 'Total dépensé' },
      { kind: 'has_ordered_product', label: 'A commandé produit X' },
      { kind: 'last_order_at', label: 'Date dernière commande' },
    ],
  },
  {
    label: '✉ Engagement email',
    items: [
      { kind: 'email_opened', label: 'A ouvert un email' },
      { kind: 'email_clicked', label: 'A cliqué un lien' },
      { kind: 'received_without_open', label: 'A reçu sans ouvrir' },
    ],
  },
  {
    label: '📅 Activité',
    items: [
      { kind: 'inactive_since', label: 'Inactif depuis N jours' },
      { kind: 'session_count', label: 'Nombre de sessions' },
    ],
  },
  {
    label: '🏷 Tags',
    items: [
      {
        kind: 'has_tag',
        label: 'A le tag X',
        disabled: !TAGS_ENABLED,
        disabledHint: 'bientôt — M5.5',
      },
      {
        kind: 'not_has_tag',
        label: "N'a pas le tag X",
        disabled: !TAGS_ENABLED,
        disabledHint: 'bientôt — M5.5',
      },
    ],
  },
];

export function defaultRule(kind: RuleKind): Rule {
  switch (kind) {
    case 'email_pattern':
      return { kind: 'email_pattern', operator: 'contains', value: '' };
    case 'country':
      return { kind: 'country', operator: 'eq', value: 'MA' };
    case 'consent_marketing':
      return { kind: 'consent_marketing', value: true };
    case 'created_at':
      return { kind: 'created_at', operator: 'after', value: '2025-01-01' };
    case 'order_count':
      return { kind: 'order_count', operator: 'gte', value: 1 };
    case 'order_total':
      return { kind: 'order_total', operator: 'gte', value: 100000 };
    case 'has_ordered_product':
      return { kind: 'has_ordered_product', productId: '' };
    case 'last_order_at':
      return { kind: 'last_order_at', operator: 'within', value: '30d' };
    case 'email_opened':
      return { kind: 'email_opened', within: '30d' };
    case 'email_clicked':
      return { kind: 'email_clicked', within: '30d' };
    case 'received_without_open':
      return { kind: 'received_without_open', threshold: 3, within: '14d' };
    case 'inactive_since':
      return { kind: 'inactive_since', days: 30 };
    case 'session_count':
      return { kind: 'session_count', operator: 'gte', value: 3, within: '7d' };
    case 'has_tag':
      // Placeholder VALIDE vis-à-vis du Zod (tag min 1) — inutilisé tant que
      // le menu est grisé (AUD-01), mais defaultRule reste total/parseable.
      return { kind: 'has_tag', tag: 'vip' };
    case 'not_has_tag':
      return { kind: 'not_has_tag', tag: 'vip' };
  }
}

/** Renvoie le label humain d'un Rule kind (cohérent avec RULE_CATEGORIES). */
export function ruleLabel(kind: RuleKind): string {
  for (const cat of RULE_CATEGORIES) {
    const item = cat.items.find((i) => i.kind === kind);
    if (item) return item.label;
  }
  return kind;
}

// ── Conversion MAD ↔ centimes (UX-AUD-010) ────────────────────────────────
//
// Le compilateur compare `order_total` à SUM(orders.total_cents) → la value
// stockée est en CENTIMES. L'UI saisit en MAD (unité affichée). On centralise
// la conversion ici pour qu'elle soit testable et réutilisable.

/** MAD (saisie utilisateur) → centimes (stockage/compilateur). Arrondi entier. */
export function madToCents(mad: number): number {
  if (!Number.isFinite(mad)) return 0;
  return Math.round(mad * 100);
}

/** centimes (stockage) → MAD (affichage). Peut être décimal (ex. 50050 → 500.5). */
export function centsToMad(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

// ── Sérialisation règle → texte FR lisible (UX-AUD-014) ───────────────────
//
// Remplace le `<pre>{JSON.stringify(rules)}</pre>` de la page détail par un
// rendu en langage naturel : « Pays = Maroc ET ≥ 1 commande ». Un opérateur
// CRM non technique doit pouvoir relire son ciblage (kinds, cents, codes pays
// traduits). Best-effort : tout kind/operator non couvert retombe sur un
// libellé générique plutôt que de crasher.

const NUM_OP_FR: Record<string, string> = {
  gte: '≥',
  lte: '≤',
  gt: '>',
  lt: '<',
  eq: '=',
  between: 'entre',
};

const DATE_OP_FR: Record<string, string> = {
  after: 'après le',
  before: 'avant le',
  between: 'entre',
  within: 'dans les',
};

const STR_OP_FR: Record<string, string> = {
  contains: 'contient',
  starts: 'commence par',
  ends: 'finit par',
  equals: 'égal à',
  in: 'parmi',
};

function numPhrase(operator: string, value: number | [number, number], opts: { mad?: boolean } = {}): string {
  const fmt = (n: number) =>
    opts.mad ? `${nf.format(centsToMad(n))} MAD` : nf.format(n);
  if (operator === 'between' && Array.isArray(value)) {
    return `entre ${fmt(value[0])} et ${fmt(value[1])}`;
  }
  const v = Array.isArray(value) ? value[0] : value;
  return `${NUM_OP_FR[operator] ?? operator} ${fmt(v)}`;
}

function datePhrase(operator: string, value: string | [string, string]): string {
  if (operator === 'between' && Array.isArray(value)) {
    return `entre le ${value[0]} et le ${value[1]}`;
  }
  const v = Array.isArray(value) ? value[0] : value;
  return `${DATE_OP_FR[operator] ?? operator} ${v}`;
}

/** Décrit une Rule unique en français lisible. */
export function ruleToText(rule: Rule): string {
  switch (rule.kind) {
    case 'email_pattern':
      return `Email ${STR_OP_FR[rule.operator] ?? rule.operator} « ${
        Array.isArray(rule.value) ? rule.value.join(', ') : rule.value
      } »`;
    case 'country': {
      const codes = Array.isArray(rule.value) ? rule.value : [rule.value];
      const names = codes.map((c) => countryLabel(c)).join(', ');
      return rule.operator === 'in' ? `Pays parmi ${names}` : `Pays = ${names}`;
    }
    case 'consent_marketing':
      return `Consentement marketing ${rule.value ? 'accepté' : 'refusé'}`;
    case 'created_at':
      return `Inscrit ${datePhrase(rule.operator, rule.value)}`;
    case 'order_count':
      return `Nombre de commandes ${numPhrase(rule.operator, rule.value)}${
        rule.since ? ` depuis le ${rule.since}` : ''
      }${rule.until ? ` jusqu'au ${rule.until}` : ''}`;
    case 'order_total':
      return `Total dépensé ${numPhrase(rule.operator, rule.value, { mad: true })}${
        rule.since ? ` depuis le ${rule.since}` : ''
      }`;
    case 'has_ordered_product':
      return `A commandé le produit « ${rule.productId} »${
        rule.since ? ` depuis le ${rule.since}` : ''
      }`;
    case 'last_order_at':
      return `Dernière commande ${datePhrase(rule.operator, rule.value)}`;
    case 'email_opened':
      return `A ouvert un email${rule.templateSlug ? ` (modèle « ${rule.templateSlug} »)` : ''}${
        rule.within ? ` dans les ${rule.within}` : ''
      }${rule.minCount ? ` au moins ${rule.minCount} fois` : ''}`;
    case 'email_clicked':
      return `A cliqué un lien${rule.urlPattern ? ` vers « ${rule.urlPattern} »` : ''}${
        rule.within ? ` dans les ${rule.within}` : ''
      }${rule.minCount ? ` au moins ${rule.minCount} fois` : ''}`;
    case 'received_without_open':
      return `A reçu ≥ ${rule.threshold} emails sans en ouvrir aucun dans les ${rule.within}`;
    case 'inactive_since':
      return `Inactif depuis ${rule.days} jours`;
    case 'session_count':
      return `Nombre de sessions ${numPhrase(rule.operator, rule.value)}${
        rule.within ? ` dans les ${rule.within}` : ''
      }`;
    case 'has_tag':
      return `A le tag « ${rule.tag} »`;
    case 'not_has_tag':
      return `N'a pas le tag « ${rule.tag} »`;
    default:
      return ruleLabel((rule as Rule).kind);
  }
}

/** Aplatit un RulesGroup en lignes lisibles FR (récursif, indentation par niveau). */
export type RuleTextLine = { depth: number; combinator: 'all' | 'any' | null; text: string };

export function rulesGroupToLines(group: RulesGroup, depth = 0): RuleTextLine[] {
  const lines: RuleTextLine[] = [];
  const combinatorLabel = group.kind === 'all' ? 'TOUS les critères' : 'AU MOINS UN critère';
  lines.push({ depth, combinator: group.kind, text: combinatorLabel });
  for (const cond of group.conditions) {
    if ('conditions' in cond && Array.isArray(cond.conditions)) {
      lines.push(...rulesGroupToLines(cond as RulesGroup, depth + 1));
    } else {
      lines.push({ depth: depth + 1, combinator: null, text: ruleToText(cond as Rule) });
    }
  }
  return lines;
}
