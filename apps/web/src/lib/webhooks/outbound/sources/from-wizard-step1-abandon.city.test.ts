import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatLeadRow } from '@/lib/chat/db/schema';

const dispatchToAllChannels = vi.fn();
vi.mock('../dispatch-to-all-channels', () => ({ dispatchToAllChannels }));

const { dispatchLeadStep1AbandonWebhook } = await import('./from-wizard-step1-abandon');

const lead = (over: Partial<ChatLeadRow>) =>
  ({ id: 'cl_1', firstName: 'Nadia', phoneE164: '+212612345678', ...over }) as ChatLeadRow;

beforeEach(() => {
  dispatchToAllChannels.mockReset().mockResolvedValue({ status: 'sent', attempts: 1 });
});

describe('lead.step1_abandoned — saisie en cours', () => {
  it('porte la ville et l’adresse déjà enregistrées', async () => {
    await dispatchLeadStep1AbandonWebhook(
      lead({ shippingCity: 'Casablanca', shippingAddressLine1: ' Hay Salam ' }),
    );
    expect(dispatchToAllChannels.mock.calls[0]?.[0].payload).toMatchObject({
      city: 'Casablanca',
      address: 'Hay Salam',
    });
  });

  it('sans saisie : champs absents', async () => {
    await dispatchLeadStep1AbandonWebhook(lead({ shippingCity: null, shippingAddressLine1: '' }));
    const { payload } = dispatchToAllChannels.mock.calls[0]?.[0];
    expect(payload.city).toBeUndefined();
    expect(payload.address).toBeUndefined();
  });
});
