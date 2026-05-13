/**
 * CHA-058 — `MessageList`.
 *
 * Affiche les messages dans l'ordre chronologique avec auto-scroll
 * en fin lorsque de nouveaux messages arrivent ou pendant un stream.
 */
'use client';

import { Fragment, useEffect, useRef } from 'react';

import { useChatStore } from './chat-store';
import { useCannedPair } from './hooks/use-canned-pair';
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
  const { triggerPill } = useCannedPair();
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
      // CHA-mobile-ux : `overscroll-contain` empêche le scroll de la
      // liste de bleed-through sur la page sous-jacente en mobile
      // (le sheet `inset-0` couvre toute la viewport, mais sans cette
      // règle, atteindre le top/bottom déclenche un scroll de la page
      // de fond — UX confuse). cf. docs/chat-assistant/21-mobile-ux-plan.md
      className="flex-1 overflow-y-auto overscroll-contain bg-stone-50/40 px-3 py-4"
    >
      {messages.length === 0 && greeting && (
        <p
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          // CHA-244 — Greeting passé en text-base pour cohérence avec les
          // bulles et lisibilité en mobile. cf. runbook §E.
          className="rounded-xl bg-white px-3 py-2.5 text-base text-stone-700 shadow-sm"
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
      {suggestions.length > 0 && (
        // CHA-300 v2 — pills persistantes (cf. dossier-chat-v2/02-conversion-playbook §1).
        // Le guard initial `messages.length === 0` masquait les CTAs dès le 1er
        // message, ce qui faisait chuter le `suggestion_clicked` rate. On garde
        // les pills visibles tant qu'il en reste : chaque clic retire SA pill
        // (cf. `use-canned-pair.ts`) — pas le bloc entier — pour autoriser
        // plusieurs micro-décisions au fil de la conversation.
        <ul
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Suggestions rapides"
        >
          {suggestions.map((s) => (
            <li key={s.key}>
              <SuggestionPill
                pillKey={s.key}
                label={s.label}
                onTrigger={triggerPill}
              />
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

function SuggestionPill({
  pillKey,
  label,
  onTrigger,
}: {
  pillKey: string;
  label: string;
  onTrigger: (key: string, label: string) => void | Promise<void>;
}) {
  // CHA-300 — pill page-aware liée à une `chat_canned_pair`. Le clic appelle
  // POST /api/chat/canned-pair via `useCannedPair`, qui pousse les bulles
  // user + assistant dans le store.
  return (
    <button
      type="button"
      data-pill-key={pillKey}
      className="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm text-stone-700 hover:border-stone-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
      onClick={() => {
        void onTrigger(pillKey, label);
      }}
    >
      {label}
    </button>
  );
}
