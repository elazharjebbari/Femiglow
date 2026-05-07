/**
 * CHA-057 — `ChatHeader`.
 */
'use client';

import { useChatStore } from './chat-store';

export function ChatHeader() {
  const close = useChatStore((s) => s.close);
  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white"
        >
          <span className="text-xs font-medium">FG</span>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-900">Assistante FemiGlow</p>
          <p className="text-[11px] text-stone-500">En ligne · répond en quelques secondes</p>
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="-mr-2 rounded-full p-2 text-stone-500 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  );
}
