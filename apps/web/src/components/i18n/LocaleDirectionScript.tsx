'use client';

/**
 * LocaleDirectionScript — set `<html lang>` et `<html dir>` runtime.
 *
 * Workaround tant que le root layout n'est pas refactoré en SSR-pure i18n.
 * Set les attributs dès que le composant monte (client-side after hydration).
 *
 * Limitation acceptée : le HTML initial est servi avec `lang="fr"` hardcoded
 * depuis le root layout. Pour AR, il y a un flash LTR très bref avant que
 * ce composant ne corrige. À supprimer dès la Phase 2.X (refonte root layout
 * pour SSR pur).
 *
 * @see docs/i18n-strategy-2026-05/03-backend/server-rendering.md §"Root layout"
 */
import { useEffect } from 'react';

import type { Locale } from '@/i18n.config';

interface LocaleDirectionScriptProps {
  locale: Locale;
  direction: 'ltr' | 'rtl';
}

export function LocaleDirectionScript({
  locale,
  direction,
}: LocaleDirectionScriptProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', direction);
  }, [locale, direction]);

  return null;
}
