import { describe, it, expect } from 'vitest';
import {
  stalwartWebhookSchema,
  isHardBounce,
  mapStalwartEventToInternal,
} from '../webhooks/stalwart-parser';

describe('stalwart-parser', () => {
  describe('discriminated union', () => {
    it('parses a delivery.delivered payload', () => {
      const payload = {
        event: 'delivery.delivered',
        queueId: '307018204079726080',
        messageId: '<01HYW@femiglow-maroc.com>',
        rcpt: 'user@gmail.com',
        ts: '2026-05-13T16:00:04Z',
      };
      const parsed = stalwartWebhookSchema.parse(payload);
      expect(parsed.event).toBe('delivery.delivered');
    });

    it('parses delivery.failed with error code', () => {
      const payload = {
        event: 'delivery.failed',
        queueId: 'q1',
        messageId: '<x@x>',
        rcpt: 'bad@example.com',
        errorCode: 550,
        reason: 'mailbox does not exist',
        ts: '2026-05-13T16:00:00Z',
      };
      const parsed = stalwartWebhookSchema.parse(payload);
      expect(parsed.event).toBe('delivery.failed');
    });

    it('parses auth.failed', () => {
      const payload = {
        event: 'auth.failed',
        user: 'noreply@femiglow-maroc.com',
        ip: '1.2.3.4',
        ts: '2026-05-13T16:00:00Z',
      };
      expect(stalwartWebhookSchema.parse(payload).event).toBe('auth.failed');
    });

    it('parses queue.message-queued', () => {
      const payload = {
        event: 'queue.message-queued',
        queueId: 'q1',
        messageId: '<x@x>',
        ts: '2026-05-13T16:00:00Z',
      };
      expect(stalwartWebhookSchema.parse(payload).event).toBe('queue.message-queued');
    });

    it('parses queue.authenticated-message-queued (transactional submission)', () => {
      const payload = {
        event: 'queue.authenticated-message-queued',
        queueId: 'q42',
        messageId: '<app@femi>',
        ts: '2026-05-13T16:00:00Z',
      };
      expect(stalwartWebhookSchema.parse(payload).event).toBe(
        'queue.authenticated-message-queued',
      );
    });

    it('parses queue.rescheduled (temp failure retry)', () => {
      const payload = {
        event: 'queue.rescheduled',
        queueId: 'q1',
        messageId: '<x@x>',
        nextRetry: '2026-05-13T16:30:00Z',
        ts: '2026-05-13T16:00:00Z',
      };
      expect(stalwartWebhookSchema.parse(payload).event).toBe('queue.rescheduled');
    });

    it('accepts payloads with extra unknown fields (passthrough)', () => {
      const payload = {
        event: 'delivery.delivered',
        queueId: 'q1',
        messageId: '<x@x>',
        rcpt: 'a@b.c',
        ts: '2026-05-13T16:00:00Z',
        bonusField: 42,
        nested: { foo: 'bar' },
      };
      expect(stalwartWebhookSchema.parse(payload).event).toBe('delivery.delivered');
    });

    it('accepts unknown event type (passthrough — receiver returns 200 ignored)', () => {
      // The webhook config uses eventsPolicy=exclude with empty events set,
      // so Stalwart sends ALL events. The parser accepts any {event: string};
      // the receiver routes only the known ones to DB and ignores the rest.
      const result = stalwartWebhookSchema.safeParse({
        event: 'acme.auth-start',
        domain: 'femiglow-maroc.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload missing event field', () => {
      const result = stalwartWebhookSchema.safeParse({ queueId: 'x' });
      expect(result.success).toBe(false);
    });

    it('tolerates rcpt as either string or array', () => {
      expect(
        stalwartWebhookSchema.safeParse({
          event: 'delivery.delivered',
          rcpt: ['a@b.c', 'd@e.f'],
        }).success,
      ).toBe(true);
      expect(
        stalwartWebhookSchema.safeParse({
          event: 'delivery.delivered',
          rcpt: 'a@b.c',
        }).success,
      ).toBe(true);
    });
  });

  describe('isHardBounce', () => {
    it('returns true for 5xx codes', () => {
      expect(isHardBounce(550)).toBe(true);
      expect(isHardBounce(553)).toBe(true);
      expect(isHardBounce(599)).toBe(true);
    });

    it('returns false for 4xx (soft)', () => {
      expect(isHardBounce(421)).toBe(false);
      expect(isHardBounce(452)).toBe(false);
    });

    it('returns false for 2xx/3xx (not bounce)', () => {
      expect(isHardBounce(250)).toBe(false);
      expect(isHardBounce(354)).toBe(false);
    });

    it('returns false for 6xx (out of range)', () => {
      expect(isHardBounce(600)).toBe(false);
    });

    it('returns false for undefined (errorCode optional)', () => {
      expect(isHardBounce(undefined)).toBe(false);
    });
  });

  describe('mapStalwartEventToInternal', () => {
    it('maps delivery.delivered → delivered', () => {
      expect(mapStalwartEventToInternal('delivery.delivered')).toBe('delivered');
    });
    it('maps delivery.failed → bounced_hard (refined later)', () => {
      expect(mapStalwartEventToInternal('delivery.failed')).toBe('bounced_hard');
    });
    it('maps queue.* queued events → queued', () => {
      expect(mapStalwartEventToInternal('queue.message-queued')).toBe('queued');
      expect(mapStalwartEventToInternal('queue.authenticated-message-queued')).toBe('queued');
    });
    it('maps queue.rescheduled → retried', () => {
      expect(mapStalwartEventToInternal('queue.rescheduled')).toBe('retried');
    });
    it('returns null for auth.failed (logged elsewhere)', () => {
      expect(mapStalwartEventToInternal('auth.failed')).toBeNull();
    });
  });
});
