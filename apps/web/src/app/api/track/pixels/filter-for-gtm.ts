/**
 * Helper colocalisé pour `/api/track/pixels`.
 *
 * Sortie en module séparé (et non `export const __test__` depuis
 * `route.ts`) parce que Next.js 14 type-checke strictement `route.ts`
 * et rejette tout export hors de l'API route handlers + `runtime`/
 * `dynamic`. Ce module reste accessible aux tests Vitest sans casser
 * le build.
 */
import type { TrackingProvider, TrackingProviderKind } from '@/lib/db/types';

/**
 * Providers dont le snippet client doit être omis quand GTM est actif :
 *   - le bootstrap est déjà émis par la balise GTM dédiée (TikTok Init),
 *   - et l'auto-Pageview du SDK (`ttq.page()`) n'a pas de dédup native
 *     côté TikTok (contrairement à `ttq.track('...', { event_id })`).
 *
 * Injecter le snippet ET la balise GTM produirait donc deux Pageviews
 * comptabilisés. Le compromis Meta/Snap (qui acceptent un éventuel double
 * fire grâce à fbq.loaded / SnapPixelEvents) n'est pas applicable ici.
 *
 * Cette politique est conservatrice : si GTM n'est pas enabled, le
 * snippet client reste le canal unique et reprend le rôle d'init.
 */
export const PROVIDERS_SKIPPED_WHEN_GTM: ReadonlySet<TrackingProviderKind> = new Set([
  'tiktok',
]);

export function filterForGtm(providers: TrackingProvider[]): TrackingProvider[] {
  const gtmActive = providers.some((p) => p.kind === 'gtm');
  if (!gtmActive) return providers;
  return providers.filter((p) => !PROVIDERS_SKIPPED_WHEN_GTM.has(p.kind));
}
