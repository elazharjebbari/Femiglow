/**
 * Événements strictement first-party : ingérés par `/api/track` et stockés
 * dans `tracking_events_log`, mais JAMAIS relayés aux plateformes publicitaires
 * ou analytiques tierces (Meta CAPI, TikTok, Google Ads/GA4, GTM serveur…).
 *
 * `web_vitals` (Kit CRO v2 §1) : mesures de performance réelles (RUM). Elles
 * n'ont aucun sens pour l'optimisation publicitaire et gonfleraient les quotas
 * et la qualité d'événements côté Meta. Le client les envoie aussi hors
 * `dataLayer` (aucun tag GTM ne les voit).
 */
export const FIRST_PARTY_ONLY_EVENTS: ReadonlySet<string> = new Set(['web_vitals']);

export function isFirstPartyOnlyEvent(eventName: string): boolean {
  return FIRST_PARTY_ONLY_EVENTS.has(eventName);
}
