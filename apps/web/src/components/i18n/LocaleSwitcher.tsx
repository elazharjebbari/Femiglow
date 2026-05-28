'use client';

/**
 * LocaleSwitcher — composant client de bascule entre locales actives.
 *
 * Minimaliste (select natif) — la version "premium" dropdown stylé est
 * planifiée pour Phase 4 design.
 * @see docs/i18n-strategy-2026-05/05-ui-ux-design/locale-switcher-ui.md
 *
 * Comportement :
 *  - Lit la locale active depuis les props (passée par RSC parent)
 *  - Au changement, navigue vers le même path sur la nouvelle locale
 *  - Cookie `NEXT_LOCALE` mis à jour automatiquement par next-intl middleware
 *  - aria-label localisé pour a11y
 */
import type { ChangeEvent } from 'react';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { getEnabledLocales, getLocaleConfig, type Locale } from '@/i18n.config';

interface LocaleSwitcherProps {
  currentLocale: Locale;
}

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const locales = getEnabledLocales();

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Locale;
    if (next === currentLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Choisir la langue</span>
      <select
        value={currentLocale}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Choisir la langue"
        className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {locales.map((loc) => {
          const cfg = getLocaleConfig(loc);
          return (
            <option key={loc} value={loc}>
              {cfg.flagEmoji} {cfg.displayNameNative}
            </option>
          );
        })}
      </select>
    </label>
  );
}
