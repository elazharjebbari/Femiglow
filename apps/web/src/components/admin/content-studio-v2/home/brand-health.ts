/**
 * Phase 6 — Brand health aggregations.
 *
 * Pure functions consumed by the BrandHealthCard. Tested in isolation
 * so the page composition can stay thin.
 */
import type { ContentBrandReview, ContentBrandViolation } from '@/lib/content-studio/types';

export interface BrandHealthSummary {
  /** Average scoreTotal over the lookback window (0 if no review). */
  averageScore: number;
  /** Number of reviews aggregated. */
  reviewCount: number;
  /** Top violations of the past week (count desc, max 3). */
  topViolations: Array<{ rule: string; label: string; count: number }>;
  /** Number of reviews in the past 7 days. */
  weeklyReviewCount: number;
}

export interface BrandHealthOptions {
  /** Lookback window in days for the average score (default 30). */
  lookbackDays?: number;
  /** Lookback window in days for the violations breakdown (default 7). */
  violationsLookbackDays?: number;
  /** Limit on the number of top violations returned (default 3). */
  topLimit?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeBrandHealth(
  reviews: ContentBrandReview[],
  now: Date = new Date(),
  options: BrandHealthOptions = {},
): BrandHealthSummary {
  const lookbackDays = options.lookbackDays ?? 30;
  const violationsLookbackDays = options.violationsLookbackDays ?? 7;
  const topLimit = options.topLimit ?? 3;

  const scoreCutoff = now.getTime() - lookbackDays * DAY_MS;
  const violationCutoff = now.getTime() - violationsLookbackDays * DAY_MS;

  let scoreSum = 0;
  let scoreCount = 0;
  let weeklyReviewCount = 0;
  const violationCounts = new Map<string, { rule: string; label: string; count: number }>();

  for (const review of reviews) {
    const ts = review.createdAt.getTime();
    if (ts >= scoreCutoff) {
      scoreSum += review.scoreTotal;
      scoreCount += 1;
    }
    if (ts >= violationCutoff) {
      weeklyReviewCount += 1;
      for (const violation of review.violations) {
        accumulate(violationCounts, violation);
      }
    }
  }

  const averageScore = scoreCount === 0 ? 0 : Math.round(scoreSum / scoreCount);
  const topViolations = Array.from(violationCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit);

  return {
    averageScore,
    reviewCount: scoreCount,
    topViolations,
    weeklyReviewCount,
  };
}

function accumulate(
  map: Map<string, { rule: string; label: string; count: number }>,
  violation: ContentBrandViolation,
): void {
  const existing = map.get(violation.rule);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(violation.rule, {
    rule: violation.rule,
    label: violation.message || violation.rule,
    count: 1,
  });
}
