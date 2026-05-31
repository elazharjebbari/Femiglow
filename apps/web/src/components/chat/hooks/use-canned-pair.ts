/**
 * CHA-300 — Hook `useCannedPair`.
 *
 * Appelle POST /api/chat/canned-pair et pousse les 2 messages (user puis
 * assistant) dans le store. Le serveur renvoie la `scripted_reply_*`
 * complète en un coup, mais on simule un effet de saisie progressive
 * côté client (cf. CHA-078 / `humanizeStream`) pour rester cohérent
 * avec l'UX des réponses LLM streamées (jitter + pauses ponctuation).
 *
 * Pourquoi pas un simple push après 350 ms ? Parce qu'une bulle qui
 * "pop" d'un coup casse le sentiment de conversation : on perd la
 * lecture progressive qui aide à la rétention + la perception
 * d'authenticité de l'agent.
 */
'use client';

import { useCallback } from 'react';

import type {
  ChatCannedPairLeadCopyKey,
  ChatCannedPairTriggerResponse,
  ChatLeadTriggerReason,
  ChatMessageDto,
} from '@/lib/chat/contracts';
import { useTracking } from '@/lib/tracking/use-tracking';

import { useChatStore } from '../chat-store';
import { humanizeStream } from '../humanize.client';

/**
 * Découpe une réponse canned en tokens "mot + séparateur" pour alimenter
 * `humanizeStream`. On garde les espaces dans le token précédent afin que
 * le cadenceur déclenche aussi sa pause "fin de mot" naturellement.
 */
/**
 * CHA-310 — Mapping `copyKey` → `triggerReason` (le store filtre les
 * raisons « soft » après un dismiss ; les `strong` passent outre).
 */
const COPY_KEY_TO_REASON: Record<ChatCannedPairLeadCopyKey, ChatLeadTriggerReason> = {
  'explicit-request': 'explicit-request',
  'out-of-knowledge': 'out-of-knowledge',
  objection: 'objection-repeat',
  'after-hours': 'after-hours',
  b2b: 'b2b',
  'purchase-intent': 'purchase-intent',
  'inline-contact': 'inline-contact',
  manual: 'manual',
};

async function* tokenizeForTyping(s: string): AsyncIterable<string> {
  // Split en conservant les séparateurs (espaces, ponctuation, retour ligne).
  // Ex: "Salut, ça va ?" → ["Salut", ", ", "ça", " ", "va", " ", "?"]
  const tokens = s.match(/[^\s.!?…؟,;،]+|[\s.!?…؟,;،]+/g) ?? [s];
  for (const t of tokens) {
    if (t) yield t;
  }
}

export function useCannedPair(): {
  triggerPill: (key: string, label: string) => Promise<void>;
} {
  const { emit } = useTracking();
  const triggerPill = useCallback(
    async (key: string, label: string): Promise<void> => {
      const state = useChatStore.getState();
      if (!state.sessionId || state.isStreaming) return;

      const tempUserId = `tmp_${Date.now().toString(36)}`;
      const optimisticUser: ChatMessageDto = {
        id: tempUserId,
        role: 'user',
        content: label,
        language: state.language,
        status: 'sent',
        createdAt: new Date().toISOString(),
      };
      state.pushUserMessage(optimisticUser);
      // CHA-310 — Dès qu'on clique une pill, on retire TOUTES les pills :
      // une fois la conversation engagée, on ne propose plus d'autres CTAs
      // génériques (cf. v2/00-vision/02-conversion-playbook §1 révisé).
      state.clearSuggestions();
      state.setError(null);

      emit('chat_message_sent', {
        session_id: state.sessionId,
        message_index:
          state.messages.filter((m) => m.role === 'user').length + 1,
        chars: label.length,
      });

      try {
        const res = await fetch('/api/chat/canned-pair', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: state.sessionId,
            key,
            language: state.language,
          }),
        });
        if (!res.ok) {
          throw new Error(`canned-pair ${res.status}`);
        }
        const payload = (await res.json()) as ChatCannedPairTriggerResponse;
        const assistant = payload.assistantMessage;

        // Insertion d'une bulle assistant vide en `streaming` puis cadencement
        // côté client (jitter + minTypingMs + pauses ponctuation) pour
        // l'effet de saisie. À la fin on bascule en `sent` et on éteint les
        // suggestions (cf. UX V5/V6 : pas de 2e canned dans la même conv').
        const store = useChatStore.getState();
        store.beginStreaming(assistant.id);

        await humanizeStream(
          tokenizeForTyping(assistant.content),
          (delta) => {
            useChatStore.getState().appendDelta(assistant.id, delta);
          },
        );

        const finalState = useChatStore.getState();
        finalState.endStreaming(assistant.id);
        if (assistant.sources && assistant.sources.length > 0) {
          finalState.setSources(assistant.id, assistant.sources);
        }
        // CHA-310 — Si la pair est marquée `triggers_lead_form`, on
        // ouvre la bulle lead-capture juste sous la réponse assistant.
        // La `copyKey` choisit la variante de copy/CTA (cf. lead-form-copy).
        if (payload.triggersLeadForm) {
          const copyKey: ChatCannedPairLeadCopyKey =
            payload.leadFormCopyKey ?? 'purchase-intent';
          finalState.receiveLeadOffer({
            messageId: assistant.id,
            reason: COPY_KEY_TO_REASON[copyKey],
            copyKey,
          });
        }
      } catch (err) {
        // CHA-230 — `setError` attend un ChatErrorState structuré (cf.
        // réconciliation : l'erreur du store est devenue un objet).
        useChatStore.getState().setError({
          code: 'unknown',
          message: (err as Error).message,
          retryable: false,
          lastUserText: null,
        });
      }
    },
    [emit],
  );
  return { triggerPill };
}
