/**
 * Routing configuration next-intl — utilisé par middleware + Link/useRouter
 * partout dans l'app.
 *
 * Cf. https://next-intl-docs.vercel.app/docs/routing
 * @see docs/i18n-strategy-2026-05/02-design-conception/url-strategy.md
 */
import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALES, LOCALE_PREFIX_STRATEGY } from '@/i18n.config';

/**
 * Routing canonique de l'app.
 *
 * - `locales`        : toutes les locales possibles (cf. `i18n.config`)
 * - `defaultLocale`  : FR (cf. ADR-003)
 * - `localePrefix`   : 'always' (cf. ADR-002 — toutes les routes ont `/[locale]/`)
 *
 * Si on avait des pathnames différents par locale (ex: `/kit` → `/الكيت`), on
 * les déclarerait dans `pathnames`. V1 : pathnames identiques pour simplicité.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: LOCALE_PREFIX_STRATEGY,
});

/**
 * Type des locales supportées par le routing. À utiliser dans tout
 * composant qui reçoit `params: { locale: ... }` depuis Next.js.
 */
export type AppLocale = (typeof routing.locales)[number];
