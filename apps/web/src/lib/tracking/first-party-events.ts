/**
 * Événements strictement first-party : ingérés par `/api/track` et stockés
 * dans `tracking_events_log`, mais JAMAIS relayés aux plateformes publicitaires
 * ou analytiques tierces (Meta CAPI, TikTok, Google Ads/GA4, GTM serveur…).
 *
 * `web_vitals` (Kit CRO v2 §1) : mesures de performance réelles (RUM). Elles
 * n'ont aucun sens pour l'optimisation publicitaire et gonfleraient les quotas
 * et la qualité d'événements côté Meta. Le client les envoie aussi hors
 * `dataLayer` (aucun tag GTM ne les voit).
 *
 * `kit_checkout_exposure` (Kit CRO v2 §2) : exposition au test A/B du
 * formulaire « Commander » (une fois par page vue). Émis par le pipeline
 * client normal (`TrackingClient.emit` → lot `/api/track`), qui NE le pousse
 * PAS dans le `dataLayer` pour un événement de cette liste (aucun tag GTM ni
 * pixel client ne le voit) ; côté serveur, le dispatch providers l'ignore.
 */
export const FIRST_PARTY_ONLY_EVENTS: ReadonlySet<string> = new Set([
  'web_vitals',
  'kit_checkout_exposure',
]);

export function isFirstPartyOnlyEvent(eventName: string): boolean {
  return FIRST_PARTY_ONLY_EVENTS.has(eventName);
}
