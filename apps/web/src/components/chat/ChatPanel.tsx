/**
 * CHA-055 / CHA-056 — `ChatPanel` desktop + mobile.
 *
 * Panel principal du widget. Desktop : ancré bas-droite, 380×560.
 * Mobile : full-screen overlay avec safe-area.
 *
 * cf. docs/chat-assistant/05-ui-ux-design.md §3.2
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
  const positionClass = isRtl ? 'left-5 sm:left-7' : 'right-5 sm:right-7';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Assistant FemiGlow"
      aria-modal="false"
      data-testid="chat-panel"
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'fixed z-40 bottom-24 sm:bottom-28',
        'w-[calc(100%-2.5rem)] sm:w-[380px]',
        'max-h-[min(560px,calc(100vh-9rem))]',
        'flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/10',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200',
        positionClass,
      ].join(' ')}
    >
      <ChatHeader />
      <MessageList />
      <ChatComposer />
    </div>
  );
}
