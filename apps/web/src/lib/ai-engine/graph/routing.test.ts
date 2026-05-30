import { describe, expect, it } from 'vitest';
import {
  routeAfterScript,
  routeAfterQuality,
  routeAfterModeration,
  routeAfterHumanReview,
} from './routing';
import type { ContentGenerationStateType } from '../types/state';

/**
 * Minimal mock state builder.
 * We only provide the fields each routing function actually reads.
 */
function mockState(overrides: Partial<ContentGenerationStateType> = {}): ContentGenerationStateType {
  return {
    jobId: 'test-job',
    tenantId: 'test-tenant',
    createdAt: new Date().toISOString(),
    brief: {} as ContentGenerationStateType['brief'],
    platform: 'instagram' as ContentGenerationStateType['platform'],
    format: 'post' as ContentGenerationStateType['format'],
    contentType: 'produit' as ContentGenerationStateType['contentType'],
    knowledgeContext: '',
    trendContext: '',
    brandGuidelines: '',
    performanceContext: '',
    script: null,
    caption: '',
    hashtags: [],
    ctaText: '',
    imagePrompts: [],
    images: [],
    videoPrompts: [],
    videos: [],
    voiceoverScript: null,
    voiceover: null,
    music: null,
    subtitles: null,
    composition: null,
    thumbnails: [],
    exports: {},
    qualityScores: {},
    moderationResult: null,
    humanReview: null,
    currentStep: 'init',
    errors: [],
    retries: {},
    costTracking: { totalCents: 0, breakdown: {}, tokensUsed: {} },
    variants: [],
    selectedVariant: null,
    ...overrides,
  } as ContentGenerationStateType;
}

// ── routeAfterScript ────────────────────────────────────────────────

describe('routeAfterScript', () => {
  it('returns video_flow for format=reel', () => {
    expect(routeAfterScript(mockState({ format: 'reel' as never }))).toBe('video_flow');
  });

  it('returns video_flow for format=story', () => {
    expect(routeAfterScript(mockState({ format: 'story' as never }))).toBe('video_flow');
  });

  it('returns video_flow for format=video', () => {
    expect(routeAfterScript(mockState({ format: 'video' as never }))).toBe('video_flow');
  });

  it('returns carousel_flow for format=carousel', () => {
    expect(routeAfterScript(mockState({ format: 'carousel' as never }))).toBe('carousel_flow');
  });

  it('returns image_flow for format=post (default)', () => {
    expect(routeAfterScript(mockState({ format: 'post' as never }))).toBe('image_flow');
  });

  it('returns caption_only for format=text', () => {
    expect(routeAfterScript(mockState({ format: 'text' as never }))).toBe('caption_only');
  });

  it('returns caption_only for format=article', () => {
    expect(routeAfterScript(mockState({ format: 'article' as never }))).toBe('caption_only');
  });

  it('returns image_flow for unknown format', () => {
    expect(routeAfterScript(mockState({ format: 'pin' as never }))).toBe('image_flow');
  });

  it('is case-insensitive', () => {
    expect(routeAfterScript(mockState({ format: 'REEL' as never }))).toBe('video_flow');
    expect(routeAfterScript(mockState({ format: 'Carousel' as never }))).toBe('carousel_flow');
  });
});

// ── routeAfterQuality ───────────────────────────────────────────────

describe('routeAfterQuality', () => {
  it('returns pass when average score >= 0.65', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.8, visual_quality: 0.7 },
    });
    expect(routeAfterQuality(state)).toBe('pass');
  });

  it('NE passe PAS malgré un bon score si un média est vide (ACT-BE-015)', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.8, visual_quality: 0.7 },
      errors: [
        { node: 'generate_voiceover', errorType: 'voiceover_empty', message: 'vide', timestamp: '', retryable: true },
      ] as never,
    });
    expect(routeAfterQuality(state)).toBe('retry');
  });

  it('échoue sur média vide quand les retries sont épuisés (ACT-BE-015)', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.8, visual_quality: 0.7 },
      errors: [
        { node: 'compose', errorType: 'compose_empty', message: 'vide', timestamp: '', retryable: true },
      ] as never,
      retries: { qualityCheck: 2 },
    });
    expect(routeAfterQuality(state)).toBe('fail');
  });

  it('un média seulement DÉGRADÉ (pas vide) ne bloque pas le pass (ACT-BE-015)', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.8, visual_quality: 0.7 },
      errors: [
        { node: 'transcode_export', errorType: 'transcode_failed', message: 'x', timestamp: '', retryable: true },
      ] as never,
    });
    expect(routeAfterQuality(state)).toBe('pass');
  });

  it('returns pass when scores are empty (no dead-end)', () => {
    expect(routeAfterQuality(mockState({ qualityScores: {} }))).toBe('pass');
  });

  it('returns retry when average < 0.65 and retries < 2', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.3, visual_quality: 0.2 },
      retries: { qualityCheck: 1 },
    });
    expect(routeAfterQuality(state)).toBe('retry');
  });

  it('returns fail when average < 0.65 and retries >= 2', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.3, visual_quality: 0.2 },
      retries: { qualityCheck: 2 },
    });
    expect(routeAfterQuality(state)).toBe('fail');
  });

  it('returns retry when retries is undefined (first retry)', () => {
    const state = mockState({
      qualityScores: { text_quality: 0.3 },
      retries: {},
    });
    expect(routeAfterQuality(state)).toBe('retry');
  });

  it('returns pass at exact threshold 0.65', () => {
    const state = mockState({
      qualityScores: { a: 0.65 },
    });
    expect(routeAfterQuality(state)).toBe('pass');
  });
});

// ── routeAfterModeration ────────────────────────────────────────────

describe('routeAfterModeration', () => {
  it('returns safe when moderationResult is null', () => {
    expect(routeAfterModeration(mockState({ moderationResult: null }))).toBe('safe');
  });

  it('returns safe when moderationResult.safe is true', () => {
    const state = mockState({
      moderationResult: { safe: true, flags: [], canRetry: false },
    });
    expect(routeAfterModeration(state)).toBe('safe');
  });

  it('returns flagged when not safe but canRetry', () => {
    const state = mockState({
      moderationResult: { safe: false, flags: ['violence'], canRetry: true },
    });
    expect(routeAfterModeration(state)).toBe('flagged');
  });

  it('returns blocked when not safe and cannot retry', () => {
    const state = mockState({
      moderationResult: { safe: false, flags: ['illegal'], canRetry: false },
    });
    expect(routeAfterModeration(state)).toBe('blocked');
  });
});

// ── routeAfterHumanReview ───────────────────────────────────────────

describe('routeAfterHumanReview', () => {
  it('returns approved when no review submitted', () => {
    expect(routeAfterHumanReview(mockState({ humanReview: null }))).toBe('approved');
  });

  it('returns approved when decision is approved', () => {
    const state = mockState({ humanReview: { decision: 'approved' } });
    expect(routeAfterHumanReview(state)).toBe('approved');
  });

  it('returns approved_direct when decision is approved_direct', () => {
    const state = mockState({ humanReview: { decision: 'approved_direct' } });
    expect(routeAfterHumanReview(state)).toBe('approved_direct');
  });

  it('returns rejected when decision is rejected', () => {
    const state = mockState({ humanReview: { decision: 'rejected' } });
    expect(routeAfterHumanReview(state)).toBe('rejected');
  });

  it('returns edit_requested when decision is edit_requested', () => {
    const state = mockState({ humanReview: { decision: 'edit_requested' } });
    expect(routeAfterHumanReview(state)).toBe('edit_requested');
  });
});
