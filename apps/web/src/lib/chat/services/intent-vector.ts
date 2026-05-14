/**
 * CHA-006 — Couche embedding pour la cascade `detectIntent`.
 *
 * Le classifieur regex (`services/intent.ts`) couvre ~80% des messages
 * mais retombe sur `misc` pour les paraphrases inattendues. Cette couche
 * sert d'upgrade : si la regex retourne `misc`, l'orchestrator essaie un
 * match vectoriel contre les centroïdes pré-calculés
 * (`chat_intent_centroid` — 16 centroïdes seedés via `seed-chat-intents`).
 *
 * Seuil calibré pour `text-embedding-3-small` :
 *   - Match parfait sur exemple seed → ~0.85
 *   - Paraphrase courte typique → ~0.55–0.70
 *   - Bruit non lié → < 0.40
 *
 * On garde un seuil bas (0.55) car le top-1 vs top-2 reste très
 * distinctif (cf. calibration FAQ).
 */
import { logger } from '@/lib/logging/logger';

import { intentCentroidRepo } from '../repos/intent';
import type { ChatLanguage } from '../contracts';
import type { ChatIntent } from './intent';

export interface IntentVectorMatch {
  intent: ChatIntent;
  score: number;
  sampleCount: number;
}

/** Seuil absolu sur la cosine similarity (1 - distance). */
export const INTENT_VECTOR_THRESHOLD = 0.55;

/**
 * Cherche le centroid le plus proche du vecteur question. Retourne
 * `null` si aucun match ≥ seuil, ou si l'intent retourné n'est pas un
 * `ChatIntent` valide (defensive — la table peut contenir des labels
 * pas encore connus du code).
 */
export async function classifyByEmbedding(
  vector: number[],
  language: ChatLanguage,
): Promise<IntentVectorMatch | null> {
  const matches = await intentCentroidRepo.match(vector, {
    language,
    limit: 1,
  });
  const top = matches[0];
  if (!top) return null;
  if (top.score < INTENT_VECTOR_THRESHOLD) return null;
  if (!isValidChatIntent(top.intent)) {
    logger.warn('intent_vector.unknown_label', { intent: top.intent });
    return null;
  }
  return {
    intent: top.intent,
    score: top.score,
    sampleCount: top.sampleCount,
  };
}

const VALID_INTENTS = new Set<ChatIntent>([
  'greeting',
  'pricing',
  'shipping',
  'routine',
  'ingredient',
  'order-status',
  'support',
  'objection-price',
  'objection-doubt',
  'social-proof',
  'comparison',
  'b2b',
  'callback-request',
  'frustration',
  'after-hours',
  'purchase-intent',
  'misc',
]);

function isValidChatIntent(label: string): label is ChatIntent {
  return VALID_INTENTS.has(label as ChatIntent);
}
