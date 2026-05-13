import { describe, it, expect } from 'vitest';
import {
  listmonkWebhookSchema,
  isKnownListmonkEvent,
} from '../webhooks/listmonk-parser';

describe('listmonk-parser', () => {
  describe('listmonkWebhookSchema', () => {
    it('parses subscriber.created', () => {
      const r = listmonkWebhookSchema.safeParse({
        event: 'subscriber.created',
        data: { id: 42, email: 'a@b.c', name: 'A B' },
      });
      expect(r.success).toBe(true);
    });

    it('parses subscriber.unsubscribed', () => {
      const r = listmonkWebhookSchema.safeParse({
        event: 'subscriber.unsubscribed',
        data: { id: 42, email: 'a@b.c' },
      });
      expect(r.success).toBe(true);
    });

    it('parses subscriber.bounced with extra fields (passthrough)', () => {
      const r = listmonkWebhookSchema.safeParse({
        event: 'subscriber.bounced',
        data: { subscriber: { email: 'a@b.c' }, bounce_type: 'hard' },
        source: 'listmonk',
        ts: 1234567890,
      });
      expect(r.success).toBe(true);
    });

    it('parses subscriber.complained', () => {
      const r = listmonkWebhookSchema.safeParse({
        event: 'subscriber.complained',
        data: { email: 'a@b.c' },
      });
      expect(r.success).toBe(true);
    });

    it('parses campaign.started', () => {
      const r = listmonkWebhookSchema.safeParse({
        event: 'campaign.started',
        data: { id: 7, name: 'Test' },
      });
      expect(r.success).toBe(true);
    });

    it('parses campaign.completed with metrics', () => {
      const r = listmonkWebhookSchema.safeParse({
        event: 'campaign.completed',
        data: { id: 7, sent: 100, views: 50, clicks: 10, bounces: 2 },
      });
      expect(r.success).toBe(true);
    });

    it('accepts unknown events (passthrough)', () => {
      // The dispatcher will skip via isKnownListmonkEvent — but parser
      // must NOT throw, so we don't lose webhook deliveries.
      const r = listmonkWebhookSchema.safeParse({
        event: 'random.thing',
        data: { foo: 'bar' },
      });
      expect(r.success).toBe(true);
    });

    it('rejects payload without event field', () => {
      const r = listmonkWebhookSchema.safeParse({ data: {} });
      expect(r.success).toBe(false);
    });

    it('rejects malformed top-level (string instead of object)', () => {
      const r = listmonkWebhookSchema.safeParse('not an object');
      expect(r.success).toBe(false);
    });
  });

  describe('isKnownListmonkEvent', () => {
    it.each([
      'subscriber.created',
      'subscriber.updated',
      'subscriber.unsubscribed',
      'subscriber.bounced',
      'subscriber.complained',
      'campaign.started',
      'campaign.completed',
    ] as const)('returns true for %s', (evt) => {
      expect(isKnownListmonkEvent({ event: evt, data: {} } as never)).toBe(true);
    });

    it('returns false for unknown event', () => {
      expect(isKnownListmonkEvent({ event: 'random.thing' } as never)).toBe(false);
    });
  });
});
