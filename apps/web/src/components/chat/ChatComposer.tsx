/**
 * CHA-061 — `ChatComposer`.
 *
 * Textarea auto-grow, Enter pour envoyer, Shift+Enter pour nouvelle ligne.
 */
'use client';

import { useCallback, useRef, useState } from 'react';

import { useChatStore } from './chat-store';
import { useChatSend } from './hooks/use-chat-send';

const PLACEHOLDERS: Record<string, string> = {
  fr: 'Posez votre question…',
  ar: 'اكتب رسالتك…',
  'ar-MA': 'kteb ssoual dyalek…',
};

export function ChatComposer() {
  const language = useChatStore((s) => s.language);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { send, cancel } = useChatSend();
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!value.trim() || isStreaming) return;
      const text = value;
      setValue('');
      await send(text);
    },
    [value, isStreaming, send],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-stone-200 bg-white p-3"
    >
      {/*
        CHA-mobile-ux : la textarea est forcée à `text-base` (16 px) au
        lieu de `text-sm` (14 px) pour empêcher iOS Safari de déclencher
        un auto-zoom systématique sur le focus du champ. Tout input avec
        font-size < 16 px sur iOS = zoom automatique.
        cf. docs/chat-assistant/21-mobile-ux-plan.md §1.2
      */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        rows={1}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        placeholder={PLACEHOLDERS[language] ?? PLACEHOLDERS.fr}
        aria-label="Message"
        data-testid="chat-input"
        className="block max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Envoyer"
          data-testid="chat-send"
          className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12l16-8-6 16-2-7-8-1z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </form>
  );
}
