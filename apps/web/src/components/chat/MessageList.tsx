/**
 * CHA-058 — `MessageList`.
 *
 * Affiche les messages dans l'ordre chronologique avec auto-scroll
 * en fin lorsque de nouveaux messages arrivent ou pendant un stream.
 */
'use client';

import { Fragment, useEffect, useRef } from 'react';

import { useChatStore } from './chat-store';
import { LeadFormBubble } from './LeadFormBubble';
import { MessageBubble } from './MessageBubble';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const greeting = useChatStore((s) => s.greeting);
  const suggestions = useChatStore((s) => s.suggestions);
  const language = useChatStore((s) => s.language);
  const error = useChatStore((s) => s.error);
  const leadOfferStatus = useChatStore((s) => s.leadOffer.status);
  const leadOfferMessageId = useChatStore((s) => s.leadOffer.triggeringMessageId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, leadOfferStatus]);

  // Détermine APRÈS quel message afficher la bulle. Par défaut, on
  // l'insère après le message déclencheur. Si l'id n'est pas trouvé
  // (ex. message déjà sorti de la fenêtre), on l'affiche en queue.
  const triggerIdx = leadOfferMessageId
    ? messages.findIndex((m) => m.id === leadOfferMessageId)
    : -1;
  const showLeadFormInline =
    leadOfferStatus !== 'idle' && (triggerIdx >= 0 || leadOfferStatus === 'success');

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      data-testid="chat-message-list"
      className="flex-1 overflow-y-auto bg-stone-50/40 px-3 py-4"
    >
      {messages.length === 0 && greeting && (
        <p
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          className="rounded-xl bg-white px-3 py-2 text-sm text-stone-600 shadow-sm"
        >
          {greeting}
        </p>
      )}
      <ul className="flex flex-col gap-3 mt-3" role="list">
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            <MessageBubble message={m} />
            {showLeadFormInline && i === triggerIdx && (
              <LeadFormBubble language={language} />
            )}
          </Fragment>
        ))}
        {showLeadFormInline && triggerIdx === -1 && (
          <LeadFormBubble language={language} />
        )}
      </ul>
      {suggestions.length > 0 && messages.length === 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <li key={s}>
              <SuggestionPill text={s} />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SuggestionPill({ text }: { text: string }) {
  // CHA-062 — pill cliquable. Pour l'instant : textarea pre-fill.
  return (
    <button
      type="button"
      className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 hover:border-stone-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
      onClick={() => {
        const el = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]');
        if (el) {
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.focus();
        }
      }}
    >
      {text}
    </button>
  );
}
