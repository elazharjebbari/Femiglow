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
import { classifyIntent } from './intent';
import { assistantPromisedForm, shouldOfferLeadForm } from './lead-decision';
import { detectInlineContact } from './phone-detect';
import { ragService, type RetrievedChunk } from '../rag/service';
import { getRuntimeBool } from '../runtime-setting';
import { leadRepo } from '../repos/lead';
import { env } from '@/lib/env';
// CHA-230 Phase 2 — Runnables LangChain-style derrière feature flags.
// Quand les flags sont OFF (défaut), le comportement est byte-identique
// à pré-CHA-230. Quand ON, on bénéficie respectivement de la
// classification LLM tool-call (avec fallback regex automatique) et du
// retry+fallback streaming inter-providers.
import {
  isLlmIntentEnabled,
  isProviderFallbackEnabled,
} from '../feature-flag';
import { classifyIntentRunnable } from '../runnables/classify-intent.runnable';
import { respondStreamRunnable } from '../runnables/respond-stream.runnable';
import type { ClassifiedIntent } from '../schemas/intent';

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
  // CHA-230 — Pipeline d'intent : regex toujours, LLM tool-call si flag.
  //  - regexClassif : sortie brute du classifieur regex pondéré (Phase 1).
  //  - classified : sortie du runnable Phase 2 — soit identique au regex
  //    (flag off OU shortcut score≥2 OU panne LLM), soit LLM-corrected.
  // Les deux servent :
  //  - dashboard /admin/chat/quality (Phase 3) : mesure de confiance,
  //  - curator UI (Phase 3) : filtre des low-confidence à revoir,
  //  - lead-decision : utilise `classified.intent` (peut différer du regex
  //    quand le LLM corrige une formulation ambiguë que regex a ratée).
  const regexClassif = classifyIntent(sanitized.contentSafe);
  const classified = await runIntentPipeline(
    sanitized.contentSafe,
    regexClassif,
    input.signal,
  );
  const intentTag = classified.intent;
  const intentMethod = classified.method;
  const intentConfidence = classified.confidence;
  const charterIn = charterFilter.inbound(sanitized.contentSafe);
  if (!charterIn.allowed) {
    yield {
      event: 'error',
      data: {
        code: charterIn.reason ?? 'charter-blocked',
        message: charterIn.rewriteHint,
        // CHA-230 — charter-blocked n'est PAS retryable : la réponse
        // serait à nouveau bloquée. UI ne propose pas de chip retry.
        retryable: false,
      },
    };
    return;
  }

  // Persiste le message user
  // CHA-230 — On stocke l'intent + méthode + confidence sur la ligne
  // pour alimenter le dashboard /admin/chat/quality (Phase 3) sans
  // avoir à rejouer la classification a posteriori. La confidence
  // est un label `low|medium|high` calculé à partir du score brut :
  // c'est le format que consomme directement le curator UI (Phase 3)
  // pour filtrer "uniquement les low".
  const userMessage = await messageRepo.create({
    sessionId: input.session.id,
    role: 'user',
    content: sanitized.contentSafe,
    contentRaw: sanitized.contentRaw,
    contentSafe: sanitized.contentSafe,
    language,
    status: 'sent',
    intentTag,
    intentMethod,
    intentConfidence,
  });
  await eventRepo.append(input.session.id, 'message_sent_user', {
    messageId: userMessage.id,
    redactions: sanitized.redactions,
    intent: intentTag,
    intentMethod,
    intentScore: regexClassif.score,
    // CHA-230 Phase 2 — `intentReason` n'est pas une colonne ; on le passe
    // dans l'event KPI pour pouvoir le surfacer dans le quality dashboard
    // (Phase 3) sans nouvelle migration.
    intentReason: classified.reason,
    intentConfidence,
    charter: charterIn.reason ?? null,
  });
  await sessionRepo.update(input.session.id, { language });

  // Récupère instruction et mémoire
  const instruction = await instructionRepo.active('default');
  if (!instruction) {
    yield {
      event: 'error',
      data: {
        code: 'no-instruction',
        message: 'No active instruction',
        // CHA-230 — config-issue : pas de retry tant que l'admin
        // n'aura pas réactivé une instruction. Surface comme erreur
        // dure côté UI.
        retryable: false,
      },
    };
    return;
  }
  const recent = await messageRepo.recentForMemory(input.session.id, MEMORY_WINDOW);

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
    yield {
      event: 'error',
      data: {
        code: 'no-provider',
        message: 'no provider available',
        // CHA-230 — Tous les providers sont indisponibles (breaker
        // ouvert ou quota épuisé). Retryable = true car typiquement
        // le breaker se ferme après cooldown (30s par défaut).
        retryable: true,
      },
    };
    return;
  }
  const { adapter, row } = chosen;

  // CHA-230 Phase 2 — Si le flag fallback est activé, on pré-résout un
  // provider secondaire dès maintenant (avant le streaming) — on ne le
  // déclenche qu'en cas de panne du primaire (cf. respond-stream.runnable).
  // Best-effort : un échec ici (aucun secondaire dispo, breaker ouvert) est
  // dégradé en "primary-only retry" — pas une raison de tout arrêter.
  let fallbackAdapter: typeof adapter | null = null;
  if (isProviderFallbackEnabled()) {
    try {
      const fb = await providerRouter.chooseFallback('chat', row.id);
      fallbackAdapter = fb?.adapter ?? null;
    } catch (err) {
      logger.warn('chat.orchestrator.fallback_resolution_failed', {
        sessionId: input.session.id,
        primaryId: row.id,
        error: (err as Error).message,
      });
    }
  }

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
    // CHA-230 Phase 2 — Le runnable enveloppe `streamChat()` avec retry
    // + fallback quand le flag est ON. Quand OFF, il appelle juste
    // `primary.streamChat(req)` sans surcouche → comportement byte-identique
    // à pré-CHA-230 (cf. tests `respond-stream.runnable.test.ts > flag off`).
    const fallbackEnabled = isProviderFallbackEnabled();
    const respondOut = await respondStreamRunnable({
      primaryProvider: adapter,
      fallbackProvider: fallbackAdapter,
      request: req,
      retryFallbackEnabled: fallbackEnabled,
    });
    const { stream, final } = respondOut;
    // Trace KPI les tentatives (utile pour Sentry et le quality dashboard).
    if (fallbackEnabled && respondOut.attempts.length > 1) {
      await eventRepo.append(input.session.id, 'chat_provider_retry_or_fallback', {
        servedBy: respondOut.servedBy,
        attempts: respondOut.attempts.map((a) => ({
          providerId: a.providerId,
          outcome: a.outcome,
          code: a.error?.code,
          durationMs: a.durationMs,
        })),
      });
    }
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

        // CHA-230 v5 — Filet de sécurité « LLM promet le formulaire ».
        // cf. `lead-decision.ts#assistantPromisedForm` pour la politique.
        const llmPromisedForm = !alreadyOffered && assistantPromisedForm(aggregated);

        let finalDecision = decision;
        if (!decision.shouldOffer && llmPromisedForm) {
          logger.warn('chat.orchestrator.lead_safety_net_triggered', {
            sessionId: input.session.id,
            messageId: assistantMessage.id,
            currentIntent: intentTag,
            reason: 'llm-promised-form',
          });
          finalDecision = {
            shouldOffer: true,
            reason: 'manual',
            copyKey: 'manual',
            debug: { ...decision.debug, safetyNet: 'llm-promised-form' },
          };
        }

        if (finalDecision.shouldOffer && finalDecision.reason && finalDecision.copyKey) {
          await eventRepo.append(input.session.id, 'chat_lead_form_offered', {
            messageId: assistantMessage.id,
            reason: finalDecision.reason,
            copyKey: finalDecision.copyKey,
          });
          yield {
            event: 'lead-form-offer',
            data: {
              messageId: assistantMessage.id,
              reason: finalDecision.reason,
              copyKey: finalDecision.copyKey,
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
        // CHA-230 — Propage le retryable décidé côté provider/runnable
        // pour que l'UI puisse afficher un chip "Réessayer" sur les
        // erreurs transitoires (timeout, 5xx, rate-limit) et le
        // masquer sur les erreurs dures (auth, content-filter).
        retryable: e.retryable ?? true,
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

/**
 * CHA-230 — Mappe le score d'intent brut (0+) vers un label `low|medium|
 * high` qu'on persiste sur `chat_message.intent_confidence`.
 *
 * Choix des seuils :
 *   - 0  → 'low'    (intent = 'misc', aucun signal exploitable)
 *   - 1  → 'low'    (1 pattern standard — risque de faux positif)
 *   - 2  → 'medium' (1 pattern strong OU 2 standards — signal net)
 *   - 3+ → 'high'   (combo strong + standard, ou 2× strong — sans ambiguïté)
 *
 * Ces seuils alignent la sortie du regex classifier sur ce que sortira
 * le LLM tool-call en Phase 2 (confidence ∈ [0, 1] mappée → label),
 * pour que le dashboard `/admin/chat/quality` reçoive un signal homogène
 * quel que soit le mode de classification actif.
 */
function scoreToConfidence(score: number): 'low' | 'medium' | 'high' {
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * CHA-230 Phase 2 — Pipeline d'intent unifié (regex + LLM optionnel).
 *
 * - Flag OFF (`CHAT_LLM_INTENT_ENABLED=false`, défaut) : retourne le
 *   résultat regex avec `method: 'regex'` — comportement identique à
 *   pré-CHA-230 Phase 1.
 * - Flag ON sans clé OpenAI : idem (le runnable détecte llmConfig=null
 *   et fait fallback regex direct).
 * - Flag ON avec clé : appelle `classifyIntentRunnable` qui décide :
 *     * Regex shortcut (score ≥ 2) → method 'regex'.
 *     * LLM tool-call valide → method 'llm'.
 *     * LLM corrigé via OutputFixingParser → method 'llm-fixed'.
 *     * Tout panne → fallback regex avec method 'regex'.
 *
 * Garantie : ne throw JAMAIS. En cas de panne LLM, on dégrade au regex
 * sans interrompre le flux principal.
 */
async function runIntentPipeline(
  text: string,
  regexClassif: ReturnType<typeof classifyIntent>,
  signal?: AbortSignal,
): Promise<ClassifiedIntent> {
  // Mode flag-off : court-circuit complet, pas d'allocation runnable.
  if (!isLlmIntentEnabled()) {
    return {
      intent: regexClassif.intent,
      confidence: scoreToConfidence(regexClassif.score),
      method: 'regex',
      regexScore: regexClassif.score > 0 ? regexClassif.score : null,
      reason: null,
    };
  }

  // Mode flag-on : on délègue au runnable. Si pas de clé OpenAI, on passe
  // `null` et le runnable fait fallback regex direct.
  const apiKey = env.CHAT_OPENAI_API_KEY;
  const llmConfig = apiKey ? { apiKey } : null;
  // Le runnable est garanti no-throw — pas de try/catch nécessaire ici,
  // mais on en met un par paranoïa pour blinder l'orchestrator (un bug
  // futur dans le runnable ne doit JAMAIS empêcher la réponse).
  try {
    return await classifyIntentRunnable({
      text,
      regex: regexClassif,
      llmConfig,
      signal,
    });
  } catch (err) {
    logger.warn('chat.orchestrator.intent_pipeline_failed', {
      error: (err as Error).message,
    });
    return {
      intent: regexClassif.intent,
      confidence: scoreToConfidence(regexClassif.score),
      method: 'regex',
      regexScore: regexClassif.score > 0 ? regexClassif.score : null,
      reason: null,
    };
  }
}

function _unusedTypeKeeper(_: ChatMessageRow): void {}
