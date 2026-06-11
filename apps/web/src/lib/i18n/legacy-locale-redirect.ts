/**
 * L8 — Redirection des routes legacy non préfixées vers leur équivalent
 * localisé (`/kit` → `/fr/kit`, `/` → `/fr`) quand `I18N_ENABLED=true`.
 *
 * Le site sert deux arbres en parallèle : les routes legacy FR (`(marketing)`,
 * `(commerce)`) et les routes localisées (`[locale]`). À l'activation de
 * l'i18n, on veut que l'entrée par défaut bascule sur l'arbre localisé (switcher
 * visible, traductions actives) — sans pour autant casser les chemins legacy
 * qui n'ont PAS de miroir localisé.
 *
 * On ne redirige donc que via une liste blanche de racines effectivement
 * mirrorées sous `[locale]/`. `/merci`, `/panier`, `/mentions-legales`,
 * `/commander`, `/legal`, `/admin`, `/api`… restent servis tels quels.
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n.config';

/** Racines legacy disposant d'un équivalent sous `app/[locale]/`. */
const LOCALIZED_ROOTS = ['/kit', '/maison', '/contact', '/journal', '/rituel'] as const;

function startsWithLocale(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0];
  return first !== undefined && isLocale(first);
}

function hasLocalizedEquivalent(pathname: string): boolean {
  if (pathname === '/') return true;
  return LOCALIZED_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

/**
 * Cible de redirection localisée pour une route legacy, ou `null` si aucune
 * redirection ne doit avoir lieu (déjà localisé, ou pas de miroir).
 *
 * La locale cible respecte le cookie `NEXT_LOCALE` s'il est valide (visiteur
 * de retour en AR/EN), sinon `DEFAULT_LOCALE` (fr).
 *
 * @param pathname     chemin brut avec slash initial, sans query string
 * @param cookieLocale valeur du cookie `NEXT_LOCALE` (optionnelle)
 */
export function resolveLegacyLocaleRedirect(
  pathname: string,
  cookieLocale?: string | null,
): string | null {
  if (startsWithLocale(pathname)) return null;
  if (!hasLocalizedEquivalent(pathname)) return null;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const suffix = pathname === '/' ? '' : pathname;
  return `/${locale}${suffix}`;
}
