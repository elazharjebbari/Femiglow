import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatLeadRow } from '@/lib/chat/db/schema';

const dispatchToAllChannels = vi.fn();
vi.mock('../dispatch-to-all-channels', () => ({ dispatchToAllChannels }));
vi.mock('@/lib/chat/repos/lead-repo', () => ({
  leadRepo: { markWebhookSent: vi.fn(), markWebhookFailed: vi.fn() },
}));

const { dispatchCartAbandonWebhook } = await import('./from-cart-abandon');
const { dispatchLeadStep1AbandonWebhook } = await import('./from-wizard-step1-abandon');
const { dispatchOrderWebhook } = await import('./from-order');

const lead = (over: Partial<ChatLeadRow>) =>
  ({
    id: 'cl_1',
    firstName: 'Nadia',
    phoneE164: '+212612345678',
    source: 'wizard_kit',
    ...over,
  }) as ChatLeadRow;
const payload = () => dispatchToAllChannels.mock.calls[0]?.[0].payload;

beforeEach(() => {
  dispatchToAllChannels.mockReset().mockResolvedValue({ status: 'sent', attempts: 1 });
});

const order = (over: Partial<ChatLeadRow>) =>
  dispatchOrderWebhook({
    order: { id: 'o_1', totalCents: 13400, currency: 'MAD' },
    items: [{ sku: 'KIT', name: 'Pack', quantity: 1 }],
    lead: lead(over),
    shippingMode: 'standard',
    paymentMethod: 'cod',
  });

describe('webhooks — source Google Ads', () => {
  it('commande : canal et campagne', async () => {
    await order({ gclid: 'abc', utm: { utm_campaign: 'kit-maroc' } });
    expect(payload().source_channel).toBe('google_ads');
    expect(payload().note).toContain('source:Google Ads campagne:kit-maroc');
  });

  it('commande sans Google : canal d’origine', async () => {
    await order({});
    expect(payload().source_channel).toBe('wizard_kit');
    expect(payload().note).not.toContain('Google');
  });

  it('panier abandonné : canal et campagne', async () => {
    await dispatchCartAbandonWebhook(
      lead({ gclid: 'abc', utm: { utm_campaign: 'kit-maroc' } }),
    );
    expect(payload().source_channel).toBe('google_ads');
    expect(payload().note).toContain('cart-abandoned');
    expect(payload().note).toContain('source:Google Ads campagne:kit-maroc');
  });

  it('panier abandonné sans Google : inchangé', async () => {
    await dispatchCartAbandonWebhook(lead({ utm: { utm_source: 'facebook' } }));
    expect(payload().source_channel).toBe('cart-abandon');
    expect(payload().note).not.toContain('Google');
  });

  it('étape 1 abandonnée : canal Google Ads', async () => {
    await dispatchLeadStep1AbandonWebhook(lead({ gclid: 'abc' }));
    expect(payload().source_channel).toBe('google_ads');
    expect(payload().note).toContain('source:Google Ads');
  });

  it('étape 1 abandonnée sans Google : inchangé', async () => {
    await dispatchLeadStep1AbandonWebhook(lead({ formId: 'wizard_kit' }));
    expect(payload().source_channel).toBe('wizard_kit');
  });
});
