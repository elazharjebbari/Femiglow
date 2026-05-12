import { describe, it, expect } from 'vitest';
import { computeShippingCents, isExpressAvailable } from './shipping';

describe('computeShippingCents', () => {
  it('40 MAD pour Rabat standard (capitale)', () => {
    expect(computeShippingCents({ city: 'rabat', mode: 'standard' })).toBe(
      4000,
    );
  });

  it('40 MAD pour Casablanca standard (capitale)', () => {
    expect(
      computeShippingCents({ city: 'casablanca', mode: 'standard' }),
    ).toBe(4000);
  });

  it('60 MAD pour une ville hors capitale (standard)', () => {
    expect(
      computeShippingCents({ city: 'marrakech', mode: 'standard' }),
    ).toBe(6000);
  });

  it('80 MAD pour express', () => {
    expect(
      computeShippingCents({ city: 'rabat', mode: 'express' }),
    ).toBe(8000);
  });

  it('d\u00E9faut standard si mode non pr\u00E9cis\u00E9', () => {
    expect(computeShippingCents({ city: 'rabat' })).toBe(4000);
  });
});

describe('isExpressAvailable', () => {
  it('vrai pour les villes capitales (Rabat, Casablanca, Sal\u00E9)', () => {
    expect(isExpressAvailable('rabat')).toBe(true);
    expect(isExpressAvailable('casablanca')).toBe(true);
    expect(isExpressAvailable('sale')).toBe(true);
    expect(isExpressAvailable('marrakech')).toBe(false);
    expect(isExpressAvailable(undefined)).toBe(false);
  });
});

describe('computeShippingCents — freeShipping flag', () => {
  it('retourne 0 quel que soit la ville quand freeShipping=true', () => {
    expect(
      computeShippingCents({
        city: 'casablanca',
        mode: 'standard',
        freeShipping: true,
      }),
    ).toBe(0);
    expect(
      computeShippingCents({
        city: 'rabat',
        mode: 'express',
        freeShipping: true,
      }),
    ).toBe(0);
    expect(
      computeShippingCents({ city: undefined, freeShipping: true }),
    ).toBe(0);
  });

  it('ignore le flag false (comportement normal)', () => {
    expect(
      computeShippingCents({
        city: 'rabat',
        mode: 'standard',
        freeShipping: false,
      }),
    ).toBe(4000);
  });
});
