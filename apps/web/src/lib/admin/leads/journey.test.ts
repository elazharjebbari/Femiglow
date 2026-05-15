import { describe, expect, it } from 'vitest';

import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { computeDataPct, computeLeadJourney } from './journey';

function lead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-14T10:00:00Z');
  return {
    firstName: 'Sara',
    phoneE164: '+212612345678',
    email: null,
    shippingCity: null,
    shippingAddressLine1: null,
    shippingNotes: null,
    preferredPaymentMethod: null,
    purchasedAt: null,
    paymentSelectedAt: null,
    addressCompletedAt: null,
    step1AbandonWebhookAt: null,
    step2WebhookAt: null,
    webhookStatus: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ChatLeadRow;
}

describe('lead journey read model', () => {
  it('calcule le pourcentage de complétion des données', () => {
    expect(computeDataPct(lead())).toBe(29);
    expect(
      computeDataPct(
        lead({
          email: 'sara@example.com',
          shippingCity: 'Marrakech',
          shippingAddressLine1: '12 Rue Test',
          preferredPaymentMethod: 'cod',
        }),
      ),
    ).toBe(86);
  });

  it('dérive stage et statut webhook lisible', () => {
    expect(computeLeadJourney(lead()).stage).toBe('lead');
    expect(computeLeadJourney(lead({ addressCompletedAt: new Date() })).stage).toBe('address');
    expect(computeLeadJourney(lead({ step1AbandonWebhookAt: new Date() }))).toMatchObject({
      stage: 'abandoned_step1',
      webhookSummary: 'step1_abandoned_sent',
    });
    expect(computeLeadJourney(lead({ step2WebhookAt: new Date() }))).toMatchObject({
      webhookSummary: 'step2_sent',
    });
  });
});
