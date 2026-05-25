/**
 * AI Content Generation Engine -- graph entrypoint.
 *
 * Provides `createContentEngine()` which builds, compiles, and returns
 * a ready-to-invoke LangGraph compiled graph.
 */

export {
  ContentGenerationState,
  type ContentGenerationStateType,
  type ContentGenerationUpdateType,
  type ContentVariant,
} from './state';

export {
  routeAfterScript,
  routeAfterQuality,
  routeAfterModeration,
  routeAfterHumanReview,
  type ScriptRoute,
  type QualityRoute,
  type ModerationRoute,
  type HumanReviewRoute,
} from './routing';

export { buildContentGraph } from './builder';

import { buildContentGraph } from './builder';

/**
 * Build and compile the content generation graph, ready for `.invoke()`.
 *
 * @example
 * ```ts
 * const engine = createContentEngine();
 * const result = await engine.invoke({
 *   jobId: 'job_123',
 *   tenantId: 'tenant_abc',
 *   createdAt: new Date().toISOString(),
 *   brief: { ... },
 *   platform: 'instagram',
 *   format: 'reel',
 *   contentType: 'produit',
 * });
 * ```
 */
export function createContentEngine() {
  const graph = buildContentGraph();
  return graph.compile();
}

/** Convenience type for the compiled engine instance. */
export type ContentEngine = ReturnType<typeof createContentEngine>;
