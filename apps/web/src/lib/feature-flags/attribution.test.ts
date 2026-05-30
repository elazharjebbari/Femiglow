import { describe, expect, it } from 'vitest';

import { resolveAttributionVersion } from './attribution';

describe('resolveAttributionVersion', () => {
  it('default v1 quand env est undefined', () => {
    expect(resolveAttributionVersion(undefined)).toBe('v1');
  });

  it('v2 quand env vaut exactement "true"', () => {
    expect(resolveAttributionVersion('true')).toBe('v2');
  });

  it('v1 quand env vaut "1" (refus du truthy laxiste)', () => {
    expect(resolveAttributionVersion('1')).toBe('v1');
  });

  it('v1 quand env vaut "TRUE" (case-sensitive)', () => {
    expect(resolveAttributionVersion('TRUE')).toBe('v1');
  });

  it('v1 quand env est string vide', () => {
    expect(resolveAttributionVersion('')).toBe('v1');
  });
});
