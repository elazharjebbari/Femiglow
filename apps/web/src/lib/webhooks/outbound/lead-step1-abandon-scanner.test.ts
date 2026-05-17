import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import type { ChatLeadRow } from '@/lib/chat/db/schema';
import {
  setTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';

const chatDbMock = vi.hoisted(() => ({
  chatDb: vi.fn<() => unknown>(() => null),
}));
const dispatchMock = vi.hoisted(() => ({
  dispatchLeadStep1AbandonWebhook: vi.fn(),
}));
const repoMock = vi.hoisted(() => ({
  stampStep1AbandonWebhook: vi.fn(async (_id: string) => {}),
}));

vi.mock('@/lib/chat/db/client', () => ({
  chatDb: chatDbMock.chatDb,
}));
vi.mock('@/lib/checkout/repos/lead-repo', () => ({
  wizardLeadRepo: {
    stampStep1AbandonWebhook: repoMock.stampStep1AbandonWebhook,
  },
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./sources/from-wizard-step1-abandon', () => ({
  dispatchLeadStep1AbandonWebhook: dispatchMock.dispatchLeadStep1AbandonWebhook,
}));

import { scanAndDispatchLeadStep1Abandon } from './lead-step1-abandon-scanner';

function makeLead(id: string): ChatLeadRow {
  const now = new Date('2026-05-14T10:00:00Z');
  return {
    id,
    sessionId: `cs_${id}`,
    triggeringMessageId: null,
    triggerReason: 'purchase-intent',
    firstName: 'Sara',
    phoneE164: '+212612345678',
    phoneRaw: '0612345678',
    note: null,
    consentVersion: '2026-05',
    consentAt: now,
    visitorId: `v_${id}`,
    fingerprintHash: null,
    page: '/kit',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: null,
    snapshotMessages: [],
    webhookStatus: 'pending',
    webhookAttempts: 0,
    webhookLastError: null,
    webhookSentAt: null,
    handledBy: null,
    handledAt: null,
    outcome: 'pending',
    convertedOrderId: null,
    lastName: null,
    email: null,
    emailVerifiedAt: null,
    emailConsent: false,
    shippingCity: null,
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingPostalCode: null,
    shippingCountry: 'MA',
    shippingNotes: null,
    preferredPaymentMethod: null,
    source: 'wizard_kit',
    formId: 'kit',
    formMode: 'wizard_cart',
    variantKey: null,
    gclid: null,
    fbp: null,
    fbc: null,
    cartSnapshot: null,
    cartTotalCents: null,
    cartCurrency: null,
    lastTouchedStep: 'lead',
    leadCapturedAt: now,
    addressCompletedAt: null,
    paymentSelectedAt: null,
    purchasedAt: null,
    abandonWebhookAt: null,
    step2WebhookAt: null,
    step1AbandonWebhookAt: null,
    createdAt: now,
    updatedAt: now,
  } as ChatLeadRow;
}

function mockDbRows(rows: ChatLeadRow[]): void {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(async (_limit: number) => rows),
  };
  chatDbMock.chatDb.mockReturnValue({
    select: vi.fn(() => query),
  });
}

afterEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
});

describe('scanAndDispatchLeadStep1Abandon', () => {
  it('renvoie disabled sans toucher la DB si le setting est off', async () => {
    await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_ENABLED, false);
    const result = await scanAndDispatchLeadStep1Abandon();
    expect(result).toMatchObject({ scanned: 0, disabled: 1, timeoutMinutes: 5 });
    expect(chatDbMock.chatDb).not.toHaveBeenCalled();
  });

  it('retourne vide proprement quand DATABASE_URL/chatDb est absent', async () => {
    const result = await scanAndDispatchLeadStep1Abandon();
    expect(result).toMatchObject({ scanned: 0, sent: 0, failed: 0, skipped: 0, disabled: 0 });
  });

  it('compte sent/failed/skipped/disabled et stamp sent/skipped/disabled', async () => {
    const rows = [makeLead('cl_sent'), makeLead('cl_failed'), makeLead('cl_skipped'), makeLead('cl_disabled')];
    mockDbRows(rows);
    dispatchMock.dispatchLeadStep1AbandonWebhook
      .mockResolvedValueOnce({ status: 'sent', attempts: 1 })
      .mockResolvedValueOnce({ status: 'failed', attempts: 3, lastError: 'http-500' })
      .mockResolvedValueOnce({ status: 'skipped', attempts: 0, lastError: 'invalid-phone:invalid' })
      .mockResolvedValueOnce({ status: 'disabled', attempts: 0, lastError: 'no-endpoint-configured' });

    const result = await scanAndDispatchLeadStep1Abandon({
      limit: 4,
      now: new Date('2026-05-14T10:10:00Z'),
    });

    expect(result).toMatchObject({
      scanned: 4,
      sent: 1,
      failed: 1,
      skipped: 1,
      disabled: 1,
      timeoutMinutes: 5,
    });
    // Stamp on sent, skipped, AND disabled to prevent rescanning disabled leads.
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenCalledTimes(3);
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenNthCalledWith(1, 'cl_sent');
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenNthCalledWith(2, 'cl_skipped');
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenNthCalledWith(3, 'cl_disabled');
  });

  it('continue le batch si un dispatch throw et ne stamp pas la ligne en erreur', async () => {
    mockDbRows([makeLead('cl_throw'), makeLead('cl_ok')]);
    dispatchMock.dispatchLeadStep1AbandonWebhook
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ status: 'sent', attempts: 1 });

    const result = await scanAndDispatchLeadStep1Abandon({ limit: 2 });

    expect(result).toMatchObject({ scanned: 2, sent: 1, failed: 1 });
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenCalledTimes(1);
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenCalledWith('cl_ok');
  });

  it('stamp les leads disabled pour empêcher le rescan', async () => {
    mockDbRows([makeLead('cl_disabled1'), makeLead('cl_disabled2')]);
    dispatchMock.dispatchLeadStep1AbandonWebhook
      .mockResolvedValue({ status: 'disabled', attempts: 0, lastError: 'no-endpoint-configured' });

    const result = await scanAndDispatchLeadStep1Abandon({ limit: 2 });

    expect(result).toMatchObject({ scanned: 2, disabled: 2 });
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenCalledTimes(2);
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenCalledWith('cl_disabled1');
    expect(repoMock.stampStep1AbandonWebhook).toHaveBeenCalledWith('cl_disabled2');
  });

  it('traite les leads inline-contact avec leadCapturedAt null en utilisant COALESCE', async () => {
    const now = new Date('2026-05-14T10:00:00Z');
    const inlineLead: ChatLeadRow = {
      ...makeLead('cl_inline'),
      leadCapturedAt: null,
      createdAt: now,
      triggerReason: 'inline-contact',
    };
    mockDbRows([inlineLead]);
    dispatchMock.dispatchLeadStep1AbandonWebhook.mockResolvedValueOnce({
      status: 'sent',
      attempts: 1,
    });

    const result = await scanAndDispatchLeadStep1Abandon({
      limit: 1,
      now: new Date('2026-05-14T10:10:00Z'),
    });

    expect(result).toMatchObject({ scanned: 1, sent: 1 });
    expect(dispatchMock.dispatchLeadStep1AbandonWebhook).toHaveBeenCalledWith(inlineLead);
  });
});
