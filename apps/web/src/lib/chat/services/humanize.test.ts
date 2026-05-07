/**
 * Tests `resolveMotion` — vérifie clamps + override.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_MOTION, resolveMotion } from './humanize';

describe('resolveMotion', () => {
  it('returns DEFAULT when override absent', () => {
    expect(resolveMotion()).toEqual(DEFAULT_MOTION);
    expect(resolveMotion(null)).toEqual(DEFAULT_MOTION);
  });

  it('merges partial override', () => {
    const r = resolveMotion({ minTypingMs: 1000 });
    expect(r.minTypingMs).toBe(1000);
    expect(r.jitterMinMs).toBe(DEFAULT_MOTION.jitterMinMs);
  });

  it('clamps values to safe ranges', () => {
    const r = resolveMotion({
      jitterMinMs: -10,
      jitterMaxMs: 9999,
      punctPauseMs: -50,
      minTypingMs: 99999,
    });
    expect(r.jitterMinMs).toBe(0);
    expect(r.jitterMaxMs).toBe(400);
    expect(r.punctPauseMs).toBe(0);
    expect(r.minTypingMs).toBe(3000);
  });
});
