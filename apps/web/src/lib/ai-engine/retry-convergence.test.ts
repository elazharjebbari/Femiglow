/**
 * Quality retry loop convergence tests — Gap #15
 *
 * Validates that the quality and moderation retry loops converge
 * (terminate) rather than running infinitely, and that routing
 * decisions are correct at every stage.
 */

import { describe, expect, it } from 'vitest';
import {
  routeAfterQuality,
  routeAfterModeration,
} from './graph/routing';
import type { ContentGenerationStateType } from './graph';

// ---------------------------------------------------------------------------
// Helpers — build minimal state objects for the routing functions
// ---------------------------------------------------------------------------

function makeQualityState(
  scores: Record<string, number>,
  retries: Record<string, number> = {},
): ContentGenerationStateType {
  return {
    qualityScores: scores,
    retries,
  } as unknown as ContentGenerationStateType;
}

function makeModerationState(
  moderationResult: { safe: boolean; flags: string[]; canRetry: boolean } | null,
): ContentGenerationStateType {
  return {
    moderationResult,
  } as unknown as ContentGenerationStateType;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Retry convergence — quality gate', () => {
  it('quality score below threshold triggers retry', () => {
    // Threshold is 0.65 in routing.ts (QUALITY_PASS_THRESHOLD)
    const state = makeQualityState({ average: 0.4 }, { qualityCheck: 0 });
    const route = routeAfterQuality(state);
    expect(route).toBe('retry');
  });

  it('after max retries (2), route returns fail — not infinite loop', () => {
    // MAX_RETRIES_PER_NODE = 2 in routing.ts
    const state = makeQualityState({ average: 0.3 }, { qualityCheck: 2 });
    const route = routeAfterQuality(state);
    expect(route).toBe('fail');
  });

  it('retry counter increments correctly across iterations', () => {
    // Simulate 3 iterations: 0 retries, 1 retry, 2 retries
    const routes: string[] = [];

    for (let attempt = 0; attempt <= 2; attempt++) {
      const state = makeQualityState({ average: 0.3 }, { qualityCheck: attempt });
      routes.push(routeAfterQuality(state));
    }

    expect(routes).toEqual(['retry', 'retry', 'fail']);
  });

  it('with good content, quality passes on first try — no retry', () => {
    const state = makeQualityState({ average: 0.85 }, { qualityCheck: 0 });
    const route = routeAfterQuality(state);
    expect(route).toBe('pass');
  });
});

describe('Retry convergence — moderation gate', () => {
  it('moderation flagged with canRetry triggers flagged route', () => {
    const state = makeModerationState({
      safe: false,
      flags: ['brand:tone'],
      canRetry: true,
    });
    const route = routeAfterModeration(state);
    expect(route).toBe('flagged');
  });

  it('moderation flagged without canRetry blocks — not infinite', () => {
    const state = makeModerationState({
      safe: false,
      flags: ['openai:hate', 'openai:violence', 'brand:blocked'],
      canRetry: false,
    });
    const route = routeAfterModeration(state);
    expect(route).toBe('blocked');
  });
});
