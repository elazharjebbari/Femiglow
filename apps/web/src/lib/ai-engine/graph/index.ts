/**
 * AI Content Generation Engine -- graph entrypoint.
 *
 * Provides `createContentEngine()` which builds, compiles, and returns
 * a ready-to-invoke LangGraph compiled graph.
 *
 * Uses MemorySaver for in-memory checkpointing so that graphs can be
 * paused (e.g. at the human-review gate) and resumed later with the
 * same thread_id.
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

import { MemorySaver } from '@langchain/langgraph';
import { buildContentGraph } from './builder';
import { getEngineConfig } from '../config';

/**
 * Build and compile the content generation graph, ready for `.invoke()`.
 *
 * The graph is compiled with:
 * - A MemorySaver checkpointer so state persists across pause/resume cycles
 * - `interruptBefore: ['reviewGate']` when humanReviewRequired is true,
 *   which causes the graph to pause before the review node so a human
 *   operator can approve / reject / request edits.
 *
 * @example
 * ```ts
 * const engine = getContentEngine();
 * const result = await engine.invoke(initialState, {
 *   configurable: { thread_id: jobId },
 * });
 * ```
 */
export function createContentEngine() {
  const graph = buildContentGraph();
  const config = getEngineConfig();

  const checkpointer = new MemorySaver();

  // When human review is required, interrupt before the reviewGate node
  // so the operator can inspect the generated content before it proceeds.
  const interruptBefore: string[] | undefined = config.quality.humanReviewRequired
    ? ['reviewGate']
    : undefined;

  return graph.compile({
    checkpointer,
    interruptBefore: interruptBefore as never,
  });
}

/** Convenience type for the compiled engine instance. */
export type ContentEngine = ReturnType<typeof createContentEngine>;

// ---------------------------------------------------------------------------
// Singleton engine instance
// ---------------------------------------------------------------------------
// The engine must be a singleton so the MemorySaver checkpointer retains
// state across the initial invoke and the subsequent resume call.

let _engine: ContentEngine | null = null;

export function getContentEngine(): ContentEngine {
  if (!_engine) {
    _engine = createContentEngine();
  }
  return _engine;
}

/** Reset the singleton (useful for tests or config changes). */
export function resetContentEngine(): void {
  _engine = null;
}
