import { afterEach, describe, expect, it, vi } from 'vitest';

import { deriveEventId } from './event-id';

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveEventId', () => {
  it('is deterministic for identical inputs', () => {
    const a = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: 1_700_000_000_000,
    });
    const b = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: 1_700_000_000_000,
    });
    expect(a).toBe(b);
  });

  it('returns the same id within the same 5min bucket', () => {
    const t = 1_700_000_000_000; // arbitrary, aligned irrelevant
    const a = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: t,
    });
    const b = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: t + 60_000,
    }); // +1min, same bucket
    expect(a).toBe(b);
  });

  it('returns a different id across a 5min bucket boundary', () => {
    // Force timestamp to be the start of a bucket to make boundary unambiguous.
    const t = Math.floor(1_700_000_000_000 / (5 * 60_000)) * (5 * 60_000);
    const a = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: t,
    });
    const b = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: t + 5 * 60_000,
    });
    expect(a).not.toBe(b);
  });

  it('differs per pageId', () => {
    const t = 1_700_000_000_000;
    const a = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t });
    const b = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'maison', timestamp: t });
    expect(a).not.toBe(b);
  });

  it('differs per sessionId', () => {
    const t = 1_700_000_000_000;
    const a = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t });
    const b = deriveEventId({ eventName: 'view_item', sessionId: 's2', pageId: 'kit', timestamp: t });
    expect(a).not.toBe(b);
  });

  it('differs per eventName', () => {
    const t = 1_700_000_000_000;
    const a = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t });
    const b = deriveEventId({ eventName: 'add_to_cart', sessionId: 's1', pageId: 'kit', timestamp: t });
    expect(a).not.toBe(b);
  });

  it('returns exactly 32 hex chars', () => {
    const id = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit' });
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it('falls back to Date.now() when timestamp omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const explicit = deriveEventId({
      eventName: 'view_item',
      sessionId: 's1',
      pageId: 'kit',
      timestamp: 1_700_000_000_000,
    });
    const implicit = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit' });
    expect(implicit).toBe(explicit);
  });
});
