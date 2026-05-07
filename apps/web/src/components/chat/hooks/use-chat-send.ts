/**
 * CHA-066 / CHA-068 / CHA-213 / CHA-221 — Hook `useChatSend`.
 *
 * Envoie un message via POST /api/chat/message en SSE et met à jour
 * le store au fil des chunks. Gère également :
 *  - L'event `lead-form-offer` (push vers le store leadOffer).
 *  - L'instrumentation tracking (`chat_message_sent/received/complete`).
 */
'use client';

import { useCallback, useRef } from 'react';

import { useChatStore } from '../chat-store';
import { readSseStream } from '../sse-reader';
import { humanizeStream } from '../humanize.client';
import type { ChatLanguage } from '@/lib/chat/contracts';
import { useTracking } from '@/lib/tracking/use-tracking';

export function useChatSend(): {
  send: (text: string) => Promise<void>;
  cancel: () => void;
} {
  const abortRef = useRef<AbortController | null>(null);
  const { emit } = useTracking();

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const state = useChatStore.getState();
    if (!state.sessionId || state.isStreaming) return;
    const sentAt = Date.now();
    const messageIndex = state.messages.filter((m) => m.role === 'user').length + 1;
    emit('chat_message_sent', {
      session_id: state.sessionId,
      message_index: messageIndex,
      chars: trimmed.length,
    });

    const userMessageId = `tmp_${Date.now().toString(36)}`;
    state.pushUserMessage({
      id: userMessageId,
      role: 'user',
      content: trimmed,
      language: state.language,
      status: 'sent',
      createdAt: new Date().toISOString(),
    });
    state.setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Pipeline : SSE → buffer chunks → cadenceur (humanizeStream)
      // → store. Le cadenceur ajoute jitter + pauses ponctuation pour
      // l'illusion d'un humain qui tape. cf. CHA-078.
      let activeMessageId: string | null = null;
      const chunkQueue: string[] = [];
      // Ref-style pour éviter le narrowing TS : la réassignation via le
      // closure du Promise constructor n'est pas tracée par flow analysis.
      const queueResolver: { current: (() => void) | null } = { current: null };
      let endOfStream = false;

      async function* deltaStream(): AsyncIterable<string> {
        while (true) {
          if (chunkQueue.length === 0 && !endOfStream) {
            await new Promise<void>((resolve) => {
              queueResolver.current = resolve;
            });
          }
          while (chunkQueue.length > 0) {
            yield chunkQueue.shift()!;
          }
          if (endOfStream) return;
        }
      }

      const cadenceurDone = humanizeStream(
        deltaStream(),
        (delta) => {
          if (activeMessageId) {
            useChatStore.getState().appendDelta(activeMessageId, delta);
          }
        },
        {},
        { signal: controller.signal },
      );

      let firstTokenAt: number | null = null;

      for await (const ev of readSseStream({
        url: '/api/chat/message',
        body: { sessionId: state.sessionId, text: trimmed },
        signal: controller.signal,
      })) {
        if (ev.event === 'start') {
          if (ev.data.language && ev.data.language !== state.language) {
            useChatStore.getState().setLanguage(ev.data.language as ChatLanguage);
          }
          activeMessageId = ev.data.messageId;
          useChatStore.getState().beginStreaming(ev.data.messageId);
        } else if (ev.event === 'chunk') {
          if (firstTokenAt == null) {
            firstTokenAt = Date.now();
            emit('chat_message_received', {
              session_id: state.sessionId,
              message_id: activeMessageId,
              first_token_ms: firstTokenAt - sentAt,
            });
          }
          chunkQueue.push(ev.data.delta);
          queueResolver.current?.();
          queueResolver.current = null;
        } else if (ev.event === 'source') {
          if (activeMessageId) {
            useChatStore.getState().setSources(activeMessageId, ev.data.sources);
          }
        } else if (ev.event === 'end') {
          endOfStream = true;
          queueResolver.current?.();
          queueResolver.current = null;
          await cadenceurDone;
          useChatStore.getState().endStreaming(ev.data.messageId);
          emit('chat_message_complete', {
            session_id: state.sessionId,
            message_id: ev.data.messageId,
            latency_ms: ev.data.latencyMs,
          });
        } else if (ev.event === 'lead-form-offer') {
          // CHA-213 — Pousse l'offre dans le store ; affichage géré par <MessageList>.
          useChatStore.getState().receiveLeadOffer({
            messageId: ev.data.messageId,
            reason: ev.data.reason,
            copyKey: ev.data.copyKey,
          });
          emit('chat_lead_form_offered', {
            session_id: state.sessionId,
            message_id: ev.data.messageId,
            reason: ev.data.reason,
            copy_key: ev.data.copyKey,
          });
        } else if (ev.event === 'error') {
          endOfStream = true;
          queueResolver.current?.();
          queueResolver.current = null;
          useChatStore.getState().setError(ev.data.code ?? 'unknown');
          if (ev.data.messageId) useChatStore.getState().endStreaming(ev.data.messageId);
        }
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== 'AbortError') {
        useChatStore.getState().setError(e.message);
      }
    } finally {
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, cancel };
}
