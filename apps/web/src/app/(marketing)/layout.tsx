/**
 * Layout legacy `(marketing)/*` — routes non préfixées par `locale`
 * (`/`, `/contact`, `/kit`, etc.).
 *
 * Phase 7C (2026-05) — Enveloppé par `NextIntlClientProvider` (locale FR
 * fixe) afin que le `Header` et le `Footer` puissent utiliser
 * `useTranslations` / `getTranslations` sans crash. Le SSR continue de
 * servir le HTML FR comme avant.
 *
 * cf. docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A4.
 */
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DEFAULT_LOCALE } from '@/i18n.config';
import { getMenuHintEnabled } from '@/lib/layout/menu-hint-config';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force la locale par défaut (FR) — toutes les routes `(marketing)/*`
  // sont l'expérience FR historique. Pas de detection cookie / Accept-Language
  // ici : ça créerait un comportement imprévisible pour les routes legacy.
  setRequestLocale(DEFAULT_LOCALE);
  const messages = await getMessages();
  const menuHintEnabled = await getMenuHintEnabled();

  return (
    <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={messages}>
      <Header menuHintEnabled={menuHintEnabled} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </NextIntlClientProvider>
  );
}
