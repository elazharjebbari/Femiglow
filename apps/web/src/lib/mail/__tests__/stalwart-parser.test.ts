import { describe, it, expect } from 'vitest';
import {
  stalwartWebhookSchema,
  isHardBounce,
} from '../webhooks/stalwart-parser';

describe('stalwart-parser', () => {
  describe('discriminated union', () => {
    it('parses a message.delivered payload', () => {
      const payload = {
        event: 'message.delivered',
        queueId: '307018204079726080',
        messageId: '<01HYW@femiglow-maroc.com>',
        rcpt: 'user@gmail.com',
        ts: '2026-05-13T16:00:04Z',
      };
      const parsed = stalwartWebhookSchema.parse(payload);
      expect(parsed.event).toBe('message.delivered');
    });

    it('parses message.delivery-failed with error code', () => {
      const payload = {
        event: 'message.delivery-failed',
        queueId: 'q1',
        messageId: '<x@x>',
        rcpt: 'bad@example.com',
        errorCode: 550,
        reason: 'mailbox does not exist',
        ts: '2026-05-13T16:00:00Z',
      };
      const parsed = stalwartWebhookSchema.parse(payload);
      expect(parsed.event).toBe('message.delivery-failed');
      if (parsed.event === 'message.delivery-failed') {
        expect(parsed.errorCode).toBe(550);
      }
    });

    it('parses auth.failure', () => {
      const payload = {
        event: 'auth.failure',
        user: 'noreply@femiglow-maroc.com',
        ip: '1.2.3.4',
        ts: '2026-05-13T16:00:00Z',
      };
      expect(stalwartWebhookSchema.parse(payload).event).toBe('auth.failure');
    });

    it('parses message.queued with rcpt array', () => {
      const payload = {
        event: 'message.queued',
        queueId: 'q1',
        messageId: '<x@x>',
        rcpt: ['a@b.c', 'd@e.f'],
        size: 1024,
        ts: '2026-05-13T16:00:00Z',
      };
      const parsed = stalwartWebhookSchema.parse(payload);
      expect(parsed.event).toBe('message.queued');
    });

    it('rejects payload missing event field', () => {
      const result = stalwartWebhookSchema.safeParse({ queueId: 'x' });
      expect(result.success).toBe(false);
    });

    it('rejects unknown event type', () => {
      const result = stalwartWebhookSchema.safeParse({
        event: 'message.unknown',
        queueId: 'x',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing errorCode on delivery-failed', () => {
      const result = stalwartWebhookSchema.safeParse({
        event: 'message.delivery-failed',
        queueId: 'q',
        messageId: 'm',
        rcpt: 'r@r.r',
        reason: 'x',
        ts: '2026-05-13T16:00:00Z',
      });
      expect(result.success).toBe(false);
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
  });
});
