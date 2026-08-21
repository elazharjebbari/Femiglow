/**
 * Feature flag — Stories vidéo shoppables sur `/kit`.
 *
 * Source : variable d'env `NEXT_PUBLIC_STORIES_ENABLED`. Par défaut OFF
 * (zéro régression) : tant qu'il est `false`, `StoriesVideoBound` ne rend
 * rien. Bascule via env + redeploy (rollback < 60 s), comme le flag layout.
 *
 * Référence : docs/stories-video-2026-08-21/.
 */

/**
 * Calcule l'état effectif du flag à partir de la valeur d'env brute.
 * Exporté pour les tests (mock env).
 */
export function resolveStoriesEnabled(envValue: string | undefined): boolean {
  return envValue === 'true';
}

export const STORIES_ENABLED: boolean = resolveStoriesEnabled(
  process.env.NEXT_PUBLIC_STORIES_ENABLED,
);
