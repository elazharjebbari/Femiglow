/**
 * State reducer integration tests — Gap #36, #37
 *
 * Tests that the Annotation reducers defined in `types/state.ts` behave
 * correctly when state updates flow through a real LangGraph StateGraph.
 */

import { describe, expect, it } from 'vitest';
import { StateGraph, START, END, Annotation, MemorySaver } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// We replicate the reducer definitions here so we can test them in isolation
// through a minimal graph, without pulling in the full content-engine graph
// (which has heavy side-effects and node dependencies).
// ---------------------------------------------------------------------------

function concatReducer<T>(left: T[], right: T[]): T[] {
  return left.concat(right);
}

function mergeRecordReducer<V>(
  left: Record<string, V>,
  right: Record<string, V>,
): Record<string, V> {
  return { ...left, ...right };
}

interface CostTracking {
  totalCents: number;
  breakdown: Record<string, number>;
  tokensUsed: Record<string, number>;
  budgetRemainingCents?: number;
}

function mergeCostTracking(left: CostTracking, right: CostTracking): CostTracking {
  const mergedBreakdown = { ...left.breakdown, ...right.breakdown };
  const mergedTokens = { ...left.tokensUsed, ...right.tokensUsed };
  return {
    totalCents: left.totalCents + right.totalCents,
    breakdown: mergedBreakdown,
    tokensUsed: mergedTokens,
    budgetRemainingCents: right.budgetRemainingCents ?? left.budgetRemainingCents,
  };
}

