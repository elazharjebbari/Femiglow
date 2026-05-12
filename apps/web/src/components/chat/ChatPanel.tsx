/**
 * CHA-055 / CHA-056 — `ChatPanel` desktop + mobile.
 *
 * Desktop (≥ sm) : ancré bas-droite, 380×560, bubble.
 * Mobile (< sm)  : sheet full-screen (`inset-0 h-[100dvh]`) — empêche
 *                  le clavier iOS de couvrir le composer et corrige le
 *                  bug d'auto-zoom + perte de visibilité 2026-05-12.
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

  useChatSession(page);

  // Esc closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

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
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        // ─── Mobile (base) : sheet full-screen ────────────────────────
        'fixed z-40 inset-0 h-[100dvh] w-full',
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
