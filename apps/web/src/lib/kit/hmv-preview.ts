/**
 * Médias par audience — marqueur d'« aperçu brouillon » (module pur,
 * utilisable par le middleware Edge et par le root layout).
 *
 * L'admin charge `/{locale}/kit?hmv_preview=draft` en iframe. Le middleware
 * pose alors l'en-tête de REQUÊTE `x-fg-hmv-preview: 1` (et retire toute
 * valeur envoyée par le client) ; le root layout le lit via `headers()` pour
 * ne monter AUCUNE couche de mesure (GTM, pixels, Web Vitals, attribution,
 * bandeau) et forcer le client first-party en mode muet, plus `noindex`.
 *
 * Le marqueur ne donne JAMAIS accès aux brouillons : ce choix reste dans
 * `lib/kit/page-context.server.ts`, qui exige une session admin. Au pire,
 * un visiteur qui forge l'URL coupe sa propre mesure.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */

/** En-tête de requête interne posé par le middleware. */
export const HMV_PREVIEW_HEADER = 'x-fg-hmv-preview';

const KIT_PATH = /^\/(?:[a-z]{2}\/)?kit\/?$/;

/** Vrai pour `/kit` ou `/<locale>/kit` avec `?hmv_preview=draft`. */
export function isKitDraftPreviewUrl(pathname: string, searchParams: URLSearchParams): boolean {
  if (searchParams.get('hmv_preview')?.trim().toLowerCase() !== 'draft') return false;
  return KIT_PATH.test(pathname);
}

/** Lecture du marqueur côté serveur (root layout). */
export function isHmvPreviewRequest(headers: { get(name: string): string | null }): boolean {
  return headers.get(HMV_PREVIEW_HEADER) === '1';
}
