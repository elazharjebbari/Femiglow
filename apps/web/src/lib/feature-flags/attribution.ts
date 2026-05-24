/**
 * Feature flag — Attribution v2 (server-side authoritative resolver).
 *
 * Source : variable d'env `NEXT_PUBLIC_ATTRIBUTION_V2`. Par défaut `v1`
 * (comportement actuel — client annote, serveur n'extrait pas), pour
 * préserver la zéro régression. La bascule en `v2` active le pipeline
 * `enrichEvent` qui résoud `trafficSource`/`trafficMedium` côté serveur
 * et les persiste dans `tracking_events_log`.
 *
 * Référence : `docs/attribution-fix-2026-05/05-runbook-rollout.md`.
 *
 * Pourquoi pas un toggle DB ?
 *  - L'enrichEvent est un hot path serveur (chaque event). On veut une
 *    lecture O(1) à la requête sans hit DB pour le toggle.
 *  - Une env var Vercel suffit pour le rollout 4 paliers (Canary 10% →
 *    Ramp 50% → Full 100%).
 */

export type AttributionVersion = 'v1' | 'v2';

export function resolveAttributionVersion(
  envValue: string | undefined,
): AttributionVersion {
  return envValue === 'true' ? 'v2' : 'v1';
}

export const ATTRIBUTION_VERSION: AttributionVersion = resolveAttributionVersion(
  process.env.NEXT_PUBLIC_ATTRIBUTION_V2,
);
