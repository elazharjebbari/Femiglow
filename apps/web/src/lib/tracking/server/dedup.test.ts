import { afterEach, describe, expect, it } from 'vitest';
import { clearDedupCache, dedupCacheSize, isDuplicateEventId } from './dedup';

afterEach(() => clearDedupCache());

describe('dedup', () => {
  it('marque un event_id comme nouveau au premier appel', () => {
    expect(isDuplicateEventId('e1')).toBe(false);
    expect(dedupCacheSize()).toBe(1);
  });

  it('détecte le doublon au second appel', () => {
    expect(isDuplicateEventId('e2')).toBe(false);
    expect(isDuplicateEventId('e2')).toBe(true);
  });

  it('expire après TTL et accepte à nouveau', () => {
    expect(isDuplicateEventId('e3', 0)).toBe(false);
    expect(isDuplicateEventId('e3', 70_000)).toBe(false);
  });
});
