/**
 * Factory `chatLeadFactory` — entité `chat_lead`.
 *
 * Référence schema : `apps/web/src/lib/chat/db/schema.ts:457`
 *
 * Traits :
 *  - `pending()` — lead nouveau, non traité
 *  - `contacted()` — lead contacté par équipe
 *  - `converted()` — lead converti en commande
 *  - `dismissed()` — lead écarté (faux positif, spam, etc.)
 *  - `frustration()` — lead capturé via trigger frustration
 *  - `purchaseIntent()` — lead capturé via trigger purchase-intent
 */
import { defineFactory, testId } from './base';
import { maFirstName, maPhone } from './helpers/ma-aligned';

export interface ChatLeadLike {
  id: string;
  sessionId: string;
  visitorId: string;
  firstName: string;
  phoneE164: string;
  phoneInternal: string;
  identityHash: string;
  consentMarketing: boolean;
  reason: string;
  language: string;
  outcome: 'pending' | 'contacted' | 'converted' | 'dismissed' | 'forgotten';
  handledBy: string | null;
  handledAt: Date | null;
  lastMessage: string | null;
  webhookDeliveredAt: Date | null;
  webhookFailureCount: number;
  forgottenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const baseChatLeadFactory = defineFactory<ChatLeadLike>(() => {
  const now = new Date();
  const phone = maPhone();
  return {
    id: testId('ld'),
    sessionId: testId('cs'),
    visitorId: testId('vis'),
    firstName: maFirstName(),
    phoneE164: phone.replace(/^0/, '+212'),
    phoneInternal: phone,
    identityHash: testId('idh'),
    consentMarketing: true,
    reason: 'purchase-intent',
    language: 'fr',
    outcome: 'pending',
    handledBy: null,
    handledAt: null,
    lastMessage: 'Je voudrais commander le pack',
    webhookDeliveredAt: null,
    webhookFailureCount: 0,
    forgottenAt: null,
    createdAt: now,
    updatedAt: now,
  };
});

export const chatLeadFactory = {
  ...baseChatLeadFactory,
  pending: (overrides: Partial<ChatLeadLike> = {}) =>
    baseChatLeadFactory.build({ outcome: 'pending', ...overrides }),
  contacted: (overrides: Partial<ChatLeadLike> = {}) => {
    const now = new Date();
    return baseChatLeadFactory.build({
      outcome: 'contacted',
      handledBy: 'admin_test',
      handledAt: now,
      ...overrides,
    });
  },
  converted: (overrides: Partial<ChatLeadLike> = {}) => {
    const now = new Date();
    return baseChatLeadFactory.build({
      outcome: 'converted',
      handledBy: 'admin_test',
      handledAt: now,
      ...overrides,
    });
  },
  dismissed: (overrides: Partial<ChatLeadLike> = {}) =>
    baseChatLeadFactory.build({ outcome: 'dismissed', handledAt: new Date(), ...overrides }),
  forgotten: (overrides: Partial<ChatLeadLike> = {}) =>
    baseChatLeadFactory.build({
      outcome: 'forgotten',
      forgottenAt: new Date(),
      firstName: '[forgotten]',
      phoneE164: '[forgotten]',
      phoneInternal: '[forgotten]',
      lastMessage: null,
      ...overrides,
    }),
  frustration: (overrides: Partial<ChatLeadLike> = {}) =>
    baseChatLeadFactory.build({ reason: 'frustration', ...overrides }),
  purchaseIntent: (overrides: Partial<ChatLeadLike> = {}) =>
    baseChatLeadFactory.build({ reason: 'purchase-intent', ...overrides }),
  inlineContact: (overrides: Partial<ChatLeadLike> = {}) =>
    baseChatLeadFactory.build({ reason: 'inline-contact', ...overrides }),
};
