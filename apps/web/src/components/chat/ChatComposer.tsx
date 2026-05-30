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

// Phase 9bis — libellés a11y du composer localisés (corrige une fuite FR
// en lecteur d'écran sur /ar).
const COMPOSER_ARIA_FR = { message: 'Message', send: 'Envoyer', stop: 'Stop' };
const COMPOSER_ARIA: Record<
  string,
  { message: string; send: string; stop: string }
> = {
  fr: COMPOSER_ARIA_FR,
  ar: { message: 'رسالة', send: 'إرسال', stop: 'إيقاف' },
  'ar-MA': { message: 'رسالة', send: 'صيفط', stop: 'وقّف' },
};

export function ChatComposer() {
  const language = useChatStore((s) => s.language);
  const aria = COMPOSER_ARIA[language] ?? COMPOSER_ARIA_FR;
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
        CHA-244 — La textarea passe en `text-lg` (18 px) + min-h
        agrandi pour favoriser la frappe en mobile. Le seuil iOS
        anti-zoom est à 16 px : on est largement au-dessus.
        cf. docs/admin-config/43-chat-mobile-ux-fix-runbook.md §E
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
        aria-label={aria.message}
        data-testid="chat-input"
        className="block max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={cancel}
          // 44×44 minimum (WCAG 2.5.5 AAA) — cible tactile confortable.
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg bg-rose-500 px-3 text-base font-medium text-white hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          {aria.stop}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label={aria.send}
          data-testid="chat-send"
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg bg-stone-900 px-3 text-base font-medium text-white transition-colors hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
