/**
 * Sub-layout `[locale]` — wrap les pages localisées avec :
 *  - `NextIntlClientProvider` (messages dispos côté client)
 *
 * `<html lang/dir>` est désormais rendu côté serveur par le root layout
 * (`app/layout.tsx`), qui lit la locale active depuis le header `x-locale`
 * posé par le middleware. C'est la source unique partagée serveur+client :
 *  - HTML initial déjà en `lang="ar" dir="rtl"` ⇒ zéro flash LTR
 *  - vdom React == DOM ⇒ zéro divergence d'hydratation
 *
 * L'ancien script inline qui mutait `document.documentElement` avant
 * l'hydration a donc été retiré : il recréait le mismatch (DOM "ar" vs
 * vdom root "fr") et n'est plus nécessaire.
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
