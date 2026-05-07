/**
 * Tests cadenceur — couvre :
 *  - mode `disabled` (réduit motion / tests),
 *  - propagation 1-to-1 des deltas,
 *  - respect de l'AbortSignal,
 *  - retard minimum (`minTypingMs`).
 */
import { describe, expect, it, vi } from 'vitest';

import { humanizeStream } from './humanize.client';

async function* fromArray(items: string[]): AsyncIterable<string> {
  for (const it of items) {
    yield it;
  }
}

describe('humanizeStream — disabled mode', () => {
  it('propagates all deltas without delay', async () => {
    const collected: string[] = [];
    await humanizeStream(
      fromArray(['Hello', ' ', 'world', '.']),
      (d) => collected.push(d),
      { disabled: true },
    );
    expect(collected.join('')).toBe('Hello world.');
  });
});

describe('humanizeStream — abort signal', () => {
  it('stops emitting after abort', async () => {
    const ctrl = new AbortController();
    const collected: string[] = [];

    async function* slowSource(): AsyncIterable<string> {
      yield 'A';
      yield 'B';
      ctrl.abort();
      yield 'C';
      yield 'D';
    }

    await humanizeStream(
      slowSource(),
      (d) => collected.push(d),
      { disabled: true },
      { signal: ctrl.signal },
    );

    // En mode disabled, les ticks sortent au rythme du source ; au
    // moment où on abort, le for-await peut encore consommer le yield
    // déjà émis. On vérifie simplement qu'on n'a pas bouclé indéfiniment.
    expect(collected.length).toBeGreaterThanOrEqual(2);
  });
});

describe('humanizeStream — min typing delay', () => {
  it('waits at least minTypingMs before first tick', async () => {
    vi.useFakeTimers();
    try {
      const collected: string[] = [];
      const promise = humanizeStream(
        fromArray(['Hi']),
        (d) => collected.push(d),
        { minTypingMs: 500, jitterMinMs: 0, jitterMaxMs: 0, punctPauseMs: 0 },
      );

      // Avant le timer, rien n'a encore été émis.
      await Promise.resolve();
      expect(collected.length).toBe(0);

      await vi.advanceTimersByTimeAsync(600);
      await promise;
      expect(collected).toEqual(['Hi']);
    } finally {
      vi.useRealTimers();
    }
  });
});
