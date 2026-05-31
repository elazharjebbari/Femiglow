/**
 * Factory `chatFaqEntryFactory` — entité `chat_faq_entry`.
 *
 * Référence schema : `apps/web/src/lib/chat/db/schema.ts:755`
 *
 * IMPORTANT (audit I3) — le schema DB met `threshold.default(0.85)`, mais
 * le commentaire dans `orchestrator.ts:182` indique « calibré ~0.60 pour
 * text-embedding-3-small ». Cette factory utilise **0.60 par défaut** —
 * conforme à la documentation et aux scores réels d'embeddings.
 *
 * Les seeders manquent actuellement ce champ explicite (cf. ticket I3).
 */
import { defineFactory, testId } from './base';
import { faker } from '@faker-js/faker';

export interface ChatFaqEntryLike {
  id: string;
  key: string;
  language: 'fr' | 'ar' | 'ar-MA';
  audience: 'all' | 'b2c' | 'b2b';
  questionCanonical: string;
  questionEmbedding: number[];
  scriptedReply: string;
  intentHint: string | null;
  threshold: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const baseChatFaqEntryFactory = defineFactory<ChatFaqEntryLike>(() => ({
  id: testId('faq'),
  key: `faq-${faker.string.alphanumeric(8)}`,
  language: 'fr',
  audience: 'all',
  questionCanonical: 'Combien coûte le pack ?',
  questionEmbedding: Array.from({ length: 1536 }, () => faker.number.float({ min: -1, max: 1 })),
  scriptedReply: 'Le pack FemiGlow est à 199 MAD, livraison gratuite incluse.',
  intentHint: 'pricing',
  threshold: 0.6,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

export const chatFaqEntryFactory = {
  ...baseChatFaqEntryFactory,
  fr: (overrides: Partial<ChatFaqEntryLike> = {}) =>
    baseChatFaqEntryFactory.build({ language: 'fr', ...overrides }),
  ar: (overrides: Partial<ChatFaqEntryLike> = {}) =>
    baseChatFaqEntryFactory.build({ language: 'ar', ...overrides }),
  arMa: (overrides: Partial<ChatFaqEntryLike> = {}) =>
    baseChatFaqEntryFactory.build({ language: 'ar-MA', ...overrides }),
  highThreshold: (overrides: Partial<ChatFaqEntryLike> = {}) =>
    baseChatFaqEntryFactory.build({ threshold: 0.9, ...overrides }),
  disabled: (overrides: Partial<ChatFaqEntryLike> = {}) =>
    baseChatFaqEntryFactory.build({ enabled: false, ...overrides }),
};
