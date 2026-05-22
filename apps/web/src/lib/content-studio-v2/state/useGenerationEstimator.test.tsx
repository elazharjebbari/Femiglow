/**
 * Tests for the AI generation progress estimator (Phase 3.6).
 *
 * We focus on:
 *   - the pure percentile() math (p50/p95 with edge cases),
 *   - the stage transitions ('running' → 'longer' → 'stuck'),
 *   - localStorage roundtrip via a stub storage.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGenerationEstimator, __test as estimatorTest } from './useGenerationEstimator';

describe('percentile()', () => {
  it('returns 0 for an empty array', () => {
    expect(estimatorTest.percentile([], 0.5)).toBe(0);
  });

  it('returns the single value when array has one element', () => {
    expect(estimatorTest.percentile([42], 0.5)).toBe(42);
    expect(estimatorTest.percentile([42], 0.95)).toBe(42);
  });

  it('computes p50 (median) correctly', () => {
    expect(estimatorTest.percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(estimatorTest.percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('computes p95 correctly', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 100); // 100..2000
    // p95 of 20 values = index 19*0.95 = 18.05 → between 1900 (idx18) and 2000 (idx19)
    const p95 = estimatorTest.percentile(values, 0.95);
    expect(p95).toBeGreaterThan(1900);
    expect(p95).toBeLessThanOrEqual(2000);
  });
});

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    _raw: map,
  };
}

describe('useGenerationEstimator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with progress 0', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'test', fallbackMs: 10_000, storage }),
    );
    expect(result.current.stage).toBe('idle');
    expect(result.current.progressPct).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it('progresses while running and never exceeds the cap', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'test', fallbackMs: 2000, capPct: 95, storage }),
    );
    act(() => result.current.start());
    expect(result.current.isRunning).toBe(true);
    // advance 1.5s — should be around mid progress
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.progressPct).toBeGreaterThan(0);
    expect(result.current.progressPct).toBeLessThanOrEqual(95);
    // advance way past p50 — still capped at 95
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.progressPct).toBeLessThanOrEqual(95);
  });

  it('transitions to "longer" past p95 and "stuck" past 2×p95', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'test', fallbackMs: 1000, storage }),
    );
    act(() => result.current.start());
    // fallback p95 = fallbackMs * 1.5 = 1500ms
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(result.current.stage).toBe('longer');
    act(() => {
      vi.advanceTimersByTime(2000); // total 3700 > 2×p95=3000
    });
    expect(result.current.stage).toBe('stuck');
  });

  it('stop() records duration to history and persists in storage', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'visual', fallbackMs: 1000, storage }),
    );
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => result.current.stop());
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toBeGreaterThanOrEqual(800);
    expect(storage._raw.has('cs-v2:gen-history:visual')).toBe(true);
    const raw = JSON.parse(storage._raw.get('cs-v2:gen-history:visual') ?? '[]') as number[];
    expect(raw).toHaveLength(1);
  });

  it('cancel() resets state without persisting', () => {
    const storage = makeStorage();
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'visual', fallbackMs: 1000, storage }),
    );
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => result.current.cancel());
    expect(result.current.isRunning).toBe(false);
    expect(result.current.history).toEqual([]);
    expect(storage._raw.has('cs-v2:gen-history:visual')).toBe(false);
  });

  it('rehydrates history from storage on mount', () => {
    const storage = makeStorage();
    storage.setItem('cs-v2:gen-history:visual', JSON.stringify([1000, 1500, 2000]));
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'visual', fallbackMs: 1000, storage }),
    );
    expect(result.current.history).toEqual([1000, 1500, 2000]);
    expect(result.current.p50Ms).toBeCloseTo(1500, 0);
    expect(result.current.p95Ms).toBeGreaterThan(1900);
    expect(result.current.p95Ms).toBeLessThanOrEqual(2000);
  });

  it('caps history at HISTORY_MAX (20 entries)', () => {
    const storage = makeStorage();
    // seed with 22 values
    storage.setItem(
      'cs-v2:gen-history:visual',
      JSON.stringify(Array.from({ length: 22 }, (_, i) => i * 100 + 100)),
    );
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'visual', fallbackMs: 1000, storage }),
    );
    expect(result.current.history).toHaveLength(20);
  });

  it('ignores corrupted storage gracefully (uses fallback)', () => {
    const storage = makeStorage();
    storage.setItem('cs-v2:gen-history:visual', '{not json at all]');
    const { result } = renderHook(() =>
      useGenerationEstimator({ bucket: 'visual', fallbackMs: 12_000, storage }),
    );
    expect(result.current.history).toEqual([]);
    expect(result.current.p50Ms).toBe(12_000);
  });
});
