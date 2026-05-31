/**
 * Catalogue des événements de tracking du composant « Rituels partagés ».
 * Cf. docs/reviews-wall/16-tracking-analytics.md
 */

export type RitualEventName =
  | 'ritual_module_view'
  | 'ritual_module_card_impression'
  | 'ritual_module_card_click'
  | 'ritual_module_link_click'
  | 'ritual_wall_open'
  | 'ritual_wall_close'
  | 'ritual_wall_filter_change'
  | 'ritual_wall_card_impression'
  | 'ritual_wall_photo_open'
  | 'ritual_wall_load_more'
  | 'ritual_wall_policy_view'
  | 'ritual_wall_share_link_click'
  | 'ritual_wall_cta_buy_click'
  | 'ritual_submit_start'
  | 'ritual_submit_step_view'
  | 'ritual_submit_step_complete'
  | 'ritual_submit_word_count_milestone'
  | 'ritual_submit_emoji_stripped'
  | 'ritual_submit_success'
  | 'ritual_submit_error'
  | 'ritual_submit_abandoned'
  | 'ritual_admin_approved'
  | 'ritual_admin_rejected'
  | 'ritual_admin_hidden'
  | 'ritual_admin_restored'
  | 'ritual_admin_featured_on'
  | 'ritual_admin_featured_off';

interface DataLayerWindow {
  dataLayer?: Array<Record<string, unknown>>;
}

/**
 * Hook simple pour émettre des événements vers le dataLayer GTM
 * et console.log en dev. Aucun fetch serveur — les événements sont
 * captés via le pipeline GTM existant côté front.
 */
export function trackRitualEvent(
  event: RitualEventName,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;
  const w = window as DataLayerWindow & Window;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ritual: payload });
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[ritual-track]', event, payload);
  }
}
