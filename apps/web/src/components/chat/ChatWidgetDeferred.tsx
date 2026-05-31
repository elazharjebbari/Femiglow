/**
 * `ChatWidgetDeferred` — wrapper d'éveil paresseux pour le widget chat.
 *
 * Objectif : retirer ~25-35 KB de JS (ChatPanel + MessageList + SSE reader +
 * hooks chat) du chemin critique du chargement. Le module `chat-store.ts`
 * reste accessible immédiatement car il est lu par `Header` et `StickyCartCTA`
 * (sélecteur `isOpen`) ; on diffère uniquement le mount UI du widget.
 *
 * Stratégie d'éveil (le premier signal qui arrive gagne) :
 *  1. `window.load` (page entièrement chargée) → permet de laisser passer
 *     les autres critical resources.
 *  2. `setTimeout(delayMs)` — filet de sécurité (default 2500 ms).
 *  3. `requestIdleCallback` — si dispo, monte pendant un idle slot du
 *     main thread (Chrome/Edge, fallback timeout sur Safari).
 *  4. Première interaction utilisateur : `scroll`, `touchstart`,
 *     `mousemove`, `keydown` — l'utilisateur veut interagir, on monte
 *     immédiatement pour qu'il trouve le launcher.
 *  5. Deep link `#chat` dans l'URL — bypass total (UX préservée pour les
 *     liens partagés).
 *
 * Émet un événement tracking `chat_widget_mount` avec le trigger effectif
 * pour mesurer en prod si la fenêtre `delayMs` est optimale.
 *
 * cf. plan d'action — perf 2026-05-19
 */
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';

const ChatWidgetLazy = dynamic(
  () => import('./ChatWidget').then((m) => ({ default: m.ChatWidget })),
  { ssr: false },
);

export type ChatWidgetMountTrigger =
  | 'hash'
  | 'load'
  | 'idle'
  | 'timeout'
  | 'interaction';

export interface ChatWidgetDeferredProps {
  page?: string;
  /** Délai max avant mount automatique. Default 2500 ms. */
  delayMs?: number;
  /**
   * Callback invoqué dès que le widget est armé (utile pour les tests —
   * en prod c'est `useTracking().emit` qui consomme l'info).
   */
  onReady?: (trigger: ChatWidgetMountTrigger, elapsedMs: number) => void;
}

const INTERACTION_EVENTS = [
  'scroll',
  'touchstart',
  'mousemove',
  'keydown',
] as const;

export function ChatWidgetDeferred({
  page,
  delayMs = 2500,
  onReady,
}: ChatWidgetDeferredProps): JSX.Element | null {
  const [ready, setReady] = useState(false);
  const { emit } = useTracking();
  // Le ref empêche la double-émission de l'event tracking si plusieurs
  // triggers se résolvent dans le même tick (e.g. load + timeout coïncident).
  const armedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const startedAt = performance.now();
    const cleanups: Array<() => void> = [];

    function armAndMount(trigger: ChatWidgetMountTrigger, elapsedMs: number) {
      if (armedRef.current) return;
      armedRef.current = true;
      cleanups.forEach((c) => c());
      setReady(true);
      onReady?.(trigger, elapsedMs);
      // Tracking — si pas de provider monté, `emit` est un noop côté hook.
      try {
        emit('chat_widget_mount', {
          trigger,
          delay_ms: Math.round(elapsedMs),
        });
      } catch {
        // jamais casser le rendu pour un échec analytics.
      }
    }

    // Deep link `#chat` → bypass immédiat. Geste explicite de l'utilisateur,
    // pas la peine d'attendre. (Placé après la déclaration de `cleanups`
    // pour éviter la TDZ sur la closure de `armAndMount`.)
    if (window.location.hash === '#chat') {
      armAndMount('hash', 0);
      return;
    }

    // 1. window.load — déclenché après tous les critical resources.
    function onLoad() {
      armAndMount('load', performance.now() - startedAt);
    }
    if (document.readyState === 'complete') {
      // Page déjà chargée (cas hot reload / navigations client) — on enclenche
      // au prochain tick pour laisser le browser respirer.
      const id = window.setTimeout(() => onLoad(), 0);
      cleanups.push(() => window.clearTimeout(id));
    } else {
      window.addEventListener('load', onLoad, { once: true });
      cleanups.push(() => window.removeEventListener('load', onLoad));
    }

    // 2. setTimeout — filet de sécurité.
    const timeoutId = window.setTimeout(() => {
      armAndMount('timeout', performance.now() - startedAt);
    }, delayMs);
    cleanups.push(() => window.clearTimeout(timeoutId));

    // 3. requestIdleCallback — si dispo, on monte pendant un idle slot.
    type IdleWindow = Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout?: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleWin = window as IdleWindow;
    if (typeof idleWin.requestIdleCallback === 'function') {
      const idleId = idleWin.requestIdleCallback(
        () => armAndMount('idle', performance.now() - startedAt),
        { timeout: delayMs },
      );
      cleanups.push(() => idleWin.cancelIdleCallback?.(idleId));
    }

    // 4. Interactions utilisateur — l'utilisateur veut quelque chose, on
    //    monte le widget tout de suite.
    function onInteract() {
      armAndMount('interaction', performance.now() - startedAt);
    }
    INTERACTION_EVENTS.forEach((evt) => {
      window.addEventListener(evt, onInteract, {
        once: true,
        passive: true,
      });
    });
    cleanups.push(() => {
      INTERACTION_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, onInteract);
      });
    });

    return () => {
      cleanups.forEach((c) => c());
    };
    // `emit` et `onReady` sont stables côté caller (useCallback / refs) —
    // l'inclure relancerait l'effet à chaque render parent. delayMs reste
    // la seule dépendance pertinente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  if (!ready) return null;
  return <ChatWidgetLazy page={page} />;
}
