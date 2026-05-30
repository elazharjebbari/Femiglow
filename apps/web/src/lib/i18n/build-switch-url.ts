/**
 * Locale Switcher V2 — helpers purs d'URL (lot L1).
 *
 * `buildSwitchUrl` construit l'URL cible d'une bascule de langue en
 * **préservant le querystring/UTM** (INV-4) ; `deriveLocale` lit la locale
 * active depuis le 1er segment du chemin.
 *
 * Fonctions **pures** (aucun accès `window`/`document`) → testables
 * exhaustivement (cf. `build-switch-url.test.ts`).
 *
 * @see docs/locale-switcher-v2/05-frontend/use-locale-transition.md §6
 * @see docs/locale-switcher-v2/CONTRACT.md (INV-4)
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n.config';

/**
 * Locale active dérivée du 1er segment d'URL.
 * `/ar/kit` → `ar` · `/kit` → défaut · `/` → défaut · `/x/kit` → défaut.
 */
export function deriveLocale(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return first && isLocale(first) ? first : DEFAULT_LOCALE;
}

/** Retire un éventuel `?` de tête et les espaces ; renvoie '' si vide. */
function normalizeQuery(search: string | null | undefined): string {
  if (!search) return '';
  return search.replace(/^\?/, '').trim();
}

/**
 * URL cible pour passer la page courante dans `nextLocale`, querystring
 * préservé.
 *
 * - `/kit` + `ar`            → `/ar/kit`          (insertion du préfixe)
 * - `/fr/kit` + `ar`        → `/ar/kit`          (remplacement du préfixe)
 * - `/fr` + `ar`            → `/ar`              (racine localisée)
 * - `/` + `ar`             → `/ar`              (racine nue)
 * - `/fr/kit?utm=x` + `ar` → `/ar/kit?utm=x`    (UTM préservé, INV-4)
 *
 * @param pathname chemin courant (peut inclure ou non le préfixe locale)
 * @param search   querystring courant (avec ou sans `?` de tête)
 * @param nextLocale locale cible
 */
export function buildSwitchUrl(
  pathname: string,
  search: string | null | undefined,
  nextLocale: Locale,
): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) {
    segments[0] = nextLocale; // remplace le préfixe locale existant
  } else {
    segments.unshift(nextLocale); // insère le préfixe
  }
  const path = '/' + segments.join('/');
  const qs = normalizeQuery(search);
  return qs ? `${path}?${qs}` : path;
}
