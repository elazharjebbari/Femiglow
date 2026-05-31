import { describe, expect, it } from 'vitest';

import {
  computeAccountHealth,
  computeDraftsAwaitingReview,
  computeJobSuccessRate,
  computeMonthlyAiCost,
  computePostsThisWeek,
  computeTopPerformers,
} from './dashboard';
import type {
  ContentPost,
  ContentGenerationRun,
  ContentPerformanceSnapshot,
} from './types';
import type { SocialAccount, SocialPublishJob } from '@/lib/social-publishing/contracts';

const now = new Date('2026-05-21T12:00:00.000Z');

function post(overrides: Partial<ContentPost>): ContentPost {
  return {
    id: 'po_x',
    draftId: 'cd_x',
    platform: 'instagram',
    format: 'post',
    status: 'published',
    scheduledAt: null,
    publishedAt: now,
    permalink: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ContentPost;
}

function job(overrides: Partial<SocialPublishJob>): SocialPublishJob {
  return {
    id: 'job_x',
    postId: 'po_x',
    accountId: 'acct_a',
    provider: 'postiz',
    platform: 'instagram',
    format: 'post',
    status: 'published',
    idempotencyKey: 'idem_x',
    content: { sourcePostId: 'po_x', platform: 'instagram', format: 'post', caption: '', media: [] },
    scheduledAt: null,
    publishedAt: now,
    lockedAt: null,
    attemptCount: 1,
    lastError: null,
    requestedBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as SocialPublishJob;
}

function account(id: string, overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id,
    provider: 'postiz',
    platform: 'instagram',
    remoteId: `remote_${id}`,
    name: `Account ${id}`,
    status: 'active',
    capabilities: [],
    ...overrides,
  };
}

function run(overrides: Partial<ContentGenerationRun>): ContentGenerationRun {
  return {
    id: 'cr_x',
    ideaId: 'ci_x',
    briefId: null,
    provider: 'openai',
    model: 'gpt-4o-mini',
    promptVersion: 'v1',
    input: {},
    output: {},
    status: 'succeeded',
    costCents: 100,
    errorMessage: null,
    createdBy: null,
    createdAt: now,
    ...overrides,
  } as ContentGenerationRun;
}

describe('computePostsThisWeek', () => {
  it('compte 7 jours glissants et exclut hors fenêtre', () => {
    const today = post({ id: 'a', publishedAt: now });
    const fourDaysAgo = post({ id: 'b', publishedAt: new Date('2026-05-17T12:00:00.000Z') });
    const tenDaysAgo = post({ id: 'c', publishedAt: new Date('2026-05-11T12:00:00.000Z') });
    const draft = post({ id: 'd', status: 'scheduled' });
    const result = computePostsThisWeek([today, fourDaysAgo, tenDaysAgo, draft], now);
    expect(result.total).toBe(2);
    expect(result.dailyCounts).toHaveLength(7);
    expect(result.dailyCounts.find((d) => d.date === '2026-05-21')?.count).toBe(1);
    expect(result.dailyCounts.find((d) => d.date === '2026-05-17')?.count).toBe(1);
  });

  it('renvoie 0 sur tous les jours quand aucune publication', () => {
    const result = computePostsThisWeek([], now);
    expect(result.total).toBe(0);
    expect(result.dailyCounts.every((d) => d.count === 0)).toBe(true);
  });
});

describe('computeJobSuccessRate', () => {
  it('calcule % succès depuis published + failed (ignore queued/draft)', () => {
    const rate = computeJobSuccessRate([
      job({ id: 'a', status: 'published' }),
      job({ id: 'b', status: 'published' }),
      job({ id: 'c', status: 'failed' }),
      job({ id: 'd', status: 'queued' }),
    ]);
    expect(rate).toEqual({ total: 3, published: 2, failed: 1, rate: 67 });
  });

  it('renvoie 0 quand pas de job terminal', () => {
    const rate = computeJobSuccessRate([job({ status: 'queued' })]);
    expect(rate).toEqual({ total: 0, published: 0, failed: 0, rate: 0 });
  });
});

describe('computeMonthlyAiCost', () => {
  it('somme les coûts du mois en cours', () => {
    const thisMonth = run({ id: 'a', costCents: 250, createdAt: new Date('2026-05-12T08:00:00.000Z') });
    const thisMonthAgain = run({ id: 'b', costCents: 100, createdAt: new Date('2026-05-20T08:00:00.000Z') });
    const lastMonth = run({ id: 'c', costCents: 999, createdAt: new Date('2026-04-30T23:00:00.000Z') });
    const cost = computeMonthlyAiCost([thisMonth, thisMonthAgain, lastMonth], now);
    expect(cost).toMatchObject({ cents: 350, runs: 2, monthLabel: '2026-05' });
  });

  it('renvoie 0 quand aucun run sur le mois', () => {
    expect(computeMonthlyAiCost([], now)).toMatchObject({ cents: 0, runs: 0 });
  });
});

describe('computeJobSuccessRate — phase e draft awareness', () => {
  it('exclut les jobs avec content.publishMode=draft du calcul', () => {
    const draftPublished = job({
      id: 'd1',
      status: 'published',
      content: { sourcePostId: 'po_d', platform: 'instagram', format: 'post', caption: '', media: [], publishMode: 'draft' },
    });
    const draftFailed = job({
      id: 'd2',
      status: 'failed',
      content: { sourcePostId: 'po_d', platform: 'instagram', format: 'post', caption: '', media: [], publishMode: 'draft' },
    });
    const realPublished = job({ id: 'r1', status: 'published' });
    const realFailed = job({ id: 'r2', status: 'failed' });
    const rate = computeJobSuccessRate([draftPublished, draftFailed, realPublished, realFailed]);
    expect(rate).toEqual({ total: 2, published: 1, failed: 1, rate: 50 });
  });
});

describe('computeDraftsAwaitingReview', () => {
  it('compte les drafts publiés et calcule l’âge du plus ancien', () => {
    const oldDraft = job({
      id: 'd1',
      status: 'published',
      publishedAt: new Date('2026-05-20T00:00:00.000Z'), // 36h before reference
      content: { sourcePostId: 'po_d', platform: 'instagram', format: 'post', caption: '', media: [], publishMode: 'draft' },
    });
    const newDraft = job({
      id: 'd2',
      status: 'published',
      publishedAt: new Date('2026-05-21T06:00:00.000Z'),
      content: { sourcePostId: 'po_d', platform: 'instagram', format: 'post', caption: '', media: [], publishMode: 'draft' },
    });
    const result = computeDraftsAwaitingReview([oldDraft, newDraft], new Date('2026-05-21T12:00:00.000Z'));
    expect(result).toMatchObject({ count: 2 });
    expect(result.oldestAgeHours).toBeGreaterThanOrEqual(36);
  });

  it('renvoie 0 et oldestAgeHours=null quand aucun draft publié', () => {
    expect(computeDraftsAwaitingReview([job({ status: 'queued' })], now)).toEqual({
      count: 0,
      oldestAgeHours: null,
    });
  });

  it('ignore les drafts non terminaux (queued / failed)', () => {
    const queuedDraft = job({
      id: 'd1',
      status: 'queued',
      content: { sourcePostId: 'po_d', platform: 'instagram', format: 'post', caption: '', media: [], publishMode: 'draft' },
    });
    const failedDraft = job({
      id: 'd2',
      status: 'failed',
      content: { sourcePostId: 'po_d', platform: 'instagram', format: 'post', caption: '', media: [], publishMode: 'draft' },
    });
    expect(computeDraftsAwaitingReview([queuedDraft, failedDraft], now)).toEqual({
      count: 0,
      oldestAgeHours: null,
    });
  });
});

describe('computeTopPerformers', () => {
  function snap(overrides: Partial<ContentPerformanceSnapshot>): ContentPerformanceSnapshot {
    return {
      id: 'cps_x',
      postId: 'po_x',
      source: 'postiz:remote_x:2026-05-22',
      metrics: { engagementRate: 0.1, reach: 100, likes: 8, comments: 2, shares: 0, saves: 0 },
      capturedAt: now,
      ...overrides,
    };
  }

  it('classe par engagementRate décroissant, limite à options.limit', () => {
    const top = computeTopPerformers(
      [
        snap({ id: 'a', postId: 'po_a', metrics: { engagementRate: 0.05, reach: 100, likes: 5 } }),
        snap({ id: 'b', postId: 'po_b', metrics: { engagementRate: 0.12, reach: 80, likes: 9 } }),
        snap({ id: 'c', postId: 'po_c', metrics: { engagementRate: 0.07, reach: 200, likes: 14 } }),
      ],
      { limit: 2 },
    );
    expect(top.map((t) => t.postId)).toEqual(['po_b', 'po_c']);
    expect(top[0]?.engagementRate).toBe(0.12);
  });

  it('ne garde que le snapshot le plus récent par postId', () => {
    const older = new Date('2026-05-20T00:00:00.000Z');
    const newer = new Date('2026-05-21T00:00:00.000Z');
    const top = computeTopPerformers([
      snap({ id: 'a', postId: 'po_a', capturedAt: older, metrics: { engagementRate: 0.05 } }),
      snap({ id: 'a2', postId: 'po_a', capturedAt: newer, metrics: { engagementRate: 0.15 } }),
    ]);
    expect(top).toHaveLength(1);
    expect(top[0]?.engagementRate).toBe(0.15);
  });

  it('ignore les snapshots sans engagementRate', () => {
    const top = computeTopPerformers([
      snap({ id: 'a', postId: 'po_a', metrics: { reach: 100, likes: 5 } }),
    ]);
    expect(top).toHaveLength(0);
  });
});

describe('computeAccountHealth', () => {
  it('renvoie lastSuccess et lastFailure par compte', () => {
    const acctA = account('acct_a');
    const acctB = account('acct_b', { name: 'Account B' });
    const lastSuccess = new Date('2026-05-20T10:00:00.000Z');
    const lastFailure = new Date('2026-05-19T10:00:00.000Z');
    const jobs: SocialPublishJob[] = [
      job({ id: 'j1', accountId: 'acct_a', status: 'published', publishedAt: lastSuccess }),
      job({
        id: 'j2',
        accountId: 'acct_a',
        status: 'failed',
        publishedAt: null,
        updatedAt: lastFailure,
        lastError: { code: 'provider_unavailable', message: '503', retryable: true },
      }),
      // acct_b has no jobs
    ];
    const health = computeAccountHealth([acctA, acctB], jobs);
    expect(health).toHaveLength(2);
    const a = health.find((h) => h.account.id === 'acct_a');
    expect(a).toMatchObject({
      lastSuccessAt: lastSuccess,
      lastFailureAt: lastFailure,
      lastFailureCode: 'provider_unavailable',
    });
    const b = health.find((h) => h.account.id === 'acct_b');
    expect(b).toMatchObject({ lastSuccessAt: null, lastFailureAt: null });
  });
});
