/**
 * CHA-300 — Service `cannedPairService`.
 *
 * Pipeline déclenché par un clic SuggestionPill côté widget :
 *   1. Charge la session (refuse les sessions archivées/purgées).
 *   2. Résout la `chat_canned_pair` par `key` ; refuse si non publiée.
 *   3. Persiste un `chat_message` user (label cliqué) + assistant (scripted
 *      reply localisée). Statut `sent`, pas de streaming — on imite le rythme
 *      LLM côté client uniquement.
 *   4. Émet l'event `suggestion_clicked` (analytics).
 *
 * Pas de tokens / cost / RAG : ces colonnes restent NULL, ce qui permet
 * d'agréger côté admin « combien de réponses scripted vs LLM ».
 */
import { logger } from '@/lib/logging/logger';

import type {
  ChatCannedPairTriggerInput,
  ChatLanguage,
  ChatMessageDto,
} from '../contracts';
import { cannedPairRepo } from '../repos/canned-pair';
import { eventRepo } from '../repos/event';
import { messageRepo } from '../repos/message';
import { sessionRepo } from '../repos/session';

import { toMessageDto } from './session-service';

export interface CannedPairTriggerResult {
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
  ctaLabel: string | null;
  ctaUrl: string | null;
  allowFollowupLlm: boolean;
}

export class CannedPairError extends Error {
  constructor(public code: 'session-not-found' | 'session-closed' | 'pair-not-found' | 'pair-not-published') {
    super(code);
    this.name = 'CannedPairError';
  }
}

export const cannedPairService = {
  async trigger(input: ChatCannedPairTriggerInput): Promise<CannedPairTriggerResult> {
    const session = await sessionRepo.getById(input.sessionId);
    if (!session) throw new CannedPairError('session-not-found');
    if (session.status !== 'open' && session.status !== 'idle') {
      throw new CannedPairError('session-closed');
    }
    const pair = await cannedPairRepo.getByKey(input.key);
    if (!pair) throw new CannedPairError('pair-not-found');
    if (pair.status !== 'published' || !pair.enabled) {
      throw new CannedPairError('pair-not-published');
    }

    const language = (input.language ?? (session.language as ChatLanguage) ?? 'fr') as ChatLanguage;
    const userLabel = cannedPairRepo.localizedLabel(pair, language);
    const scriptedReply = cannedPairRepo.localizedReply(pair, language);

    const userRow = await messageRepo.create({
      sessionId: session.id,
      role: 'user',
      content: userLabel,
      contentSafe: userLabel,
      language,
      status: 'sent',
    });
    const assistantRow = await messageRepo.create({
      sessionId: session.id,
      role: 'assistant',
      content: scriptedReply,
      contentSafe: scriptedReply,
      language,
      status: 'sent',
      parentMessageId: userRow.id,
    });

    await eventRepo.append(session.id, 'suggestion_clicked', {
      key: pair.key,
      messageId: assistantRow.id,
      language,
    });

    // Touche la session : un clic pill compte comme activité.
    await sessionRepo.touch(session.id);

    logger.info('chat.canned-pair.triggered', {
      sessionId: session.id,
      key: pair.key,
      language,
    });

    return {
      userMessage: toMessageDto(userRow),
      assistantMessage: toMessageDto(assistantRow),
      ctaLabel: pair.ctaLabel,
      ctaUrl: pair.ctaUrl,
      allowFollowupLlm: pair.allowFollowupLlm,
    };
  },
};
