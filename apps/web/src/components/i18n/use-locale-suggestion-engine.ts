/**
 * Moteur de suggestion — runtime client `useLocaleSuggestionEngine` (lot L10).
 *
 * Assemble les briques pures de L9 : collecte les signaux DOM
 * (`collectSignals`) + métriques temporelles, évalue la politique
 * (`evaluateSuggestionPolicy`), applique le **defer-to-breakpoint** (TTL,
 * INV-17), et expose un `prompt` à rendre au bon moment. L'acceptation
 * passe par `useLocaleSwitch().switchTo(…, 'nudge')` → bascule **sans
 * reload** (INV-1). Le refus pose un cookie (persistant) ou un drapeau de
 * session (INV-16).
 *
 * Garanties :
 *  - **Inerte si moteur off** (INV-13) : une seule évaluation d'audit, puis
 *    **aucun listener** attaché, **aucun prompt**.
 *  - Zones calmes inviolables (INV-14/15) via la politique (jamais montré en
 *    checkout/form/deep-read), même trigger actif.
 *  - **Jamais d'auto-redirect** (INV-20) : seul un clic utilisateur bascule.
 *  - Chaque décision émet un event d'audit (INV-19).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/04-frontend/engine-runtime.md
 * @see docs/locale-switcher-v2/CONTRACT.md §7.3, INV-13..INV-20
 */
'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type Locale } from '@/i18n.config';
import { deriveLocale } from '@/lib/i18n/build-switch-url';
import { type ResolvedEngineConfig } from '@/lib/i18n/engine-config-schema';
import { collectSignals } from '@/lib/i18n/suggestion-signals';
import { evaluateSuggestionPolicy } from '@/lib/i18n/suggestion-policy';
import { type Decision, withSafeDefaults } from '@/lib/i18n/suggestion-types';
import { useTracking } from '@/lib/tracking/use-tracking';

import { useLocaleSwitch } from './locale-transition-context';

/** Pause de scroll considérée comme « moment opportun » (breakpoint, INV-17). */
const SCROLL_QUIET_MS = 600;
/** Cookie de refus persistant (respecté indéfiniment, reset admin — INV-16). */
const DISMISS_COOKIE = 'locale_suggestion_dismissed';
const IMPRESSIONS_KEY = 'locale_suggestion_impressions';

export interface EnginePrompt {
  suggested: Locale;
  surface: 'pearl' | 'toast';
  profileMatched: string;
}

export interface UseLocaleSuggestionEngine {
  prompt: EnginePrompt | null;
  accept: () => void;
  dismiss: (scope: 'session' | 'persistent') => void;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match?.[1] !== undefined ? decodeURIComponent(match[1]) : null;
}

