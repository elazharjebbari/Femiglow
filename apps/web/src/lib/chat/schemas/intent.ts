/**
 * CHA-230 Phase 2 — Schemas Zod pour la classification d'intent.
 *
 * Source de vérité pour la sortie LLM `tool-calling` du runnable
 * `classify-intent`. Le LLM est forcé de produire un objet conforme
 * à `ZodIntentClassification` ; tout écart est rattrapé par
 * `OutputFixingParser` (cf. §2.3 du plan), puis par un fallback
 * regex en dernier recours.
 *
 * Ces schémas sont aussi exportés pour être réutilisés côté admin
 * (Phase 3 — curator UI) afin d'éditer manuellement les intents
 * avec la même contrainte de typage.
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.2
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum d'intent — DOIT rester strictement aligné avec `ChatIntent`
// (`apps/web/src/lib/chat/services/intent.ts`). On duplique ici parce que
// Zod ne peut pas accepter directement un type union TS ; un test de
// cohérence (cf. `intent.schema.test.ts`) garantit l'alignement.
// ---------------------------------------------------------------------------

export const intentEnumSchema = z.enum([
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
  // CHA-230
  'negotiation',
  'wholesaler',
  'misc',
]);
export type IntentTag = z.infer<typeof intentEnumSchema>;

// ---------------------------------------------------------------------------
// Confidence — label utilisateur final, mappé vers `chat_message.intent_confidence`.
// ---------------------------------------------------------------------------

export const intentConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type IntentConfidence = z.infer<typeof intentConfidenceSchema>;

// ---------------------------------------------------------------------------
// Method — qui a classé ? Utile pour le quality dashboard et le curator UI
// pour distinguer les regex auto-détectés des cas LLM corrigés.
// ---------------------------------------------------------------------------

export const intentMethodSchema = z.enum([
  'regex', // classifieur regex pondéré (Phase 1)
  'llm', // tool-call LLM réussi du premier coup
  'llm-fixed', // tool-call LLM corrigé via OutputFixingParser
  'golden', // entrée golden-set (Phase 3)
  'manual', // tag manuel admin (Phase 3 curator UI)
]);
export type IntentMethod = z.infer<typeof intentMethodSchema>;

// ---------------------------------------------------------------------------
// Sortie LLM tool-call — schéma "wire format" exposé au LLM.
//
// Note : `reason` est volontairement court (≤ 120 chars) et descriptif
// plutôt que conversationnel. Il sert au debug admin, pas à l'utilisateur
// final. On limite la longueur pour borner le coût en tokens.
// ---------------------------------------------------------------------------

export const intentClassificationSchema = z.object({
  intent: intentEnumSchema.describe(
    'The single best-fit intent class for this user message.',
  ),
  confidence: intentConfidenceSchema.describe(
    'Subjective confidence in the classification: high (clearly fits), medium (likely), low (ambiguous).',
  ),
  reason: z
    .string()
    .max(120)
    .describe(
      'Brief justification, max 120 chars. e.g. "Explicit purchase verb in imperative form".',
    ),
});
export type IntentClassification = z.infer<typeof intentClassificationSchema>;

// ---------------------------------------------------------------------------
// Sortie interne du runnable `classify-intent` — englobe la classification
// LLM + le `method` choisi par le runnable selon le chemin pris (regex
// raccourci, LLM nominal, LLM corrigé, fallback). Ce type-là alimente
// directement la persistance `chat_message.intent_*`.
// ---------------------------------------------------------------------------

export interface ClassifiedIntent {
  intent: IntentTag;
  confidence: IntentConfidence;
  method: IntentMethod;
  /** Score brut regex (0+), `null` si chemin LLM pur sans regex préalable. */
  regexScore: number | null;
  /** Justification LLM (≤ 120 chars), `null` si chemin regex pur. */
  reason: string | null;
}
