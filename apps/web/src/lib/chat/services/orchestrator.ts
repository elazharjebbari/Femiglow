/**
 * CHA-041 — Orchestrator `streamReply`.
 *
 * Pipeline complet d'une réponse :
 *   1. Sanitize + redact PII (entrée user)
 *   2. Détection langue (mirror client)
 *   3. Persistance message user
 *   4. Récup instruction active + mémoire glissante (12 derniers)
 *   5. (Phase 5) RAG retrieve
 *   6. Sélection provider (router + breaker + quota)
 *   7. Streaming → SSE event chunks
 *   8. Persistance message assistant + coût
 *   9. Append events KPI (`message_sent_user`, `message_sent_agent`)
 *
 * cf. docs/chat-assistant/03-backend.md §3.2
 */
import { logger } from '@/lib/logging/logger';

import type { ChatStreamEvent } from '../contracts';
import type {
  ChatProviderMessage,
  ChatStreamRequest,
} from '../providers/types';
import type { ChatMessageRow, ChatSessionRow } from '../db/schema';

import { detectLanguage } from '../lang/detect';
import { eventRepo } from '../repos/event';
import { instructionRepo } from '../repos/instruction';
import { messageRepo } from '../repos/message';
import { providerRepo } from '../repos/provider';
import { sessionRepo } from '../repos/session';

import { providerRouter } from './provider-router';
import { sanitizeAndRedact } from './sanitize';
import { charterFilter } from './charter-filter';
import { detectIntent } from './intent';
import { classifyByEmbedding } from './intent-vector';
import {
  embedTexts,
  EmbeddingProviderUnavailableError,
} from './embeddings';
import { faqRepo } from '../repos/faq';
import { shouldOfferLeadForm } from './lead-decision';
import { notifyHotLead } from './lead-alerts';
import { notifyFrustrationSpike } from './frustration-alerts';
import { detectInlineContact } from './phone-detect';
import { ragService, type RetrievedChunk } from '../rag/service';
import { getRuntimeBool } from '../runtime-setting';
import { leadRepo } from '../repos/lead';
import { env } from '@/lib/env';

const MEMORY_WINDOW = 12;

interface StreamReplyInput {
  session: ChatSessionRow;
  text: string;
  signal?: AbortSignal;
}