function readImpressions(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.sessionStorage.getItem(IMPRESSIONS_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function useLocaleSuggestionEngine(input: {
  guessedLocale: Locale;
  confidence: number;
  config: ResolvedEngineConfig;
}): UseLocaleSuggestionEngine {
  const { guessedLocale, confidence, config } = input;
  const pathname = usePathname() ?? '/';
  const served = deriveLocale(pathname);
  const switcher = useLocaleSwitch();
  const { emit } = useTracking();

  const [prompt, setPrompt] = useState<EnginePrompt | null>(null);

  const mountTimeRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const exitIntentRef = useRef(false);
  const deferredRef = useRef(false);
  const shownRef = useRef(false);
  const shownAtRef = useRef(0);
  const ttlTimerRef = useRef<number | null>(null);
  const quietTimerRef = useRef<number | null>(null);

  const buildSignals = useCallback(
    (atBreakpoint: boolean) =>
      withSafeDefaults({
        servedLocale: served,
        guessedLocale,
        confidence,
        ...collectSignals(pathname),
        dwellMs: mountTimeRef.current ? Date.now() - mountTimeRef.current : 0,
        scrollVelocity: scrollVelocityRef.current,
        atBreakpoint,
        exitIntent: exitIntentRef.current,
        isDeepReading: false,
        cooldownActive: false,
        impressionsThisVisitor: readImpressions(),
        dismissedPersistent: readCookie(DISMISS_COOKIE) === '1',
      }),
    [served, guessedLocale, confidence, pathname],
  );

  const emitDecision = useCallback(
    (decision: Decision) => {
      emit('locale_suggestion_evaluated', {
        served,
        suggested: decision.suggested,
        page: pathname,
        decision: decision.decision,
        reason: decision.reason,
        profileMatched: decision.profileMatched,
      });
      if (decision.decision === 'suppress') {
        emit('locale_suggestion_suppressed', {
          served,
          page: pathname,
          reason: decision.reason,
          neverProfile: decision.neverProfile,
        });
      }
    },
    [emit, served, pathname],
  );

  const clearTtl = useCallback(() => {
    if (ttlTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(ttlTimerRef.current);
      ttlTimerRef.current = null;
    }
  }, []);

  const doShow = useCallback(
    (decision: Decision) => {
      if (decision.suggested === null || decision.profileMatched === null) return;
      shownRef.current = true;
      deferredRef.current = false;
      clearTtl();
      const surface =
        config.profiles.find((p) => p.id === decision.profileMatched)?.surface ??
        'pearl';
      shownAtRef.current = Date.now();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          IMPRESSIONS_KEY,
          String(readImpressions() + 1),
        );
      }
      setPrompt({
        suggested: decision.suggested,
        surface,
        profileMatched: decision.profileMatched,
      });
      emit('locale_suggestion_shown', {
        served,
        suggested: decision.suggested,
        page: pathname,
        profileMatched: decision.profileMatched,
        surface,
      });
    },
    [config.profiles, clearTtl, emit, served, pathname],
  );

  const evaluate = useCallback(
    (atBreakpoint: boolean) => {
      if (shownRef.current) return;
      const decision = evaluateSuggestionPolicy(buildSignals(atBreakpoint), config);
      emitDecision(decision);

      if (decision.decision === 'show') {
        doShow(decision);
        return;
      }
      if (decision.decision === 'defer') {
        deferredRef.current = true;
        clearTtl();
        if (typeof window !== 'undefined') {
          ttlTimerRef.current = window.setTimeout(() => {
            if (deferredRef.current && !shownRef.current) {
              deferredRef.current = false;
              emit('locale_suggestion_suppressed', {
                served,
                page: pathname,
                reason: 'defer-expired',
                neverProfile: null,
              });
            }
          }, config.deferTtlMs);
        }
      }
    },
    [buildSignals, config, emitDecision, doShow, clearTtl, emit, served, pathname],
  );

  // Effet principal : audit one-shot + (si moteur on) écoute des breakpoints.
  useEffect(() => {
    mountTimeRef.current = Date.now();
    lastScrollTimeRef.current = Date.now();

    // Évaluation d'audit immédiate (émet engine-off / zone calme, jamais de show
    // hors breakpoint requis). Inerte visuellement si moteur off.
    evaluate(false);

    // INV-13 : moteur off → AUCUN listener attaché. Coût ~0.
    if (!config.engineEnabled) return;

    const onScroll = () => {
      const now = Date.now();
      const y = window.scrollY;
      const dt = now - lastScrollTimeRef.current;
      if (dt > 0) {
        scrollVelocityRef.current =
          (Math.abs(y - lastScrollYRef.current) / dt) * 1000;
      }
      lastScrollYRef.current = y;
      lastScrollTimeRef.current = now;
      if (quietTimerRef.current !== null) window.clearTimeout(quietTimerRef.current);
      quietTimerRef.current = window.setTimeout(() => {
        // Pause de scroll = breakpoint : la vélocité retombe à 0.
        scrollVelocityRef.current = 0;
        evaluate(true);
      }, SCROLL_QUIET_MS);
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && e.relatedTarget === null) {
        exitIntentRef.current = true;
        evaluate(true);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onMouseOut);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onMouseOut);
      if (quietTimerRef.current !== null) window.clearTimeout(quietTimerRef.current);
      clearTtl();
    };
    // `evaluate` capture la config courante ; on relance si le moteur (dé)s'active.
  }, [config.engineEnabled, evaluate, clearTtl]);

  const accept = useCallback(() => {
    if (!prompt) return;
    emit('locale_suggestion_accepted', {
      served,
      suggested: prompt.suggested,
      page: pathname,
      msToDecision: shownAtRef.current ? Date.now() - shownAtRef.current : 0,
    });
    switcher?.switchTo(prompt.suggested, 'nudge');
    setPrompt(null);
  }, [prompt, emit, served, pathname, switcher]);

  const dismiss = useCallback(
    (scope: 'session' | 'persistent') => {
      const suggested = prompt?.suggested ?? guessedLocale;
      emit('locale_suggestion_dismissed', {
        served,
        suggested,
        page: pathname,
        scope,
      });
      if (typeof document !== 'undefined' && scope === 'persistent') {
        // 180 jours ; reset par l'admin (L11).
        document.cookie = `${DISMISS_COOKIE}=1; max-age=${60 * 60 * 24 * 180}; path=/; samesite=lax`;
      }
      setPrompt(null);
    },
    [prompt, guessedLocale, emit, served, pathname],
  );

  return { prompt, accept, dismiss };
}