function mergeRetries(
  left: Record<string, number>,
  right: Record<string, number>,
): Record<string, number> {
  const result = { ...left };
  for (const [key, val] of Object.entries(right)) {
    result[key] = (result[key] ?? 0) + val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Minimal state annotation for reducer tests
// ---------------------------------------------------------------------------

const TestState = Annotation.Root({
  hashtags: Annotation<string[]>({
    reducer: concatReducer,
    default: () => [],
  }),
  images: Annotation<Array<{ url: string }>>({
    reducer: concatReducer,
    default: () => [],
  }),
  errors: Annotation<Array<{ message: string }>>({
    reducer: concatReducer,
    default: () => [],
  }),
  qualityScores: Annotation<Record<string, number>>({
    reducer: mergeRecordReducer,
    default: () => ({}),
  }),
  retries: Annotation<Record<string, number>>({
    reducer: mergeRetries,
    default: () => ({}),
  }),
  costTracking: Annotation<CostTracking>({
    reducer: mergeCostTracking,
    default: () => ({
      totalCents: 0,
      breakdown: {},
      tokensUsed: {},
    }),
  }),
});

type TestStateType = typeof TestState.State;

// ---------------------------------------------------------------------------
// Helper: build a 2-node graph that passes updates through reducers
// ---------------------------------------------------------------------------

function buildTestGraph(
  node1Update: Partial<TestStateType>,
  node2Update: Partial<TestStateType>,
) {
  const graph = new StateGraph(TestState)
    .addNode('step1', async () => node1Update)
    .addNode('step2', async () => node2Update)
    .addEdge(START, 'step1')
    .addEdge('step1', 'step2')
    .addEdge('step2', END);

  return graph.compile({ checkpointer: new MemorySaver() });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('State reducers (via StateGraph)', () => {
  it('hashtags concat: initial [] + [a,b] = [a,b]', async () => {
    const engine = buildTestGraph(
      { hashtags: ['a', 'b'] },
      {},
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-1' } },
    );
    expect(result.hashtags).toEqual(['a', 'b']);
  });

  it('hashtags concat: [a] + [b,c] = [a,b,c]', async () => {
    const engine = buildTestGraph(
      { hashtags: ['a'] },
      { hashtags: ['b', 'c'] },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-2' } },
    );
    expect(result.hashtags).toEqual(['a', 'b', 'c']);
  });

  it('images concat reducer works', async () => {
    const engine = buildTestGraph(
      { images: [{ url: 'img1.jpg' }] },
      { images: [{ url: 'img2.jpg' }] },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-3' } },
    );
    expect(result.images).toEqual([{ url: 'img1.jpg' }, { url: 'img2.jpg' }]);
  });

  it('errors concat reducer works', async () => {
    const engine = buildTestGraph(
      { errors: [{ message: 'err1' }] },
      { errors: [{ message: 'err2' }] },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-4' } },
    );
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e: { message: string }) => e.message)).toEqual(['err1', 'err2']);
  });

  it('qualityScores merge: {} + {text:0.8} = {text:0.8}', async () => {
    const engine = buildTestGraph(
      { qualityScores: { text: 0.8 } },
      {},
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-5' } },
    );
    expect(result.qualityScores).toEqual({ text: 0.8 });
  });

  it('qualityScores merge: {text:0.8} + {visual:0.7} = both', async () => {
    const engine = buildTestGraph(
      { qualityScores: { text: 0.8 } },
      { qualityScores: { visual: 0.7 } },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-6' } },
    );
    expect(result.qualityScores).toEqual({ text: 0.8, visual: 0.7 });
  });

  it('retries additive: {} + {qualityCheck:1} = {qualityCheck:1}', async () => {
    const engine = buildTestGraph(
      { retries: { qualityCheck: 1 } },
      {},
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-7' } },
    );
    expect(result.retries).toEqual({ qualityCheck: 1 });
  });

  it('retries additive: {qualityCheck:1} + {qualityCheck:1} = {qualityCheck:2}', async () => {
    const engine = buildTestGraph(
      { retries: { qualityCheck: 1 } },
      { retries: { qualityCheck: 1 } },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-8' } },
    );
    expect(result.retries).toEqual({ qualityCheck: 2 });
  });

  it('costTracking sums totalCents', async () => {
    const engine = buildTestGraph(
      { costTracking: { totalCents: 5, breakdown: { script: 5 }, tokensUsed: { script: 100 } } },
      { costTracking: { totalCents: 3, breakdown: { caption: 3 }, tokensUsed: { caption: 60 } } },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-9' } },
    );
    expect(result.costTracking.totalCents).toBe(8);
  });

  it('costTracking merges breakdown', async () => {
    const engine = buildTestGraph(
      { costTracking: { totalCents: 5, breakdown: { script: 5 }, tokensUsed: {} } },
      { costTracking: { totalCents: 3, breakdown: { caption: 3 }, tokensUsed: {} } },
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-10' } },
    );
    expect(result.costTracking.breakdown).toEqual({ script: 5, caption: 3 });
  });

  it('state corruption: hashtags receives string instead of string[] — concat still called', async () => {
    // The concatReducer calls left.concat(right). If right is a string,
    // Array.prototype.concat will wrap it into an element.
    const engine = buildTestGraph(
      { hashtags: 'not-an-array' as unknown as string[] },
      {},
    );
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-11' } },
    );
    // Array.concat with a string argument produces an array containing that string
    expect(Array.isArray(result.hashtags)).toBe(true);
  });

  it('empty update does not corrupt state', async () => {
    // When nodes return empty objects, the graph returns defaults
    // from the Annotation definitions. We verify that defaults are
    // applied and no field is corrupted by a no-op update.
    const graph = new StateGraph(TestState)
      .addNode('step1', async () => ({ hashtags: [] }))
      .addEdge(START, 'step1')
      .addEdge('step1', END);

    const engine = graph.compile({ checkpointer: new MemorySaver() });
    const result = await engine.invoke(
      {} as never,
      { configurable: { thread_id: 'test-12' } },
    );
    expect(result.hashtags).toEqual([]);
    expect(result.images).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.qualityScores).toEqual({});
    expect(result.retries).toEqual({});
    expect(result.costTracking.totalCents).toBe(0);
  });
});
