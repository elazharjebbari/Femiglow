import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/chat/repos/event', () => ({ eventRepo: { append: vi.fn() } }));
vi.mock('@/lib/chat/repos/lead', () => ({ leadRepo: { markWebhookFailed: vi.fn(), markWebhookSent: vi.fn() } }));
vi.mock('../settings', () => ({
  getLeadWebhookSettings: vi.fn().mockResolvedValue({ conversationEnabled: false }),
}));
vi.mock('../dispatch-to-all-channels', () => ({
  dispatchToAllChannels: vi.fn().mockResolvedValue({ status: 'sent', attempts: 1, deliveries: [] }),
}));
vi.mock('@/lib/chat/promo-offer', () => ({ getChatPromo: vi.fn() }));

import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { getChatPromo } from '@/lib/chat/promo-offer';
import { dispatchToAllChannels } from '../dispatch-to-all-channels';
import { dispatchChatLeadWebhook } from './from-chat-lead';

const LEAD = {
  id: 'cl_1',
  sessionId: 'cs_1',
  firstName: 'Sara',
  phoneE164: '+212612345678',
  phoneRaw: '0612345678',
  note: null,
  triggerReason: 'purchase-intent',
  intentAtCapture: 'purchase-intent',
  snapshotMessages: [],
  source: 'chat_widget',
  email: null,
} as unknown as ChatLeadRow;

function payload() {
  return vi.mocked(dispatchToAllChannels).mock.calls.at(-1)![0].payload as Record<string, unknown>;
}

describe('dispatchChatLeadWebhook — offre promo', () => {
  beforeEach(() => vi.mocked(dispatchToAllChannels).mockClear());

  it('offre active : prix remisé, remise, code et note promo envoyés au CRM', async () => {
    vi.mocked(getChatPromo).mockResolvedValue({
      code: 'GLOW99',
      listPriceMad: 199,
      promoPriceMad: 99,
      discountMad: 100,
      currency: 'MAD',
      endsAt: null,
    });
    await dispatchChatLeadWebhook(LEAD);
    expect(payload()).toMatchObject({
      total_price: 99,
      discount_amount: 100,
      coupon_code: 'GLOW99',
      note: 'trigger:purchase-intent | intent:purchase-intent | promo:GLOW99 -100 MAD',
    });
  });

  it('sans offre : aucun champ promo, payload inchangé', async () => {
    vi.mocked(getChatPromo).mockResolvedValue(null);
    await dispatchChatLeadWebhook(LEAD);
    const p = payload();
    expect(p.total_price).toBeUndefined();
    expect(p.coupon_code).toBeUndefined();
    expect(p.note).toBe('trigger:purchase-intent | intent:purchase-intent');
  });

  it('une erreur de lecture de l’offre ne bloque pas le webhook', async () => {
    vi.mocked(getChatPromo).mockRejectedValue(new Error('db down'));
    await dispatchChatLeadWebhook(LEAD);
    expect(payload().coupon_code).toBeUndefined();
  });
});
