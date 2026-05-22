/**
 * Feature flag — Layout de la landing `/kit`.
 *
 * Source : variable d'env `NEXT_PUBLIC_KIT_LAYOUT_V2`. Par défaut `v1`
 * (ordre actuel 14 sections) pour préserver la zéro régression. La bascule
 * en `v2` (refonte Kolenda — 10 sections, wizard en position 6) se fait via
 * Vercel env vars + redeploy (rollback < 60 sec).
 *
 * Référence : `docs/kit-landing-reorder-2026-05/05-runbook-rollout.md`.
 *
 * Pourquoi pas un toggle DB ?
 *  - Le layout impacte le rendering serveur — on veut une lecture O(1) à la
 *    requête sans hit DB. Une env var Vercel suffit pour le rollout 4 paliers.
 *  - Si on veut un A/B 50/50 plus tard, on ajoutera un middleware edge qui
 *    set le cookie `fg_kit_layout` ; cette constante restera utilisée par le
 *    serveur pour décider du rendu via lecture cookie.
 */

export type KitLayoutVersion = 'v1' | 'v2';

/**
 * Calcule la version effective du layout à partir de la valeur d'env brute.
 * Exporté pour les tests (mock env). En runtime, utiliser la constante
 * `KIT_LAYOUT_VERSION` directement.
 */
export function resolveKitLayoutVersion(
  envValue: string | undefined,
): KitLayoutVersion {
  return envValue === 'true' ? 'v2' : 'v1';
}

export const KIT_LAYOUT_VERSION: KitLayoutVersion = resolveKitLayoutVersion(
  process.env.NEXT_PUBLIC_KIT_LAYOUT_V2,
);
