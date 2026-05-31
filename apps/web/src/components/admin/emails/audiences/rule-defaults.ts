/**
 * Factory de defaults pour chaque Rule kind (M5.3.7).
 *
 * Quand l'admin clique "Ajouter un critère → Nombre de commandes", on
 * insère un Rule pré-rempli sensé. Centralisation pour éviter les
 * placeholders incohérents partout.
 */
import type { Rule, RuleKind } from '@/lib/mail/audiences/rules-types';

export const RULE_CATEGORIES: { label: string; items: { kind: RuleKind; label: string }[] }[] = [
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
      { kind: 'has_tag', label: 'A le tag X' },
      { kind: 'not_has_tag', label: "N'a pas le tag X" },
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
      return { kind: 'has_tag', tag: '' };
    case 'not_has_tag':
      return { kind: 'not_has_tag', tag: '' };
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
