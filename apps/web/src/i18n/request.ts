/**
 * Request configuration next-intl — chargement des messages côté serveur.
 *
 * Appelé automatiquement par next-intl à chaque request RSC. Décide quel
 * fichier `messages/{locale}.json` charger en se basant sur le segment URL
 * `[locale]`.
 *
 * Cf. https://next-intl-docs.vercel.app/docs/usage/configuration#i18n-request
 * @see docs/i18n-strategy-2026-05/03-backend/server-rendering.md
 */
import { getRequestConfig } from 'next-intl/server';

import { isLocale, type Locale } from '@/i18n.config';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale est typiquement la valeur du segment `[locale]` du path.
  // Si invalide ou absent, on fallback sur `routing.defaultLocale` pour éviter
  // de crasher le render — la 404 est gérée en amont par le middleware.
  const requested = await requestLocale;
  const locale: Locale = isLocale(requested) ? requested : routing.defaultLocale;

  // Dynamic import du fichier de messages. Le bundler split chaque locale
  // en chunk séparé, donc seules les messages de la locale active sont
  // chargées (pas les autres).
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // `now` : date de référence stable pour le render (évite divergence
    // server/client sur les formats relatifs). UTC explicite.
    now: new Date(),
    // `timeZone` : Casablanca/Rabat (Maroc) par défaut — déterministe pour
    // les formats `DateTimeFormat`.
    timeZone: 'Africa/Casablanca',
  };
});
