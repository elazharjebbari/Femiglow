import { describe, it, expect } from 'vitest';
import { computeShippingCents, isExpressAvailable } from './shipping';

describe('computeShippingCents', () => {
  it('40 MAD pour Casablanca standard', () => {
    expect(
      computeShippingCents({ city: 'casablanca', mode: 'standard' }),
    ).toBe(4000);
  });

  it('60 MAD pour Rabat standard', () => {
    expect(computeShippingCents({ city: 'rabat', mode: 'standard' })).toBe(
      6000,
    );
  });

  it('80 MAD pour express', () => {
    expect(
      computeShippingCents({ city: 'casablanca', mode: 'express' }),
    ).toBe(8000);
  });

  it('défaut standard si mode non précisé', () => {
    expect(computeShippingCents({ city: 'casablanca' })).toBe(4000);
  });
});

describe('isExpressAvailable', () => {
  it('vrai uniquement pour Casablanca', () => {
    expect(isExpressAvailable('casablanca')).toBe(true);
    expect(isExpressAvailable('rabat')).toBe(false);
    expect(isExpressAvailable(undefined)).toBe(false);
  });
});
