/**
 * Gap #13 — MemorySaver checkpointing integration test.
 *
 * Creates a MINIMAL graph with MemorySaver to test pause/resume semantics
 * without invoking the full 16-node production graph.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  StateGraph,
  Annotation,
  MemorySaver,
  START,
  END,
  interrupt,
} from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// Minimal test graph state
// ---------------------------------------------------------------------------
const TestState = Annotation.Root({
  value: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  step: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => 'init',
  }),
  counter: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});

function buildTestGraph(useInterrupt = false) {
  const graph = new StateGraph(TestState)
    .addNode('nodeA', async (state) => {
      return { value: `${state.value}:A`, step: 'nodeA', counter: 1 };
    })
    .addNode('nodeB', async (state) => {
      if (useInterrupt) {
        const resumed = interrupt({ paused: true, at: 'nodeB' });
        return {
          value: `${state.value}:B:${JSON.stringify(resumed)}`,
          step: 'nodeB',
          counter: 1,
        };
      }
      return { value: `${state.value}:B`, step: 'nodeB', counter: 1 };
    })
    .addEdge(START, 'nodeA')
    .addEdge('nodeA', 'nodeB')
    .addEdge('nodeB', END);

  return graph;
}

describe('integration: checkpointing (MemorySaver)', () => {
  let checkpointer: MemorySaver;

  beforeEach(() => {
    checkpointer = new MemorySaver();
  });

  it('graph with MemorySaver stores state after first node', async () => {
    const graph = buildTestGraph(false);
    const compiled = graph.compile({ checkpointer });

    await compiled.invoke(
      { value: 'start', step: 'init', counter: 0 },
      { configurable: { thread_id: 'test-store-1' } },
    );

    const snapshot = await compiled.getState({
      configurable: { thread_id: 'test-store-1' },
    });

    expect(snapshot).toBeTruthy();
    expect(snapshot.values).toBeTruthy();
    const values = snapshot.values as Record<string, unknown>;
    // After full execution, value should contain A and B
    expect(values.value).toContain('A');
    expect(values.value).toContain('B');
  });

  it('interrupted graph can be resumed with same thread_id', async () => {
    const graph = buildTestGraph(true);
    const compiled = graph.compile({
      checkpointer,
      interruptBefore: ['nodeB'] as never,
    });

    // First invoke — should stop before nodeB
    await compiled.invoke(
      { value: 'start', step: 'init', counter: 0 },
      { configurable: { thread_id: 'test-interrupt-1' } },
    );

    const midSnapshot = await compiled.getState({
      configurable: { thread_id: 'test-interrupt-1' },
    });

    // Graph should be paused with 'nodeB' as next
    expect(midSnapshot.next).toContain('nodeB');
    const midValues = midSnapshot.values as Record<string, unknown>;
    expect(midValues.value).toContain('A');
    expect(midValues.value).not.toContain('B');
  });

  it('resumed graph continues from where it stopped', async () => {
    const graph = buildTestGraph(false);
    const compiled = graph.compile({
      checkpointer,
      interruptBefore: ['nodeB'] as never,
    });

    // First invoke — stop before nodeB
    await compiled.invoke(
      { value: 'start', step: 'init', counter: 0 },
      { configurable: { thread_id: 'test-resume-1' } },
    );

    // Resume — run nodeB to completion
    const result = await compiled.invoke(null, {
      configurable: { thread_id: 'test-resume-1' },
    });

    const values = result as Record<string, unknown>;
    expect(values.value).toContain('B');
    expect(values.step).toBe('nodeB');
    expect(values.counter).toBe(2); // nodeA(1) + nodeB(1)
  });

  it('different thread_ids are independent', async () => {
    const graph = buildTestGraph(false);
    const compiled = graph.compile({ checkpointer });

    await compiled.invoke(
      { value: 'thread-alpha', step: 'init', counter: 0 },
      { configurable: { thread_id: 'alpha' } },
    );

    await compiled.invoke(
      { value: 'thread-beta', step: 'init', counter: 0 },
      { configurable: { thread_id: 'beta' } },
    );

    const alphaSnapshot = await compiled.getState({
      configurable: { thread_id: 'alpha' },
    });
    const betaSnapshot = await compiled.getState({
      configurable: { thread_id: 'beta' },
    });

    const alphaValues = alphaSnapshot.values as Record<string, unknown>;
    const betaValues = betaSnapshot.values as Record<string, unknown>;

    expect(alphaValues.value).toContain('thread-alpha');
    expect(betaValues.value).toContain('thread-beta');
    expect(alphaValues.value).not.toContain('beta');
    expect(betaValues.value).not.toContain('alpha');
  });

  it('getState() returns current state snapshot', async () => {
    const graph = buildTestGraph(false);
    const compiled = graph.compile({ checkpointer });

    await compiled.invoke(
      { value: 'snapshot-test', step: 'init', counter: 0 },
      { configurable: { thread_id: 'snapshot-thread' } },
    );

    const snapshot = await compiled.getState({
      configurable: { thread_id: 'snapshot-thread' },
    });

    expect(snapshot).toHaveProperty('values');
    expect(snapshot).toHaveProperty('next');
    const values = snapshot.values as Record<string, unknown>;
    expect(values.value).toContain('snapshot-test');
    expect(values.step).toBe('nodeB');
    // After completion, next should be empty
    expect(snapshot.next).toEqual([]);
  });

  it('state survives across multiple invoke() calls', async () => {
    const graph = buildTestGraph(false);
    const compiled = graph.compile({
      checkpointer,
      interruptBefore: ['nodeB'] as never,
    });

    const threadId = 'multi-invoke';

    // First call — stops before nodeB
    await compiled.invoke(
      { value: 'first', step: 'init', counter: 0 },
      { configurable: { thread_id: threadId } },
    );

    const afterFirst = await compiled.getState({
      configurable: { thread_id: threadId },
    });
    expect((afterFirst.values as Record<string, unknown>).counter).toBe(1);

    // Second call — resumes and runs nodeB
    await compiled.invoke(null, {
      configurable: { thread_id: threadId },
    });

    const afterSecond = await compiled.getState({
      configurable: { thread_id: threadId },
    });
    const finalValues = afterSecond.values as Record<string, unknown>;
    expect(finalValues.counter).toBe(2);
    expect(finalValues.value).toContain('B');
  });
});
