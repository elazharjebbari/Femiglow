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
  const locale = resolveTargetLocale(cookieLocale);
  const suffix = pathname === '/' ? '' : pathname;
  return `/${locale}${suffix}`;
}

function resolveTargetLocale(cookieLocale?: string | null): Locale {
  return isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

/** Seule racine éligible au rewrite interne (landing des publicités). */
export const KIT_ROOT_PATH = '/kit';

/**
 * Décision de routage i18n pour une route legacy :
 *  - `redirect` : 307 historique vers l'arbre localisé (URL changée) ;
 *  - `rewrite`  : service interne de l'arbre localisé, URL `/kit` conservée.
 */
export type LegacyLocaleRouting =
  | { kind: 'redirect'; pathname: string; locale: Locale }
  | { kind: 'rewrite'; pathname: string; locale: Locale };

export interface LegacyLocaleRoutingOptions {
  /** Flag `KIT_ROOT_REWRITE` (cf. `lib/feature-flags/kit-root-rewrite`). */
  kitRootRewrite: boolean;
}

/**
 * Kit CRO v2 §1 — comme `resolveLegacyLocaleRedirect`, mais indique en plus
 * si la cible doit être servie par **rewrite** interne plutôt que par 307.
 *
 * Le rewrite ne concerne QUE `/kit` exact (ni `/`, ni `/kit/…`, ni les autres
 * racines) ET la locale par défaut. Pourquoi pas `/kit` + cookie `ar`/`en` :
 * plusieurs composants clients dérivent la locale du 1er segment de
 * `usePathname()` (PriceBlock, SkipLink, ChatLauncher, LocaleSwitcher…). Avec
 * l'URL `/kit`, ils retomberaient sur `fr` alors que la page est servie en
 * AR → textes/prix dans la mauvaise langue et hydratation divergente. Ces
 * visiteurs de retour (minoritaires) gardent donc le 307 vers `/{locale}/kit`.
 *
 * @param pathname     chemin brut avec slash initial, sans query string
 * @param cookieLocale valeur du cookie `NEXT_LOCALE` (optionnelle)
 */
export function resolveLegacyLocaleRouting(
  pathname: string,
  cookieLocale: string | null | undefined,
  options: LegacyLocaleRoutingOptions,
): LegacyLocaleRouting | null {
  const target = resolveLegacyLocaleRedirect(pathname, cookieLocale);
  if (!target) return null;
  const locale = resolveTargetLocale(cookieLocale);
  const rewrite =
    options.kitRootRewrite && pathname === KIT_ROOT_PATH && locale === DEFAULT_LOCALE;
  return { kind: rewrite ? 'rewrite' : 'redirect', pathname: target, locale };
}
