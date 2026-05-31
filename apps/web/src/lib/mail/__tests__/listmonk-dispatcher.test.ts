import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle, type FakeDrizzle } from './_helpers/fake-drizzle';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
}));

import { db as getDb } from '@/lib/db/client';
import { dispatchListmonkEvent } from '../webhooks/listmonk-dispatcher';

describe('listmonk-dispatcher', () => {
  let drizzle: FakeDrizzle;

  beforeEach(() => {
    vi.clearAllMocks();
    drizzle = makeFakeDrizzle();
    vi.mocked(getDb).mockReturnValue(drizzle as never);
  });

  describe('campaign.started', () => {
    it('UPDATEs email_campaign_link.status=sending', async () => {
      await dispatchListmonkEvent({
        event: 'campaign.started',
        data: { id: 42, name: 'Test' },
      } as never);
      expect(drizzle.calls.update).toHaveLength(1);
      const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
      expect(set.status).toBe('sending');
      expect(set.startedAt).toBeInstanceOf(Date);
    });

    it('logs warn when id is missing (no DB write)', async () => {
      await dispatchListmonkEvent({
        event: 'campaign.started',
        data: {},
      } as never);
      expect(drizzle.calls.update).toHaveLength(0);
    });
  });

  describe('campaign.completed', () => {
    it('UPDATEs email_campaign_link with metrics', async () => {
      await dispatchListmonkEvent({
        event: 'campaign.completed',
        data: { id: 42, sent: 100, views: 50, clicks: 10, bounces: 2 },
      } as never);
      const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
      expect(set).toMatchObject({
        status: 'sent',
        sentCount: 100,
        openCount: 50,
        clickCount: 10,
        bounceCount: 2,
      });
      expect(set.finishedAt).toBeInstanceOf(Date);
    });

    it('handles partial metrics (only sent)', async () => {
      await dispatchListmonkEvent({
        event: 'campaign.completed',
        data: { id: 42, sent: 50 },
      } as never);
      const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
      expect(set.sentCount).toBe(50);
      expect(set.status).toBe('sent');
    });
  });

  describe('subscriber.unsubscribed', () => {
    it('inserts suppression + updates subscriber via transaction', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.unsubscribed',
        data: { email: 'A@B.C' },
      } as never);
      // Transaction was invoked
      expect(drizzle.transaction).toHaveBeenCalledTimes(1);
      // Inside the transaction, insert + update were called
      expect(drizzle.calls.insert).toHaveLength(1);
      expect(drizzle.calls.update).toHaveLength(1);
      const ins = drizzle.calls.insert[0]!.values as Record<string, unknown>;
      expect(ins.email).toBe('a@b.c'); // normalized
      expect(ins.reason).toBe('unsubscribe');
      expect(ins.source).toBe('listmonk');
      expect(drizzle.calls.insert[0]!.onConflict).toBe('doNothing');
    });

    it('accepts data.subscriber.email shape', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.unsubscribed',
        data: { subscriber: { email: 'x@y.z' } },
      } as never);
      expect(drizzle.calls.insert).toHaveLength(1);
      const ins = drizzle.calls.insert[0]!.values as { email: string };
      expect(ins.email).toBe('x@y.z');
    });

    it('skips DB write when email missing', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.unsubscribed',
        data: {},
      } as never);
      expect(drizzle.calls.insert).toHaveLength(0);
    });
  });

  describe('subscriber.bounced', () => {
    it('inserts hard_bounce suppression + blocklists subscriber', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.bounced',
        data: { subscriber: { email: 'b@b.c' }, bounce_type: 'hard' },
      } as never);
      expect(drizzle.calls.insert).toHaveLength(1);
      const ins = drizzle.calls.insert[0]!.values as Record<string, unknown>;
      expect(ins.reason).toBe('hard_bounce');
      expect(ins.detail).toBe('listmonk:hard');
      // Update sets status=blocklisted
      const upd = drizzle.calls.update[0]!.set as Record<string, unknown>;
      expect(upd.status).toBe('blocklisted');
    });

    it('uses "unknown" when bounce_type absent', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.bounced',
        data: { email: 'b@b.c' },
      } as never);
      const ins = drizzle.calls.insert[0]!.values as { detail: string };
      expect(ins.detail).toBe('listmonk:unknown');
    });
  });

  describe('subscriber.complained', () => {
    it('inserts complaint suppression', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.complained',
        data: { email: 'c@b.c' },
      } as never);
      expect(drizzle.calls.insert).toHaveLength(1);
      const ins = drizzle.calls.insert[0]!.values as Record<string, unknown>;
      expect(ins.reason).toBe('complaint');
    });
  });

  describe('subscriber.created', () => {
    it('inserts subscriber link (idempotent)', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.created',
        data: { id: 42, email: 'New@b.c' },
      } as never);
      expect(drizzle.calls.insert).toHaveLength(1);
      const ins = drizzle.calls.insert[0]!.values as Record<string, unknown>;
      expect(ins.email).toBe('new@b.c');
      expect(ins.listmonkSubscriberId).toBe(42);
      expect(ins.status).toBe('enabled');
      expect(drizzle.calls.insert[0]!.onConflict).toBe('doNothing');
    });

    it('skips silently when email missing', async () => {
      await dispatchListmonkEvent({
        event: 'subscriber.created',
        data: {},
      } as never);
      expect(drizzle.calls.insert).toHaveLength(0);
    });
  });
});
