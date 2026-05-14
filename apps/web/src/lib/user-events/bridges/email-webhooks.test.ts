/**
 * Tests bridges email-webhooks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import {
  bridgeStalwartToUserEvent,
  bridgeListmonkToUserEvent,
} from './email-webhooks';

beforeEach(() => {
  vi.clearAllMocks();
});

function setupSuccessfulInsert() {
  const drizzle = makeFakeDrizzle({
    selectResult: [],
    insertReturning: [{ id: 1, leadId: null }],
  });
  vi.mocked(getDb).mockReturnValue(drizzle as never);
  return drizzle;
}

describe('bridgeStalwartToUserEvent', () => {
  it('maps delivery.delivered → email.delivered', async () => {
    const drizzle = setupSuccessfulInsert();
    const ok = await bridgeStalwartToUserEvent({
      event: 'delivery.delivered',
      rcpt: 'user@example.com',
      messageId: '<msg-1>',
    });
    expect(ok).toBe(true);
    const values = drizzle.calls.insert[0]!.values as { eventName: string; source: string };
    expect(values.eventName).toBe('email.delivered');
    expect(values.source).toBe('email');
  });

  it('maps delivery.failed with 5xx → email.bounced_hard', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeStalwartToUserEvent({
      event: 'delivery.failed',
      rcpt: 'user@example.com',
      errorCode: 550,
      reason: 'mailbox not found',
    });
    const values = drizzle.calls.insert[0]!.values as {
      eventName: string;
      properties: Record<string, unknown>;
    };
    expect(values.eventName).toBe('email.bounced_hard');
    expect(values.properties.errorCode).toBe(550);
    expect(values.properties.reason).toBe('mailbox not found');
  });

  it('maps delivery.failed with 4xx → email.bounced_soft', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeStalwartToUserEvent({
      event: 'delivery.failed',
      rcpt: 'user@example.com',
      errorCode: 421,
      reason: 'try again later',
    });
    const values = drizzle.calls.insert[0]!.values as { eventName: string };
    expect(values.eventName).toBe('email.bounced_soft');
  });

  it('skips event without rcpt', async () => {
    const drizzle = setupSuccessfulInsert();
    const ok = await bridgeStalwartToUserEvent({
      event: 'delivery.delivered',
      rcpt: '',
    });
    expect(ok).toBe(false);
    expect(drizzle.calls.insert).toHaveLength(0);
  });

  it('uses ts from event when provided', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeStalwartToUserEvent({
      event: 'delivery.delivered',
      rcpt: 'user@example.com',
      ts: '2026-05-14T12:00:00Z',
    });
    const values = drizzle.calls.insert[0]!.values as { ts: Date };
    expect(values.ts).toBeInstanceOf(Date);
    expect((values.ts as Date).toISOString()).toBe('2026-05-14T12:00:00.000Z');
  });
});

describe('bridgeListmonkToUserEvent', () => {
  it('maps subscriber.created → newsletter.subscribed', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeListmonkToUserEvent({
      event: 'subscriber.created',
      email: 'new@example.com',
    });
    const values = drizzle.calls.insert[0]!.values as { eventName: string; source: string };
    expect(values.eventName).toBe('newsletter.subscribed');
    expect(values.source).toBe('email');
  });

  it('maps subscriber.unsubscribed → email.unsubscribed', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeListmonkToUserEvent({
      event: 'subscriber.unsubscribed',
      email: 'bye@example.com',
    });
    const values = drizzle.calls.insert[0]!.values as { eventName: string };
    expect(values.eventName).toBe('email.unsubscribed');
  });

  it('maps subscriber.bounced → email.bounced_hard with bounceType', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeListmonkToUserEvent({
      event: 'subscriber.bounced',
      email: 'bad@example.com',
      bounceType: 'permanent',
    });
    const values = drizzle.calls.insert[0]!.values as {
      eventName: string;
      properties: Record<string, unknown>;
    };
    expect(values.eventName).toBe('email.bounced_hard');
    expect(values.properties.bounceType).toBe('permanent');
  });

  it('maps subscriber.complained → email.complaint', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeListmonkToUserEvent({
      event: 'subscriber.complained',
      email: 'spam@example.com',
    });
    const values = drizzle.calls.insert[0]!.values as { eventName: string };
    expect(values.eventName).toBe('email.complaint');
  });

  it('skips event without email', async () => {
    const drizzle = setupSuccessfulInsert();
    const ok = await bridgeListmonkToUserEvent({
      event: 'subscriber.created',
      email: '',
    });
    expect(ok).toBe(false);
    expect(drizzle.calls.insert).toHaveLength(0);
  });

  it('merges custom props for subscriber.created', async () => {
    const drizzle = setupSuccessfulInsert();
    await bridgeListmonkToUserEvent({
      event: 'subscriber.created',
      email: 'fan@example.com',
      props: { source: 'newsletter-form', list_id: 42 },
    });
    const values = drizzle.calls.insert[0]!.values as {
      properties: Record<string, unknown>;
    };
    expect(values.properties.source).toBe('newsletter-form');
    expect(values.properties.list_id).toBe(42);
  });
});
