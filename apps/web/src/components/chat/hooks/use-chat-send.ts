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
import { detectClientAssistantLeadTrigger } from '../assistant-reply-lead-trigger.client';
import type { ChatLanguage, ChatLeadTriggerReason } from '@/lib/chat/contracts';
import { chatLeadTriggerReasonSchema } from '@/lib/chat/contracts';
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
    // CHA-310 — Toute prise de parole (message libre OU pill) ferme le
    // bloc suggestions pour la session : on entre dans la conversation,
    // les CTAs initiaux n'ont plus leur place.
    state.clearSuggestions();
    state.setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // CHA-231 (gap 1) — Hoisted hors du `try` pour être lisible depuis
    // le `finally` qui réconcilie via /api/chat/lead-status.
    let sawLeadFormOffer = false;

    try {
      // Pipeline : SSE → buffer chunks → cadenceur (humanizeStream)
      // → store. Le cadenceur ajoute jitter + pauses ponctuation pour
      // l'illusion d'un humain qui tape. cf. CHA-078.
      let activeMessageId: string | null = null;
      const chunkQueue: string[] = [];
      const leadOfferMessageIds = new Set<string>();
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
      // CHA-231 (gap 1) — On track si on a vu un `lead-form-offer`
      // pendant le stream. Si NON et que l'utilisateur a clos le panel
      // ou si le SSE a été coupé, on pull /api/chat/lead-status après
      // pour réconcilier l'état. (Hoisted plus haut pour scope `finally`.)

      for await (const ev of readSseStream({
        url: '/api/chat/message',
        body: { sessionId: state.sessionId, text: trimmed },
        signal: controller.signal,
        onInvalidEvent: (info) => {
          // CHA-231 (gap 4) — observable côté télémétrie pour debug.
          emit('chat_sse_invalid_event', {
            session_id: state.sessionId,
            raw_event: info.rawEvent,
            issues: info.issues,
          });
        },
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
          const finalState = useChatStore.getState();
          const assistant = finalState.messages.find((m) => m.id === ev.data.messageId);
          const clientTrigger = assistant
            ? detectClientAssistantLeadTrigger(
                assistant.content,
                (assistant.language ?? finalState.language) as ChatLanguage,
              )
            : null;
          if (
            clientTrigger &&
            !leadOfferMessageIds.has(ev.data.messageId) &&
            finalState.leadOffer.status === 'idle' &&
            finalState.leadCapturedSessionId !== finalState.sessionId
          ) {
            leadOfferMessageIds.add(ev.data.messageId);
            finalState.receiveLeadOffer({
              messageId: ev.data.messageId,
              reason: clientTrigger.reason,
              copyKey: clientTrigger.copyKey,
            });
            emit('chat_lead_form_offered', {
              session_id: state.sessionId,
              message_id: ev.data.messageId,
              reason: clientTrigger.reason,
              copy_key: clientTrigger.copyKey,
              source: clientTrigger.source,
              matched_pattern: clientTrigger.matchedPattern,
            });
          }
        } else if (ev.event === 'lead-form-offer') {
          if (leadOfferMessageIds.has(ev.data.messageId)) continue;
          leadOfferMessageIds.add(ev.data.messageId);
          // CHA-213 — Pousse l'offre dans le store ; affichage géré par <MessageList>.
          // CHA-231 (gap 3) — `force` permet au serveur de bypasser une
          // dismissal antérieure quand l'utilisateur a explicitement
          // re-demandé le formulaire.
          sawLeadFormOffer = true;
          useChatStore.getState().receiveLeadOffer({
            messageId: ev.data.messageId,
            reason: ev.data.reason,
            copyKey: ev.data.copyKey,
            force: ev.data.force ?? false,
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
          // CHA-230 Phase 2 — Payload structuré : on garde `lastUserText`
          // pour permettre au chip "Réessayer" d'envoyer à nouveau le
          // dernier message sans saisie. `retryable` vient du serveur
          // (orchestrator → respond-stream.runnable → ProviderError).
          useChatStore.getState().setError({
            code: ev.data.code ?? 'unknown',
            message: ev.data.message ?? null,
            retryable: ev.data.retryable ?? false,
            lastUserText: trimmed,
          });
          if (ev.data.messageId) useChatStore.getState().endStreaming(ev.data.messageId);
        }
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== 'AbortError') {
        // CHA-230 Phase 2 — Erreur réseau côté client (fetch a throw,
        // SSE coupé, etc.). On considère retryable=true par défaut :
        // c'est typiquement un timeout ou un crash transitoire.
        useChatStore.getState().setError({
          code: 'network',
          message: e.message,
          retryable: true,
          lastUserText: trimmed,
        });
      }
    } finally {
      abortRef.current = null;
      // CHA-231 (gap 1) — Réconciliation post-SSE :
      //   Si le SSE n'a pas livré de `lead-form-offer` (drop réseau,
      //   timeout, throttle Cloudflare…), on pull /api/chat/lead-status
      //   pour vérifier si le serveur en avait un en attente. L'API
      //   retourne au plus 1 offre récente — si elle existe et qu'on
      //   ne l'a pas déjà capturée, on déclenche `receiveLeadOffer`
      //   en différé. Best-effort : toute erreur ici est swallow.
      if (!sawLeadFormOffer && state.sessionId) {
        try {
          const resp = await fetch(
            `/api/chat/lead-status?sessionId=${encodeURIComponent(state.sessionId)}`,
            { credentials: 'include' },
          );
          if (resp.ok) {
            const data = (await resp.json()) as {
              ok: true;
              hasPendingOffer: boolean;
              leadCaptured: boolean;
              lastOffer?: {
                messageId: string;
                reason: string;
                copyKey: string;
                force: boolean;
              };
            };
            if (data.hasPendingOffer && data.lastOffer && !data.leadCaptured) {
              // Validation Zod : on ne fait pas confiance à la valeur
              // brute de `reason` côté serveur (peut être un enum
              // étendu plus tard sans coordination).
              const reasonParsed = chatLeadTriggerReasonSchema.safeParse(
                data.lastOffer.reason,
              );
              if (reasonParsed.success) {
                const reason: ChatLeadTriggerReason = reasonParsed.data;
                useChatStore.getState().receiveLeadOffer({
                  messageId: data.lastOffer.messageId,
                  reason,
                  copyKey: data.lastOffer.copyKey,
                  force: data.lastOffer.force,
                });
                emit('chat_lead_form_recovered', {
                  session_id: state.sessionId,
                  message_id: data.lastOffer.messageId,
                  reason,
                });
              }
            }
          }
        } catch {
          // Network is fucked — pas grave, l'utilisateur retentera.
        }
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, cancel };
}
