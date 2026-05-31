/**
 * Factory `chatSessionFactory` — entité `chat_session`.
 *
 * Référence schema : `apps/web/src/lib/chat/db/schema.ts:148-187`
 * Référence doc : `docs/chat-test-strategy-2026-05/01-architecture-test/01-data-strategy.md`
 *
 * Traits :
 *  - `arabic()` — session en arabe classique (ar)
 *  - `darija()` — session en darija (ar-MA)
 *  - `converted()` — session ayant abouti à une commande
 *  - `archived()` / `purged()` — états terminaux
 *  - `withVariant(id)` — A/B variant assigné
 */
import { faker } from '@faker-js/faker';
import { defineFactory, testId } from './base';
import { maCity } from './helpers/ma-aligned';

export interface ChatSessionLike {
  id: string;
  visitorId: string;
  fingerprintHash: string | null;
  language: string;
  page: string | null;
  referrer: string | null;
  utm: Record<string, string> | null;
  instructionVersionId: string;
  themePresetId: string | null;
  experimentVariantId: string | null;
  status: 'open' | 'idle' | 'archived' | 'purged';
  openedAt: Date;
  lastSeenAt: Date;
  archivedAt: Date | null;
  purgedAt: Date | null;
  consent: { essential: true; analytics: boolean; marketing: boolean } | null;
  convertedOrderId: string | null;
  convertedAt: Date | null;
  metaSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const baseChatSessionFactory = defineFactory<ChatSessionLike>(() => {
  const now = new Date();
  return {
    id: testId('cs'),
    visitorId: testId('vis'),
    fingerprintHash: faker.string.alphanumeric(32),
    language: 'fr',
    page: '/kit',
    referrer: 'https://www.instagram.com/',
    utm: null,
    instructionVersionId: testId('ci'),
    themePresetId: null,
    experimentVariantId: null,
    status: 'open',
    openedAt: now,
    lastSeenAt: now,
    archivedAt: null,
    purgedAt: null,
    consent: { essential: true, analytics: true, marketing: false },
    convertedOrderId: null,
    convertedAt: null,
    metaSummary: null,
    createdAt: now,
    updatedAt: now,
  };
});

export const chatSessionFactory = {
  ...baseChatSessionFactory,
  arabic: (overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({ language: 'ar', ...overrides }),
  darija: (overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({ language: 'ar-MA', ...overrides }),
  converted: (overrides: Partial<ChatSessionLike> = {}) => {
    const now = new Date();
    return baseChatSessionFactory.build({
      status: 'archived',
      convertedOrderId: testId('ord'),
      convertedAt: now,
      archivedAt: now,
      ...overrides,
    });
  },
  archived: (overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({ status: 'archived', archivedAt: new Date(), ...overrides }),
  purged: (overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({ status: 'purged', purgedAt: new Date(), ...overrides }),
  withVariant: (variantId: string, overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({ experimentVariantId: variantId, ...overrides }),
  onPath: (page: string, overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({ page, ...overrides }),
  fromCity: (overrides: Partial<ChatSessionLike> = {}) =>
    baseChatSessionFactory.build({
      utm: { utm_source: 'meta', utm_campaign: `city-${maCity().toLowerCase()}` },
      ...overrides,
    }),
};
