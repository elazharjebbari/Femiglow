/**
 * Chemins canoniques du dataLayer (= valeur de la clé `name` des Data Layer
 * Variables GTM), **alignés sur `DataLayerEntry`** (`datalayer.ts`).
 *
 * Source unique de vérité partagée par l'exporter GTM (`plan/exporter.ts`).
 * Évite la classe de bug T-01 (audit 2026-05-31) : les variables de conversion
 * lisaient `ecommerce.value` alors que la valeur vit sous `params.value` — le
 * bloc `ecommerce` n'est JAMAIS poussé. Résultat : `conversionValue`/
 * `currencyCode`/`orderId` `undefined` → ROAS Google faux + conversions
 * dupliquées (pas d'`orderId` pour la dédup).
 *
 * Un test contractuel (`datalayer-paths.contract.test.ts`) vérifie que chaque
 * chemin résout bien sur une entry réellement produite par `TrackingClient.emit`.
 */
export const DATALAYER_PATHS = {
  /** Top-level — `DataLayerEntry.event_id`. */
  eventId: 'event_id',
  /** Valeur monétaire — `DataLayerEntry.params.value`. */
  value: 'params.value',
  /** Devise ISO-4217 — `DataLayerEntry.params.currency`. */
  currency: 'params.currency',
  /** Identifiant de transaction (dédup conversions) — `params.transaction_id`. */
  transactionId: 'params.transaction_id',
  /** Lignes produit (GA4 items / Meta contents) — `params.items`. */
  items: 'params.items',
  /** Canal d'attribution (gating) — `DataLayerEntry.attribution.channel`. */
  attributionChannel: 'attribution.channel',
} as const;

export type DataLayerPathKey = keyof typeof DATALAYER_PATHS;
