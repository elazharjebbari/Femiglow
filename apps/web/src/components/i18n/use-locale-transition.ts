/**
 * Locale Switcher V2 — hook `useLocaleTransition` (lot L2).
 *
 * Cœur de la bascule de langue **sans rechargement** : choisit le mode
 * (View Transitions / voile / reduced-motion), synchronise `dir/lang`
 * (INV-2) **avant** la frame, préserve scroll (INV-3) et querystring
 * (INV-4) via soft-navigation App Router, annonce le changement (INV-10),
 * émet l'event `locale_switch`, et retombe sur un reload de secours
 * en cas d'échec.
 *
 * @see docs/locale-switcher-v2/05-frontend/use-locale-transition.md
 * @see docs/locale-switcher-v2/CONTRACT.md (INV-1..INV-4, INV-7, INV-10, INV-11)
 */
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { type Locale } from '@/i18n.config';
import { buildSwitchUrl, deriveLocale } from '@/lib/i18n/build-switch-url';
import {
  announceLocale,
  applyHtmlLocale,
  prefersReducedMotion,
  supportsViewTransitions,
} from '@/lib/i18n/transition-helpers';
import { useTracking } from '@/lib/tracking/use-tracking';

export type SwitchSurface = 'header' | 'drawer' | 'footer' | 'nudge';
export type TransitionKind = 'vt' | 'veil' | 'reduced' | 'reload';

/** Durée d'un fondu du voile (fallback) — cf. CONTRACT §5. */
export const VEIL_FADE_MS = 160;

export interface VeilState {
  active: boolean;
  phase: 'in' | 'out' | null;
}

export interface UseLocaleTransition {
  switchTo: (target: Locale, surface: SwitchSurface) => void;
  veil: VeilState;
  active: Locale;
}

export function useLocaleTransition(): UseLocaleTransition {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const { emit } = useTracking();
  const [veil, setVeil] = useState<VeilState>({ active: false, phase: null });

  const active = deriveLocale(pathname);

  const switchTo = useCallback(
    (target: Locale, surface: SwitchSurface) => {
      // INV-11 — cliquer la langue active ne fait rien.
      if (target === active) return;

      const search = searchParams ? searchParams.toString() : '';
      const url = buildSwitchUrl(pathname, search, target); // INV-4

      const track = (transition: TransitionKind) =>
        emit('locale_switch', {
          from: active,
          to: target,
          surface,
          page: pathname,
          transition,
        });

      // INV-2 (dir/lang avant la frame) · INV-3 (soft-nav scroll préservé)
      // · INV-10 (annonce). Reload de secours si la soft-nav échoue (INV-1 exception).
      const runApply = (kind: TransitionKind) => {
        try {
          applyHtmlLocale(target);
          announceLocale(target);
          router.replace(url);
          track(kind);
        } catch {
          if (typeof window !== 'undefined') window.location.assign(url);
          track('reload');
        }
      };

      // INV-7 — reduced-motion : bascule directe, sans animation.
      if (prefersReducedMotion()) {
        runApply('reduced');
        return;
      }

      // View Transitions : fondu croisé natif (ADR-001).
      if (supportsViewTransitions()) {
        (
          document as unknown as {
            startViewTransition: (cb: () => void) => unknown;
          }
        ).startViewTransition(() => runApply('vt'));
        return;
      }

      // Fallback voile framer (ADR-002).
      setVeil({ active: true, phase: 'in' });
      const t1 =
        typeof window !== 'undefined'
          ? window.setTimeout(() => {
              runApply('veil');
              setVeil({ active: true, phase: 'out' });
              if (typeof window !== 'undefined') {
                window.setTimeout(
                  () => setVeil({ active: false, phase: null }),
                  VEIL_FADE_MS,
                );
              }
            }, VEIL_FADE_MS)
          : null;
      if (t1 === null) runApply('veil');
    },
    [active, pathname, searchParams, emit, router],
  );

  return { switchTo, veil, active };
}
