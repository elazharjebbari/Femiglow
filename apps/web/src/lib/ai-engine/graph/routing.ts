/**
 * Conditional routing functions for the content generation graph.
 *
 * Each function inspects the current graph state and returns a string key
 * that the StateGraph maps to a concrete next-node via its pathMap.
 */

import type { ContentGenerationStateType } from './state';

// ── Format-based routing after script generation ──────────────────────

const VIDEO_FORMATS = new Set(['reel', 'story', 'shorts', 'video']);
const CAROUSEL_FORMAT = 'carousel';
const CAPTION_ONLY_FORMATS = new Set(['article', 'text']);

export type ScriptRoute = 'video_flow' | 'carousel_flow' | 'image_flow' | 'caption_only';

export function routeAfterScript(state: ContentGenerationStateType): ScriptRoute {
  const format = state.format?.toLowerCase() ?? '';

  if (VIDEO_FORMATS.has(format)) {
    return 'video_flow';
  }
  if (format === CAROUSEL_FORMAT) {
    return 'carousel_flow';
  }
  if (CAPTION_ONLY_FORMATS.has(format)) {
    return 'caption_only';
  }
  // Default: single-image flow (feed, post, pin, etc.)
  return 'image_flow';
}

// ── Quality gate routing ──────────────────────────────────────────────

const QUALITY_PASS_THRESHOLD = 0.65;
const MAX_RETRIES_PER_NODE = 2;

export type QualityRoute = 'pass' | 'retry' | 'fail';

export function routeAfterQuality(state: ContentGenerationStateType): QualityRoute {
  const retryCount = state.retries?.['qualityCheck'] ?? 0;

  // ACT-BE-015 — un média DUR manquant (asset vide, errorType `*_empty` poussé
  // par les nœuds média dans state.errors) NE PEUT PAS être certifié 'completed'
  // sur le seul score : on retente si possible, sinon on échoue — au lieu de
  // passer en silence avec un asset url=''.
  const hasEmptyMedia = (state.errors ?? []).some(
    (e) => typeof e?.errorType === 'string' && e.errorType.endsWith('_empty'),
  );
  if (hasEmptyMedia) {
    return retryCount < MAX_RETRIES_PER_NODE ? 'retry' : 'fail';
  }

  const scores = state.qualityScores ?? {};
  const values = Object.values(scores);

  if (values.length === 0) {
    // No scores at all -- treat as pass to avoid dead-end
    return 'pass';
  }

  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  if (average >= QUALITY_PASS_THRESHOLD) {
    return 'pass';
  }

  // Check if we have retries left for the quality check node
  if (retryCount < MAX_RETRIES_PER_NODE) {
    return 'retry';
  }

  return 'fail';
}

// ── Moderation routing ────────────────────────────────────────────────

export type ModerationRoute = 'safe' | 'flagged' | 'blocked';

export function routeAfterModeration(state: ContentGenerationStateType): ModerationRoute {
  const result = state.moderationResult;

  if (!result) {
    // No moderation result -- assume safe (will be caught downstream)
    return 'safe';
  }

  if (result.safe) {
    return 'safe';
  }

  // Not safe -- decide between flagged (retryable) and blocked (terminal)
  if (result.canRetry) {
    return 'flagged';
  }

  return 'blocked';
}

// ── Human review routing ──────────────────────────────────────────────

export type HumanReviewRoute = 'approved' | 'approved_direct' | 'rejected' | 'edit_requested';

export function routeAfterHumanReview(state: ContentGenerationStateType): HumanReviewRoute {
  const review = state.humanReview;

  if (!review) {
    // No review submitted yet -- default to approved to keep flow moving
    return 'approved';
  }

  return review.decision;
}
