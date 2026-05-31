/**
 * Factory `chatMessageFactory` — entité `chat_message`.
 *
 * Référence schema : `apps/web/src/lib/chat/db/schema.ts:193`
 *
 * Traits :
 *  - `userMsg(sessionId, content?)` — message user
 *  - `assistantMsg(sessionId, content?)` — message assistant
 *  - `flagged()` — message marqué bloqué par modération
 *  - `withFeedback(thumbs)` — message avec feedback up/down
 *  - `frustrationSignal()` — message user à signal frustration > 0,7
 */
import { faker } from '@faker-js/faker';
import { defineFactory, testId } from './base';

export interface ChatMessageLike {
  id: string;
  sessionId: string;
  ordinal: number;
  role: 'user' | 'assistant' | 'system';
  status: 'sent' | 'streaming' | 'partial' | 'failed' | 'blocked_input' | 'blocked_output';
  content: string;
  contentRaw: string | null;
  language: string | null;
  intent: string | null;
  intentScore: number | null;
  intentSource: 'regex' | 'vector' | 'llm' | 'fallback' | null;
  redactions: string[] | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  providerKind: string | null;
  providerModel: string | null;
  costEur: number | null;
  ragHits: Array<{ id: string; score: number; label: string }> | null;
  moderationFlagged: boolean | null;
  frustrationScore: number | null;
  createdAt: Date;
}

const baseChatMessageFactory = defineFactory<ChatMessageLike>(() => ({
  id: testId('cm'),
  sessionId: testId('cs'),
  ordinal: 1,
  role: 'user',
  status: 'sent',
  content: 'Bonjour, je voudrais des infos sur le pack',
  contentRaw: null,
  language: 'fr',
  intent: null,
  intentScore: null,
  intentSource: null,
  redactions: null,
  tokensIn: null,
  tokensOut: null,
  latencyMs: null,
  providerKind: null,
  providerModel: null,
  costEur: null,
  ragHits: null,
  moderationFlagged: false,
  frustrationScore: null,
  createdAt: new Date(),
}));

export const chatMessageFactory = {
  ...baseChatMessageFactory,
  userMsg: (sessionId: string, content?: string, overrides: Partial<ChatMessageLike> = {}) =>
    baseChatMessageFactory.build({
      sessionId,
      role: 'user',
      content: content ?? 'Combien coûte le pack ?',
      ...overrides,
    }),
  assistantMsg: (sessionId: string, content?: string, overrides: Partial<ChatMessageLike> = {}) =>
    baseChatMessageFactory.build({
      sessionId,
      role: 'assistant',
      content: content ?? 'Le pack FemiGlow est à 199 MAD, livraison gratuite incluse.',
      tokensIn: faker.number.int({ min: 30, max: 200 }),
      tokensOut: faker.number.int({ min: 10, max: 80 }),
      latencyMs: faker.number.int({ min: 200, max: 2000 }),
      providerKind: 'openai',
      providerModel: 'gpt-4o-mini',
      costEur: faker.number.float({ min: 0.0005, max: 0.01, fractionDigits: 4 }),
      ...overrides,
    }),
  flagged: (overrides: Partial<ChatMessageLike> = {}) =>
    baseChatMessageFactory.build({
      status: 'blocked_input',
      moderationFlagged: true,
      ...overrides,
    }),
  frustrationSignal: (overrides: Partial<ChatMessageLike> = {}) =>
    baseChatMessageFactory.build({
      role: 'user',
      content: 'Ça ne répond toujours pas à ma question !',
      frustrationScore: 0.85,
      ...overrides,
    }),
  withIntent: (intent: string, source: 'regex' | 'vector' = 'regex', overrides: Partial<ChatMessageLike> = {}) =>
    baseChatMessageFactory.build({
      intent,
      intentScore: 0.92,
      intentSource: source,
      ...overrides,
    }),
};
