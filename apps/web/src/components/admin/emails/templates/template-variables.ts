/**
 * Catalogue des variables disponibles dans l'éditeur de template custom
 * (F07 P3.4-c, Lot 2, assistance G11) — PUR.
 *
 * Ces variables sont celles RÉELLEMENT résolues par `buildEmailContext`
 * (context-resolver.ts) du moteur de templates custom (Handlebars, syntaxe
 * `{{cle}}` SANS point — à ne pas confondre avec les merge-tags Listmonk des
 * campagnes `{{ .Subscriber.x }}`).
 *
 * HONNÊTETÉ : on n'expose QUE des clés qui résolvent. L'ancien panneau proposait
 * `{{lastName}}` et `{{orderTotal}}` — INEXISTANTES côté resolver (rendu vide) ;
 * elles sont retirées. `city`/`address` (colonnes absentes des leads, toujours
 * vides) sont retirées du resolver dans le même lot.
 */

export type TemplateVarGroup = 'Identité' | 'Commerce' | 'Date' | 'Liens';

export type TemplateVar = {
  /** Clé telle que résolue par buildEmailContext. */
  key: string;
  /** Jeton inséré (Handlebars). */
  token: string;
  label: string;
  group: TemplateVarGroup;
};

export const TEMPLATE_VARIABLE_GROUPS: readonly TemplateVarGroup[] = [
  'Identité',
  'Commerce',
  'Date',
  'Liens',
] as const;

export const TEMPLATE_VARIABLES: readonly TemplateVar[] = [
  // Identité
  { key: 'firstName', token: '{{firstName}}', label: 'Prénom', group: 'Identité' },
  { key: 'fullName', token: '{{fullName}}', label: 'Nom complet', group: 'Identité' },
  { key: 'email', token: '{{email}}', label: 'E-mail', group: 'Identité' },
  { key: 'phone', token: '{{phone}}', label: 'Téléphone', group: 'Identité' },
  { key: 'country', token: '{{country}}', label: 'Pays', group: 'Identité' },
  { key: 'language', token: '{{language}}', label: 'Langue', group: 'Identité' },
  // Commerce
  { key: 'lastOrderId', token: '{{lastOrderId}}', label: 'N° dernière commande', group: 'Commerce' },
  { key: 'lastOrderDate', token: '{{lastOrderDate}}', label: 'Date dernière commande', group: 'Commerce' },
  { key: 'lastOrderTotal', token: '{{lastOrderTotal}}', label: 'Montant dernière commande', group: 'Commerce' },
  { key: 'orderCount', token: '{{orderCount}}', label: 'Nombre de commandes', group: 'Commerce' },
  { key: 'totalSpent', token: '{{totalSpent}}', label: 'Total dépensé', group: 'Commerce' },
  // Date
  { key: 'today', token: '{{today}}', label: "Aujourd'hui", group: 'Date' },
  { key: 'tomorrow', token: '{{tomorrow}}', label: 'Demain', group: 'Date' },
  { key: 'dayOfWeek', token: '{{dayOfWeek}}', label: 'Jour de la semaine', group: 'Date' },
  { key: 'currentMonth', token: '{{currentMonth}}', label: 'Mois courant', group: 'Date' },
  { key: 'currentYear', token: '{{currentYear}}', label: 'Année courante', group: 'Date' },
  // Liens
  { key: 'unsubscribeUrl', token: '{{unsubscribeUrl}}', label: 'Lien de désabonnement', group: 'Liens' },
  { key: 'shopUrl', token: '{{shopUrl}}', label: 'Lien boutique', group: 'Liens' },
  { key: 'accountUrl', token: '{{accountUrl}}', label: 'Lien compte', group: 'Liens' },
  { key: 'siteUrl', token: '{{siteUrl}}', label: 'Lien site', group: 'Liens' },
] as const;

/** Toutes les clés du catalogue (pour validation / autocomplete). */
export const TEMPLATE_VARIABLE_KEYS: readonly string[] = TEMPLATE_VARIABLES.map((v) => v.key);

/** Variables d'un groupe donné (rendu du panneau). */
export function variablesOfGroup(group: TemplateVarGroup): TemplateVar[] {
  return TEMPLATE_VARIABLES.filter((v) => v.group === group);
}
