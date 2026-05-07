/**
 * Tests serverEmit + hasRecentPurchase — fallback purchase_server.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';

import { hasRecentPurchase, serverEmit } from './server-emit';

beforeEach(() => {
  resetMemoryStore();
});

describe('serverEmit', () => {
  it('emits a purchase_server event with consent granted + ecommerce category', async () => {
    const entry = await serverEmit({
      eventName: 'purchase_server',
      eventId: 'pi_test_1',
      pageRoute: '/api/stripe/webhook',
      anonymousId: 'anon_xyz',
      sessionId: 'sess_abc',
      payload: { value: 4900, currency: 'EUR' },
    });
    expect(entry.eventName).toBe('purchase_server');
    expect(entry.eventCategory).toBe('ecommerce');
    expect(entry.consentSnapshot.analytics_storage).toBe('granted');
    expect(entry.isConversion).toBe(true);
    expect(entry.payload.value).toBe(4900);
    // memoryStore contains it
    const fromStore = Array.from(memoryStore().trackingEventsLog.values());
    expect(fromStore).toHaveLength(1);
  });
});

describe('hasRecentPurchase', () => {
  it('returns false when no purchase events exist', async () => {
    const result = await hasRecentPurchase('sess_abc');
    expect(result).toBe(false);
  });

  it('returns true when a purchase already exists for the session', async () => {
    const now = new Date();
    await serverEmit({
      eventName: 'purchase',
      eventId: 'pur_1',
      pageRoute: '/checkout',
      anonymousId: 'anon_xyz',
      sessionId: 'sess_abc',
      receivedAt: new Date(now.getTime() - 5 * 60_000),
    });
    const result = await hasRecentPurchase('sess_abc', now);
    expect(result).toBe(true);
  });

  it('returns true when a purchase_server already exists for the session', async () => {
    const now = new Date();
    await serverEmit({
      eventName: 'purchase_server',
      eventId: 'srv_1',
      pageRoute: '/api/stripe/webhook',
      anonymousId: 'anon_xyz',
      sessionId: 'sess_abc',
      receivedAt: new Date(now.getTime() - 5 * 60_000),
    });
    const result = await hasRecentPurchase('sess_abc', now);
    expect(result).toBe(true);
  });

  it('returns false when purchase is older than lookback window', async () => {
    const now = new Date();
    await serverEmit({
      eventName: 'purchase',
      eventId: 'pur_1',
      pageRoute: '/checkout',
      anonymousId: 'anon_xyz',
      sessionId: 'sess_abc',
      receivedAt: new Date(now.getTime() - 90 * 60_000),
    });
    const result = await hasRecentPurchase('sess_abc', now, 60 * 60_000);
    expect(result).toBe(false);
  });

  it('does not match purchases from other sessions', async () => {
    const now = new Date();
    await serverEmit({
      eventName: 'purchase',
      eventId: 'pur_1',
      pageRoute: '/checkout',
      anonymousId: 'anon_xyz',
      sessionId: 'sess_OTHER',
      receivedAt: new Date(now.getTime() - 5 * 60_000),
    });
    const result = await hasRecentPurchase('sess_abc', now);
    expect(result).toBe(false);
  });
});
