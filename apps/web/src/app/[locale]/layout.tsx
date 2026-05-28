/**
 * Sub-layout `[locale]` — wrap les pages localisées avec :
 *  - `NextIntlClientProvider` (messages dispos côté client)
 *  - `LocaleDirectionScript` qui ajuste `<html lang/dir>` runtime
 *
 * NB : on ne touche PAS au layout root (`app/layout.tsx`) — il définit
 * encore `<html lang="fr">` hardcoded. L'ajustement runtime de `lang` et
 * `dir` permet d'avoir le bon comportement RTL sans casser les routes
 * legacy non-i18n. La refonte SSR-pure du root layout est planifiée pour
 * Phase 2.X (cf. `docs/i18n-strategy-2026-05/08-plan-action/phases.md`).
 *
 * @see docs/i18n-strategy-2026-05/03-backend/server-rendering.md
 */
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { LocaleDirectionScript } from '@/components/i18n/LocaleDirectionScript';
import { getLocaleConfig, isLocale, LOCALES } from '@/i18n.config';

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
  const config = getLocaleConfig(params.locale);

  return (
    <NextIntlClientProvider
      locale={params.locale}
      messages={messages}
      timeZone="Africa/Casablanca"
      now={new Date()}
    >
      <LocaleDirectionScript
        locale={params.locale}
        direction={config.direction}
      />
      {children}
    </NextIntlClientProvider>
  );
}
