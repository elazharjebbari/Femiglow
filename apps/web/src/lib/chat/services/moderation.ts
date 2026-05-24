/**
 * Wrapper OpenAI Moderation API — appliqué en amont (input) et en aval
 * (output) du LLM dans `orchestrator.ts`.
 *
 * Référence : `docs/live-systems-fix-2026-05/06-system-chat-openai.md` § QW2
 *
 * Pourquoi ce module ?
 * ──────────────────────
 * L'audit a identifié que `openai.moderate()` était exposé mais JAMAIS
 * appelé. Seul `charterFilter` (heuristique ~30 mots-clés) filtrait. À
 * grande échelle, cela expose au risque légal + réputation.
 *
 * Stratégie :
 *  - Flag-gated via `LIVE_CHAT_MODERATION` (default 'off' → rétrocompat)
 *  - Fail-soft : si Moderation API down → continue avec log warn (ne
 *    bloque jamais le chat — la heuristique charterFilter reste active)
 *  - Returns structure unifiée pour decision côté orchestrator
 *
 * Tests : `moderation.test.ts` couvre 10 scénarios (flag on/off,
 * flagged categories, fail-soft, timeout, etc.).
 */
import { logger } from '@/lib/logging/logger';
import { LIVE_CHAT_MODERATION } from '@/lib/feature-flags/live-systems';
import type { ChatProvider } from '@/lib/chat/providers/types';

export interface ChatModerationResult {
  /** True si flagged par OpenAI Moderation. */
  flagged: boolean;
  /** Catégories flagged (sexual, violence, hate, harassment, self-harm, etc.). */
  categories: string[];
  /** Scores par catégorie (utile pour debug + ajustement seuils). */
  scores: Record<string, number>;
  /**
   * Source de la décision :
   *  - 'openai' : appel réussi vers Moderation API
   *  - 'fail_soft' : appel échoué (timeout/500), log warn, allow passage
   *  - 'disabled' : flag off → toujours allow
   */
  source: 'openai' | 'fail_soft' | 'disabled';
  /** Latence ms de l'appel (utile pour SLA monitoring). */
  latencyMs: number;
}

const PASS_THROUGH_DISABLED: Omit<ChatModerationResult, 'latencyMs'> = {
  flagged: false,
  categories: [],
  scores: {},
  source: 'disabled',
};

const PASS_THROUGH_FAIL_SOFT: Omit<ChatModerationResult, 'latencyMs'> = {
  flagged: false,
  categories: [],
  scores: {},
  source: 'fail_soft',
};

/**
 * Modère un texte via OpenAI Moderation API.
 *
 * - Si flag OFF → no-op (rétrocompat).
 * - Si OpenAI Moderation timeout/500 → fail-soft (allow + log warn).
 *
 * NE THROW JAMAIS — c'est volontaire : on ne veut pas casser le chat
 * pour un problème de Moderation. La heuristique `charterFilter` reste
 * la garantie minimum.
 */
export async function moderateChatText(
  provider: ChatProvider,
  text: string,
  context: {
    sessionId: string;
    direction: 'inbound' | 'outbound';
  },
): Promise<ChatModerationResult> {
  const t0 = Date.now();

  if (LIVE_CHAT_MODERATION !== 'on') {
    return { ...PASS_THROUGH_DISABLED, latencyMs: Date.now() - t0 };
  }
  if (!text || text.trim().length === 0) {
    return { ...PASS_THROUGH_DISABLED, latencyMs: Date.now() - t0 };
  }

  // ChatProvider.moderate est optionnel (cf. types.ts). Si le provider
  // sélectionné ne le supporte pas (ex: Anthropic adapter), on log et
  // on fait pass-through (équivalent fail-soft).
  if (!provider.moderate) {
    logger.warn('chat.moderation.provider_no_moderate', {
      sessionId: context.sessionId,
    });
    return { ...PASS_THROUGH_FAIL_SOFT, latencyMs: Date.now() - t0 };
  }

  try {
    const result = await provider.moderate({ text });
    return {
      flagged: !!result.flagged,
      categories: result.categories ?? [],
      scores: result.scores ?? {},
      source: 'openai',
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('chat.moderation.failed', {
      sessionId: context.sessionId,
      direction: context.direction,
      error: message,
      latencyMs: Date.now() - t0,
    });
    return { ...PASS_THROUGH_FAIL_SOFT, latencyMs: Date.now() - t0 };
  }
}

/**
 * Détermine si une réponse modérée doit être tronquée / refusée.
 *
 * - Si pas flagged → passage normal
 * - Si flagged sur categories soft (e.g. self-harm advice) → message scripté
 * - Si flagged sur categories hard (sexual/minors, violence/graphic) → refus dur
 */
export function decideOnModeration(
  result: ChatModerationResult,
  direction: 'inbound' | 'outbound',
): {
  action: 'allow' | 'replace_scripted' | 'truncate' | 'reject';
  scriptedMessage?: string;
} {
  if (!result.flagged) return { action: 'allow' };

  const HARD = new Set([
    'sexual/minors',
    'sexual_minors',
    'violence/graphic',
    'violence_graphic',
  ]);
  const hasHard = result.categories.some((c) => HARD.has(c));

  if (direction === 'inbound') {
    return {
      action: 'replace_scripted',
      scriptedMessage:
        'Je ne suis pas en mesure de répondre à cela. Si vous souhaitez parler à notre équipe, laissez-moi vos coordonnées.',
    };
  }

  // Outbound flagged : on tronque la sortie, on demande à l'admin de relire.
  return {
    action: hasHard ? 'reject' : 'truncate',
    scriptedMessage: hasHard
      ? 'Réponse retirée pour raisons éditoriales. Je laisse mon équipe vous recontacter.'
      : undefined,
  };
}
