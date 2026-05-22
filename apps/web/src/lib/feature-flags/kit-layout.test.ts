import { describe, expect, it } from 'vitest';

import { resolveKitLayoutVersion } from './kit-layout';

describe('resolveKitLayoutVersion', () => {
  it('default v1 quand env est undefined', () => {
    expect(resolveKitLayoutVersion(undefined)).toBe('v1');
  });

  it('v2 quand env vaut exactement "true"', () => {
    expect(resolveKitLayoutVersion('true')).toBe('v2');
  });

  it('v1 quand env vaut "1" (refus du truthy laxiste)', () => {
    // On veut le booléen strict pour éviter les bascules accidentelles
    // (ex. un `=1` dans un .env mal édité ne doit PAS activer v2).
    expect(resolveKitLayoutVersion('1')).toBe('v1');
  });

  it('v1 quand env vaut "TRUE" (case-sensitive)', () => {
    // Convention Next.js : les env publiques sont string littéral.
    // On garde la stricte case-sensitivity pour éviter les surprises.
    expect(resolveKitLayoutVersion('TRUE')).toBe('v1');
  });

  it('v1 quand env vaut "false"', () => {
    expect(resolveKitLayoutVersion('false')).toBe('v1');
  });

  it('v1 quand env est une string vide', () => {
    expect(resolveKitLayoutVersion('')).toBe('v1');
  });

  it('v1 quand env contient du whitespace ("true ")', () => {
    expect(resolveKitLayoutVersion('true ')).toBe('v1');
  });
});
