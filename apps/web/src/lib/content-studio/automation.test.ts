import { describe, expect, it } from 'vitest';
import {
  extractPostizScheduledAt,
  selectPostizRetryCandidates,
} from './automation';
import type { ContentPostizDelivery } from './types';

describe('content studio automation', () => {
  it('retient uniquement la dernière livraison échouée par post et intégration', () => {
    const olderFailed = delivery({
      id: 'old',
      postId: 'post_1',
      integrationId: 'ig_1',
      status: 'failed',
      createdAt: new Date('2026-05-15T08:00:00.000Z'),
    });
    const newerSent = delivery({
      id: 'sent',
      postId: 'post_1',
      integrationId: 'ig_1',
      status: 'sent',
      createdAt: new Date('2026-05-15T08:05:00.000Z'),
    });
    const retryable = delivery({
      id: 'retryable',
      postId: 'post_2',
      integrationId: 'ig_1',
      status: 'failed',
      request: { date: '2026-05-16T10:30:00.000Z' },
      createdAt: new Date('2026-05-15T08:10:00.000Z'),
    });

    const candidates = selectPostizRetryCandidates({
      failedDeliveries: [retryable, olderFailed],
      allDeliveriesForPosts: [retryable, newerSent, olderFailed],
      limit: 5,
      maxAttempts: 3,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.delivery.id).toBe('retryable');
    expect(candidates[0]?.scheduledAt).toBe('2026-05-16T10:30:00.000Z');
  });

  it('ignore les livraisons qui ont atteint le plafond de tentatives', () => {
    const exhausted = delivery({
      id: 'exhausted',
      status: 'failed',
      attemptCount: 3,
    });

    const candidates = selectPostizRetryCandidates({
      failedDeliveries: [exhausted],
      allDeliveriesForPosts: [exhausted],
      limit: 5,
      maxAttempts: 3,
    });

    expect(candidates).toHaveLength(0);
  });

  it('normalise une date Postiz valide et ignore les dates invalides', () => {
    expect(extractPostizScheduledAt({ date: '2026-05-16T10:30:00.000Z' })).toBe(
      '2026-05-16T10:30:00.000Z',
    );
    expect(extractPostizScheduledAt({ date: 'date-invalide' })).toBeNull();
    expect(extractPostizScheduledAt({})).toBeNull();
  });
});

function delivery(patch: Partial<ContentPostizDelivery>): ContentPostizDelivery {
  return {
    id: 'delivery_1',
    postId: 'post_1',
    integrationId: 'ig_1',
    postizPostId: null,
    status: 'failed',
    request: {},
    response: {},
    attemptCount: 1,
    lastError: 'HTTP 500',
    createdAt: new Date('2026-05-15T08:00:00.000Z'),
    updatedAt: new Date('2026-05-15T08:00:00.000Z'),
    ...patch,
  };
}
