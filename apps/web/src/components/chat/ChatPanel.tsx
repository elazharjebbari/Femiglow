/**
 * CHA-055 / CHA-056 / CHA-244 — `ChatPanel` desktop + mobile.
 *
 * Desktop (≥ sm) : ancré bas-droite, 380×560, bubble.
 * Mobile (< sm)  : sheet full-screen (`inset-0 h-[100dvh]`) — empêche
 *                  le clavier iOS de couvrir le composer et corrige le
 *                  bug d'auto-zoom + perte de visibilité 2026-05-12.
 *
 * CHA-244 — Le panel passe au-dessus du Header et du StickyCartCTA via
 * `--z-chat-overlay: 250`. On verrouille aussi le scroll de la page
 * sous-jacente et on restaure la position au close (cf.
 * docs/admin-config/43-chat-mobile-ux-fix-runbook.md §D).
 *
 * cf. docs/chat-assistant/05-ui-ux-design.md §3.2
 * cf. docs/chat-assistant/21-mobile-ux-plan.md §2 (refactor mobile UX)
 */
'use client';

import { useEffect, useRef } from 'react';

import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { useChatStore } from './chat-store';
import { MessageList } from './MessageList';
import { useChatSession } from './hooks/use-chat-session';

interface ChatPanelProps {
  page?: string;
}

export function ChatPanel({ page }: ChatPanelProps) {
  const isOpen = useChatStore((s) => s.isOpen);
  const language = useChatStore((s) => s.language);
  const close = useChatStore((s) => s.close);
  const panelRef = useRef<HTMLDivElement>(null);
  // CHA-244 — Position scroll de la page sous-jacente, sauvegardée à
  // l'ouverture pour restauration au close (le `overflow: hidden` qu'on
  // pose sur <body> remet le scroll à 0 sur certains navigateurs).
  const savedScrollYRef = useRef<number>(0);

  useChatSession(page);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__chatStore = useChatStore;
    }
  }, []);

  // Esc closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // CHA-244 — Body scroll lock + restauration de la position.
  // À l'ouverture : sauvegarde `scrollY`, pose `overflow: hidden` sur
  // <body>. À la fermeture : retire le lock, restaure `scrollY`.
  // Cleanup au démontage pour ne JAMAIS laisser le body verrouillé si
  // le composant est unmounted pendant `isOpen=true`.
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    savedScrollYRef.current = window.scrollY;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      // `requestAnimationFrame` : on attend que le navigateur ait
      // reflowé sans le lock avant de remettre la position, sinon
      // Safari iOS sauterait au top et ignorerait notre scrollTo.
      window.requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollYRef.current);
      });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isRtl = language === 'ar';
  // Position desktop uniquement : en mobile, `inset-0` couvre tout l'écran
  // et neutralise `right-5` / `left-5`. On garde les variantes `sm:` pour
  // que le bubble desktop se positionne correctement.
  const positionClass = isRtl ? 'sm:left-7' : 'sm:right-7';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Assistant FemiGlow"
      aria-modal="false"
      data-testid="chat-panel"
      // CHA-244 — `data-chat-scope` permet aux styles scopés
      // (polices agrandies) de cibler UNIQUEMENT l'intérieur du chat
      // sans polluer le reste du site. cf. runbook §E.
      data-chat-scope=""
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ zIndex: 'var(--z-chat-overlay)' }}
      className={[
        // ─── Mobile (base) : sheet full-screen ────────────────────────
        'fixed inset-0 h-[100dvh] w-full',
        'flex flex-col overflow-hidden border-0 bg-white shadow-2xl shadow-stone-900/10',
        'overscroll-contain',
        'pb-[env(safe-area-inset-bottom)]',
        // ─── Desktop (≥ sm) : bubble bas-droite 380×560 ───────────────
        'sm:inset-auto sm:bottom-28 sm:h-auto sm:w-[380px]',
        'sm:max-h-[min(560px,calc(100vh-9rem))]',
        'sm:rounded-2xl sm:border sm:border-stone-200',
        'sm:pb-0',
        // ─── Anim commune ─────────────────────────────────────────────
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200',
        positionClass,
      ].join(' ')}
    >
      {/*
        Drag-handle visuel (mobile-only). Indique l'idiome « sheet »
        attendu par les utilisateurs iOS. Pas de drag-to-close JS pour
        la v1 — la croix du header reste le moyen de fermer.
      */}
      <div
        aria-hidden="true"
        data-testid="chat-panel-drag-handle"
        className="sm:hidden mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300"
      />
      <ChatHeader />
      <MessageList />
      <ChatComposer />
    </div>
  );
}