export async function* streamReply(
  input: StreamReplyInput,
): AsyncIterable<ChatStreamEvent> {
  const t0 = Date.now();
  const sanitized = sanitizeAndRedact(input.text);
  const language = detectLanguage(sanitized.contentSafe);
  let intentTag = detectIntent(sanitized.contentSafe);
  let intentSource: 'regex' | 'vector' = intentTag === 'misc' ? 'vector' : 'regex';
  const charterIn = charterFilter.inbound(sanitized.contentSafe);
  if (!charterIn.allowed) {
    yield {
      event: 'error',
      data: {
        code: charterIn.reason ?? 'charter-blocked',
        message: charterIn.rewriteHint,
      },
    };
    return;
  }

  // CHA-006 — On embed la question UNE FOIS et on partage le vecteur
  // avec la cascade FAQ (L3) et le classifieur d'intent vectoriel.
  // Si le provider d'embedding est down, on retombe sur regex-only +
  // RAG+LLM (cascade silencieuse — aucune erreur côté visiteuse).
  let questionVector: number[] | null = null;
  try {
    const embedResult = await embedTexts([sanitized.contentSafe]);
    questionVector = embedResult.vectors[0] ?? null;
  } catch (err) {
    if (!(err instanceof EmbeddingProviderUnavailableError)) {
      logger.warn('chat.orchestrator.embed_skipped', {
        sessionId: input.session.id,
        reason: (err as Error).message,
      });
    }
  }

  // Upgrade intent si la regex a échoué (misc) mais que le vecteur
  // matche un centroïde au-dessus du seuil. Le tag upgradé sert :
  //   - aux KPI (`message_sent_user.intent`),
  //   - à `lead-decision` (déclenchement formulaire selon intent),
  //   - aux logs admin.
  if (questionVector && intentTag === 'misc') {
    try {
      const vectorMatch = await classifyByEmbedding(questionVector, language);
      if (vectorMatch) {
        intentTag = vectorMatch.intent;
        logger.info('chat.orchestrator.intent_upgrade', {
          sessionId: input.session.id,
          intent: vectorMatch.intent,
          score: vectorMatch.score,
          sampleCount: vectorMatch.sampleCount,
        });
      }
    } catch (err) {
      logger.warn('chat.orchestrator.intent_vector_failed', {
        sessionId: input.session.id,
        reason: (err as Error).message,
      });
    }
  }
  intentSource = intentTag === 'misc' ? 'vector' : intentSource;

  // Persiste le message user
  const userMessage = await messageRepo.create({
    sessionId: input.session.id,
    role: 'user',
    content: sanitized.contentSafe,
    contentRaw: sanitized.contentRaw,
    contentSafe: sanitized.contentSafe,
    language,
    status: 'sent',
  });
  await eventRepo.append(input.session.id, 'message_sent_user', {
    messageId: userMessage.id,
    redactions: sanitized.redactions,
    intent: intentTag,
    intentSource,
    charter: charterIn.reason ?? null,
  });
  await sessionRepo.update(input.session.id, { language });

  // Récupère instruction et mémoire
  const instruction = await instructionRepo.active('default');
  if (!instruction) {
    yield {
      event: 'error',
      data: { code: 'no-instruction', message: 'No active instruction' },
    };
    return;
  }
  const recent = await messageRepo.recentForMemory(input.session.id, MEMORY_WINDOW);

  // CHAT-066 — Escalade Care si l'utilisateur exprime une frustration
  // récurrente. Non bloquant : `notifyFrustrationSpike` swallow tout
  // (DB down, Slack down) pour préserver la latence first-token.
  if (intentTag === 'frustration') {
    void notifyFrustrationSpike({
      sessionId: input.session.id,
      history: recent.map((m) => ({ role: m.role, content: m.content })),
      currentIntent: intentTag,
      adminBaseUrl: env.NEXT_PUBLIC_SITE_URL,
    });
  }

  // CHA-301 — Cascade L3 : match FAQ vectoriel avant RAG+LLM.
  //
  // Si la question matche une `chat_faq_entry` au-dessus de son
  // threshold (calibré ~0.60 pour text-embedding-3-small), on sert
  // directement la `scripted_reply` sans solliciter le LLM. Économise
  // coût + latence (~400ms vs ~2-4s) et garantit une réponse cohérente
  // éditorialement (textes validés par le PO).
  //
  // Réutilise `questionVector` déjà calculé ci-dessus pour l'intent
  // vectoriel — pas de re-embed.
  try {
    if (questionVector) {
      const faqMatch = await faqRepo.matchByEmbedding(questionVector, {
        language,
        audience: 'all',
      });
      if (faqMatch) {
        const reply = faqMatch.scriptedReply;
        const assistantMessage = await messageRepo.create({
          sessionId: input.session.id,
          role: 'assistant',
          content: reply,
          contentSafe: reply,
          language,
          status: 'sent',
          parentMessageId: userMessage.id,
          modelName: `faq:${faqMatch.key}`,
        });
        const latencyMs = Date.now() - t0;
        await eventRepo.append(input.session.id, 'message_sent_agent', {
          messageId: assistantMessage.id,
          source: 'faq',
          faqKey: faqMatch.key,
          score: faqMatch.score,
          threshold: faqMatch.threshold,
          intentHint: faqMatch.intentHint,
          tokensIn: 0,
          tokensOut: 0,
          latencyMs,
        });
        logger.info('chat.orchestrator.faq_hit', {
          sessionId: input.session.id,
          faqKey: faqMatch.key,
          score: faqMatch.score,
          threshold: faqMatch.threshold,
        });
        yield {
          event: 'start',
          data: { messageId: assistantMessage.id, language },
        };
        yield {
          event: 'chunk',
          data: { messageId: assistantMessage.id, delta: reply },
        };
        yield {
          event: 'end',
          data: { messageId: assistantMessage.id, latencyMs },
        };
        return;
      }
    }
  } catch (err) {
    if (!(err instanceof EmbeddingProviderUnavailableError)) {
      logger.warn('chat.orchestrator.faq_skipped', {
        sessionId: input.session.id,
        reason: (err as Error).message,
      });
    }
  }

  // CHA-097 — RAG retrieve. Si aucune source disponible (pas de
  // provider embedding ou index vide), on continue sans RAG.
  let ragHits: RetrievedChunk[] = [];
  try {
    ragHits = await ragService.retrieve({
      question: sanitized.contentSafe,
      language,
      topK: 4,
    });
  } catch (err) {
    logger.warn('chat.orchestrator.rag_skipped', {
      sessionId: input.session.id,
      reason: (err as Error).message,
    });
  }

  // Construit le contexte LLM
  const systemBody = pickInstructionByLang(instruction, language);
  const ragContext = ragHits.length
    ? `\n\nContexte (sources internes) :\n${ragHits
        .map(
          (h, i) =>
            `[${i + 1}] ${h.sourceLabel}${
              h.sourceUrl ? ` (${h.sourceUrl})` : ''
            }\n${h.content}`,
        )
        .join('\n\n')}`
    : '';
  const messagesForLLM: ChatProviderMessage[] = [
    { role: 'system', content: systemBody + ragContext },
    ...recent
      .filter((m) => m.id !== userMessage.id)
      .map<ChatProviderMessage>((m) => ({
        role: m.role === 'tool' ? 'tool' : (m.role as 'user' | 'assistant' | 'system'),
        content: m.content,
      })),
    { role: 'user', content: sanitized.contentSafe },
  ];

  // Sélectionne provider
  let chosen;
  try {
    chosen = await providerRouter.choose('chat');
  } catch (err) {
    logger.error('chat.orchestrator.no_provider', {
      sessionId: input.session.id,
      error: (err as Error).message,
    });
    yield { event: 'error', data: { code: 'no-provider', message: 'no provider available' } };
    return;
  }
  const { adapter, row } = chosen;

  // Pré-crée un message assistant en streaming
  const assistantMessage = await messageRepo.create({
    sessionId: input.session.id,
    role: 'assistant',
    content: '',
    language,
    status: 'streaming',
    providerId: row.id,
    modelName: row.chatModel,
    parentMessageId: userMessage.id,
  });

  yield { event: 'start', data: { messageId: assistantMessage.id, language } };
  if (ragHits.length > 0) {
    yield {
      event: 'source',
      data: {
        messageId: assistantMessage.id,
        sources: ragHits.map((h) => ({
          chunkId: h.chunkId,
          title: h.sourceLabel,
          url: h.sourceUrl,
          score: h.score,
        })),
      },
    };
  }

  let firstTokenAt: number | null = null;
  let aggregated = '';

  try {
    const req: ChatStreamRequest = {
      messages: messagesForLLM,
      language,
      signal: input.signal,
    };
    const { stream, final } = await adapter.streamChat(req);
    for await (const chunk of stream) {
      if (!chunk.delta) continue;
      if (firstTokenAt == null) firstTokenAt = Date.now();
      aggregated += chunk.delta;
      yield {
        event: 'chunk',
        data: { messageId: assistantMessage.id, delta: chunk.delta },
      };
    }
    const result = await final();
    const latencyMs = Date.now() - t0;
    const firstTokenMs = firstTokenAt ? firstTokenAt - t0 : null;

    // Charter outbound. Si la réponse viole la charte, on conserve la
    // sortie brute mais on la marque (ne réécrit pas en automatique :
    // c'est l'admin qui décidera). Trace KPI dédiée.
    const charterOut = charterFilter.outbound(aggregated);
    if (!charterOut.allowed) {
      await eventRepo.append(input.session.id, 'error', {
        messageId: assistantMessage.id,
        code: 'charter-out',
        reason: charterOut.reason,
        detected: charterOut.detected,
      });
    }

    await messageRepo.update(assistantMessage.id, {
      content: aggregated,
      contentSafe: aggregated,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs,
      firstTokenMs: firstTokenMs ?? undefined,
      cost: result.costEur != null ? String(result.costEur) : null,
      modelName: result.modelName,
      status: 'sent',
      ragHits: ragHits.length
        ? ragHits.map((h) => ({ chunkId: h.chunkId, score: h.score }))
        : null,
    });
    if (result.costEur != null) {
      await providerRepo.incrementConsumed(row.id, result.costEur);
    }
    await eventRepo.append(input.session.id, 'message_sent_agent', {
      messageId: assistantMessage.id,
      providerId: row.id,
      modelName: result.modelName,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs,
    });
    providerRouter.recordSuccess(row.id);

    yield {
      event: 'end',
      data: { messageId: assistantMessage.id, latencyMs },
    };

    // CHA-208 / CHA-225 — Décision lead-form-offer post-réponse. Best-effort :
    // toute erreur ici ne doit pas faire échouer le flux principal.
    //
    // CRITIQUE : on doit utiliser `sanitized.contentRaw` (et non
    // `contentSafe`) pour la détection téléphone, parce que `sanitize`
    // remplace les numéros par `[téléphone]` avant d'envoyer au LLM.
    // Sans ça, le détecteur ne verrait jamais le numéro et on
    // perdrait toujours le lead.
    try {
      const leadEnabled = await getRuntimeBool('lead_form_enabled', true);
      if (leadEnabled) {
        const alreadyOffered = await leadRepo.hasLeadForSession(input.session.id);

        // CHA-225 — Détection du téléphone dans le message BRUT (avant
        // redaction). C'est ce verdict qu'on injecte ensuite dans
        // `lead-decision` pour qu'il choisisse correctement la raison
        // 'inline-contact' (priorité maximale).
        const detection = detectInlineContact(sanitized.contentRaw);
        const phoneDetected =
          detection.phoneE164 != null &&
          (detection.confidence === 'high' || detection.confidence === 'medium');

        // `recent` inclut DÉJÀ `userMessage` (persisté juste avant
        // `recentForMemory`). On ne le pousse PAS une 2e fois (sinon
        // userCount est inflaté, ce qui peut déclencher à tort
        // `after-hours` ou `long-no-progress`). On se contente de
        // substituer son contenu par la version brute pour que la
        // règle 0 (`looksLikePhone`) puisse voir les chiffres.
        const fullHistory = recent.map((m) => ({
          id: m.id,
          role: m.role,
          content:
            m.id === userMessage.id ? sanitized.contentRaw : m.content,
          createdAt: m.createdAt,
        }));
        // Si jamais userMessage n'est pas dans `recent` (cas limite :
        // memory window saturée), on l'ajoute en bout de liste pour
        // que `lastUserMsg` dans lead-decision pointe au bon endroit.
        if (!fullHistory.some((m) => m.id === userMessage.id)) {
          fullHistory.push({
            id: userMessage.id,
            role: userMessage.role,
            content: sanitized.contentRaw,
            createdAt: userMessage.createdAt,
          });
        }

        const decision = shouldOfferLeadForm({
          history: fullHistory,
          currentIntent: intentTag,
          assistantReply: aggregated,
          alreadyOffered,
          enabled: true,
        });
        if (decision.shouldOffer && decision.reason && decision.copyKey) {
          await eventRepo.append(input.session.id, 'chat_lead_form_offered', {
            messageId: assistantMessage.id,
            reason: decision.reason,
            copyKey: decision.copyKey,
          });
          yield {
            event: 'lead-form-offer',
            data: {
              messageId: assistantMessage.id,
              reason: decision.reason,
              copyKey: decision.copyKey,
            },
          };
        }

        // CHA-225 — Filet de sécurité commerciale.
        //
        // Si l'utilisateur a écrit son numéro EN CLAIR dans son dernier
        // message ET qu'aucun lead n'existe encore pour la session, on
        // crée un lead automatique en fallback. Le widget de capture
        // est tout de même proposé (cf. décision ci-dessus, raison
        // 'inline-contact') pour le consent RGPD propre. Si le visiteur
        // ferme la conversation sans soumettre le formulaire, on n'a
        // PAS perdu le lead — c'est précisément le bug reporté par
        // l'utilisateur ("ya rien dans les leads de admin").
        if (!alreadyOffered && phoneDetected) {
          try {
            const snapshotMessages = fullHistory.slice(-6).map((m) => ({
              role:
                m.role === 'assistant'
                  ? ('assistant' as const)
                  : ('user' as const),
              content: m.content.slice(0, 400),
              at: m.createdAt.toISOString(),
            }));
            const autoLead = await leadRepo.create({
              sessionId: input.session.id,
              triggeringMessageId: userMessage.id,
              triggerReason: 'inline-contact',
              firstName: detection.firstName ?? 'Visiteur',
              phoneE164: detection.phoneE164!,
              phoneRaw:
                detection.phoneRaw ?? sanitized.contentRaw.slice(0, 40),
              note: 'Capture automatique — coordonnées détectées dans le chat. À confirmer par l\'agent humain.',
              consentVersion: `${env.CHAT_LEAD_CONSENT_VERSION}+inline-fallback`,
              consentAt: new Date(),
              visitorId: input.session.visitorId,
              fingerprintHash: input.session.fingerprintHash ?? null,
              page: input.session.page ?? null,
              referrer: input.session.referrer ?? null,
              utm: input.session.utm ?? null,
              language,
              intentAtCapture: intentTag,
              snapshotMessages,
            });
            await eventRepo.append(
              input.session.id,
              'chat_lead_auto_created',
              {
                leadId: autoLead.id,
                triggerReason: 'inline-contact',
                confidence: detection.confidence,
                phoneCountry: detection.phoneMeta?.country ?? null,
                source: 'phone-in-chat',
              },
            );
            logger.info('chat.orchestrator.inline_contact_auto_lead', {
              sessionId: input.session.id,
              leadId: autoLead.id,
              confidence: detection.confidence,
            });
            // CHAT-066 — Alerte Slack pour ce lead "chaud" auto-créé.
            void notifyHotLead(autoLead, { adminBaseUrl: env.NEXT_PUBLIC_SITE_URL });
          } catch (err) {
            // On ne casse pas le flux — log + KPI suffisent.
            logger.warn('chat.orchestrator.inline_contact_auto_lead_failed', {
              sessionId: input.session.id,
              error: (err as Error).message,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('chat.orchestrator.lead_decision_failed', {
        sessionId: input.session.id,
        error: (err as Error).message,
      });
    }
  } catch (err) {
    const e = err as { code?: string; message?: string; retryable?: boolean };
    providerRouter.recordFailure(row.id, e.retryable ?? true);
    await messageRepo.update(assistantMessage.id, {
      status: 'error',
      errorCode: e.code ?? 'unknown',
    });
    await eventRepo.append(input.session.id, 'error', {
      messageId: assistantMessage.id,
      providerId: row.id,
      code: e.code ?? 'unknown',
    });
    logger.error('chat.orchestrator.stream_failed', {
      sessionId: input.session.id,
      providerId: row.id,
      code: e.code ?? 'unknown',
      message: e.message,
    });
    yield {
      event: 'error',
      data: {
        messageId: assistantMessage.id,
        code: e.code ?? 'unknown',
        message: e.message,
      },
    };
  }
}

function pickInstructionByLang(
  instruction: { body: string; bodyAr: string | null; bodyArMa: string | null },
  language: string,
): string {
  if (language === 'ar' && instruction.bodyAr) return instruction.bodyAr;
  if (language === 'ar-MA' && instruction.bodyArMa) return instruction.bodyArMa;
  return instruction.body;
}

function _unusedTypeKeeper(_: ChatMessageRow): void {}
