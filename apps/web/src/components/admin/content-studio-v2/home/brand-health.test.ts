import { describe, it, expect } from 'vitest';
import { computeBrandHealth } from './brand-health';
import type { ContentBrandReview } from '@/lib/content-studio/types';

function review(partial: Partial<ContentBrandReview>): ContentBrandReview {
  return {
    id: partial.id ?? 'rev_1',
    draftId: partial.draftId ?? 'draft_1',
    status: partial.status ?? 'pass',
    scoreTotal: partial.scoreTotal ?? 80,
    score: partial.score ?? {},
    violations: partial.violations ?? [],
    reviewerId: partial.reviewerId ?? null,
    reviewType: partial.reviewType ?? 'auto',
    rulesVersion: partial.rulesVersion ?? '2026-01',
    createdAt: partial.createdAt ?? new Date('2026-05-22T10:00:00Z'),
  };
}

describe('computeBrandHealth', () => {
  const now = new Date('2026-05-22T12:00:00Z');

  it('returns a zeroed summary for an empty input', () => {
    const summary = computeBrandHealth([], now);
    expect(summary).toEqual({
      averageScore: 0,
      reviewCount: 0,
      topViolations: [],
      weeklyReviewCount: 0,
    });
  });

  it('computes the rolling 30-day average score, ignoring older reviews', () => {
    const summary = computeBrandHealth(
      [
        review({ id: 'r1', scoreTotal: 90, createdAt: new Date('2026-05-21T00:00:00Z') }),
        review({ id: 'r2', scoreTotal: 70, createdAt: new Date('2026-05-10T00:00:00Z') }),
        // 40 days ago — outside the window, must be ignored
        review({ id: 'r3', scoreTotal: 20, createdAt: new Date('2026-04-10T00:00:00Z') }),
      ],
      now,
    );
    expect(summary.averageScore).toBe(80);
    expect(summary.reviewCount).toBe(2);
  });

  it('aggregates the top violations of the past week and limits to 3', () => {
    const summary = computeBrandHealth(
      [
        review({
          id: 'r1',
          createdAt: new Date('2026-05-21T00:00:00Z'),
          violations: [
            { severity: 'warning', rule: 'tone.harsh', message: 'Ton trop dur' },
            { severity: 'warning', rule: 'cta.missing', message: 'CTA absent' },
          ],
        }),
        review({
          id: 'r2',
          createdAt: new Date('2026-05-20T00:00:00Z'),
          violations: [
            { severity: 'warning', rule: 'tone.harsh', message: 'Ton trop dur' },
            { severity: 'blocked', rule: 'banned.word', message: 'Mot banni' },
            { severity: 'warning', rule: 'cta.missing', message: 'CTA absent' },
            { severity: 'warning', rule: 'length.over', message: 'Trop long' },
          ],
        }),
        // 8 days ago — outside the weekly window for violations
        review({
          id: 'r3',
          createdAt: new Date('2026-05-13T00:00:00Z'),
          violations: [
            { severity: 'warning', rule: 'tone.harsh', message: 'Ton trop dur' },
          ],
        }),
      ],
      now,
    );
    expect(summary.weeklyReviewCount).toBe(2);
    expect(summary.topViolations).toHaveLength(3);
    expect(summary.topViolations[0]).toMatchObject({ rule: 'tone.harsh', count: 2 });
    expect(summary.topViolations[1]).toMatchObject({ rule: 'cta.missing', count: 2 });
    expect(summary.topViolations.map((v) => v.rule)).not.toContain('length.over');
  });

  it('respects custom lookbackDays and topLimit options', () => {
    const summary = computeBrandHealth(
      [
        review({ id: 'r1', scoreTotal: 60, createdAt: new Date('2026-05-21T00:00:00Z') }),
        review({ id: 'r2', scoreTotal: 40, createdAt: new Date('2026-05-19T00:00:00Z') }),
        review({ id: 'r3', scoreTotal: 90, createdAt: new Date('2026-04-21T00:00:00Z') }),
      ],
      now,
      { lookbackDays: 7, topLimit: 1 },
    );
    expect(summary.averageScore).toBe(50);
    expect(summary.reviewCount).toBe(2);
  });
});
