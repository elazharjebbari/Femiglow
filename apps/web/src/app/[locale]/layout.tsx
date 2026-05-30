/**
 * Sub-layout `[locale]` — wrap les pages localisées avec :
 *  - `NextIntlClientProvider` (messages dispos côté client)
 *  - Inline script SSR qui set `<html lang/dir>` AVANT hydration React
 *
 * Pattern "blocking inline script" (identique à next-themes dark mode) :
 *  1. Le script est server-rendered dans le HTML envoyé au client
 *  2. Le browser le parse + exécute SYNCHRONEMENT au premier hit (avant
 *     l'hydration React, avant le premier paint visible)
 *  3. `lang`/`dir` du `<html>` sont mis à jour AVANT que React ne touche
 *     le DOM → **zéro flash LTR pour les visiteurs AR**
 *
 * On ne touche PAS au root layout (`app/layout.tsx`) — il continue de
 * définir `<html lang="fr">` hardcoded pour les routes legacy. Notre
 * script overrides au plus tôt pour les routes `[locale]/*`.
 *
 * Refonte SSR-pure du root layout (lang servi server-side dans le HTML
 * initial) reste possible Phase 2.X mais demande de réécrire le
 * middleware existant (CSP/auth/attribution) — out of scope ici.
 *
 * @see docs/i18n-strategy-2026-05/03-backend/server-rendering.md
 */
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { isLocaleSwitcherV2Enabled } from '@/components/i18n/locale-switcher-flag';
import { LocaleSuggestionEngine } from '@/components/i18n/LocaleSuggestionEngine';
import { LocaleTransitionProvider } from '@/components/i18n/locale-transition-context';
import {
  getLocaleConfig,
  isLocale,
  LOCALE_COOKIE_NAME,
  LOCALES,
} from '@/i18n.config';
import { getResolvedEngineConfig } from '@/lib/i18n/engine-config';
import { resolveSuggestedLocale } from '@/lib/i18n/suggested-locale';

interface LocaleLayoutProps {
  children: ReactNode;
  params: { locale: string };
}

/**
 * Génère les paramètres statiques pour les 3 locales — permet à Next.js
 * de pré-rendre `[locale]` en SSG (gain perf significatif vs runtime).
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Construit un script JavaScript inline qui set lang/dir sur l'élément
 * `<html>` au plus tôt dans le cycle de chargement du document.
 *
 * Sécurité : la `locale` est validée par `isLocale()` en amont, donc
 * impossible d'injecter du JS arbitraire via l'URL. La direction est
 * une string statique ('ltr' | 'rtl') depuis `LOCALES_CONFIG`.
 */
function buildLocaleScript(locale: string, direction: 'ltr' | 'rtl'): string {
  return `(function(){try{var h=document.documentElement;h.setAttribute('lang','${locale}');h.setAttribute('dir','${direction}');}catch(e){}})();`;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  // Validation stricte : si la locale URL n'est pas supportée → 404 propre
  // (vs render avec fallback qui masquerait des typos).
  if (!isLocale(params.locale)) {
    notFound();
  }

  // Active la locale pour ce render (next-intl 3.x — requis pour
  // `getTranslations` côté server components imbriqués).
  setRequestLocale(params.locale);

  const messages = await getMessages();
  const config = getLocaleConfig(params.locale);
  const localeScript = buildLocaleScript(params.locale, config.direction);

  // Lot L12 — amorces serveur du moteur de suggestion (no-flash, ADR-006).
  // Lire headers()/cookies() rend les routes `[locale]/*` dynamiques : c'est
  // assumé, c'est le prix de la détection anti-flash côté serveur (INV-2).
  // Moteur OFF par défaut (INV-13) ⇒ inerte tant que l'admin ne l'allume pas.
  const v2Enabled = isLocaleSwitcherV2Enabled();
  let suggestion: Awaited<ReturnType<typeof resolveSuggestedLocale>> | null =
    null;
  let engineConfig = null as Awaited<
    ReturnType<typeof getResolvedEngineConfig>
  > | null;
  if (v2Enabled) {
    const cookieStore = cookies();
    const cookieLocaleRaw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    suggestion = resolveSuggestedLocale({
      servedLocale: params.locale,
      acceptLanguage: headers().get('accept-language'),
      cookieLocale: isLocale(cookieLocaleRaw) ? cookieLocaleRaw : null,
    });
    engineConfig = await getResolvedEngineConfig();
  }

  return (
    <NextIntlClientProvider
      locale={params.locale}
      messages={messages}
      timeZone="Africa/Casablanca"
      now={new Date()}
    >
      {/* Inline blocking script — set lang/dir AVANT premier paint. */}
      <script
        dangerouslySetInnerHTML={{ __html: localeScript }}
        suppressHydrationWarning
      />
      {/*
        Phase 7A — Chrome public (Header + Footer) rendu ici afin que
        `LocaleSwitcher` (embarqué dans le Header) apparaisse sur toutes
        les routes localisées. Le legacy `(marketing)/layout.tsx`
        continue d'utiliser le même Header/Footer pour les routes non
        préfixées — pas de duplication.
        cf. docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A4.
      */}
      {/*
        Lot L3 — derrière le flag, on enveloppe le chrome dans le
        `LocaleTransitionProvider` (une seule instance du moteur de bascule
        sans reload + voile + annonceur aria-live). Flag off ⇒ chrome direct
        (comportement V1, zéro régression).
      */}
      {v2Enabled ? (
        <LocaleTransitionProvider>
          <Header />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          {/*
            Lot L12 — moteur de suggestion monté dans le provider (utilise
            `useLocaleSwitch`). Ne rend rien tant qu'un breakpoint n'est pas
            atteint et que le moteur n'est pas allumé (INV-13). La devinette
            ne s'affiche que si elle diffère de la langue servie (INV-20).
          */}
          {suggestion && engineConfig && suggestion.differsFromServed ? (
            <LocaleSuggestionEngine
              guessedLocale={suggestion.suggested}
              confidence={suggestion.confidence}
              config={engineConfig}
            />
          ) : null}
        </LocaleTransitionProvider>
      ) : (
        <>
          <Header />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </>
      )}
    </NextIntlClientProvider>
  );
}
