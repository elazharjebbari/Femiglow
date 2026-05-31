'use client';

/**
 * `SkipLink` — lien d'évitement « Aller au contenu » (WCAG SC 2.4.1).
 *
 * Rendu dans le root layout (`app/layout.tsx`), HORS du
 * `NextIntlClientProvider` (qui n'enveloppe que les sous-arbres
 * `[locale]/*` et `(marketing)/*`). On ne peut donc pas utiliser
 * `useTranslations` ici. On lit la locale depuis le préfixe du pathname
 * et on sélectionne la valeur `common.skip_to_content` du bon catalogue.
 *
 * Phase 9bis (2026-05) — i18n du chrome AR.
 */
import { usePathname } from 'next/navigation';

import { coerceLocale, type Locale } from '@/i18n.config';
import enMessages from '@/messages/en.json';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';

const SKIP_LABEL: Record<Locale, string> = {
  fr: frMessages.common.skip_to_content,
  ar: arMessages.common.skip_to_content,
  en: enMessages.common.skip_to_content,
};

function localeFromPathname(pathname: string | null): Locale {
  const segment = (pathname ?? '/').split('/')[1];
  return coerceLocale(segment);
}

export function SkipLink() {
  const pathname = usePathname();
  const locale = localeFromPathname(pathname);

  return (
    <a href="#main" className="skip-link">
      {SKIP_LABEL[locale]}
    </a>
  );
}
