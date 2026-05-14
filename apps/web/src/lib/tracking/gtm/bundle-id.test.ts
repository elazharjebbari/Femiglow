import { describe, expect, it } from 'vitest';
import { computeBundleId, isValidBundleId } from './bundle-id';

const baseInput = () => ({
  mappingVersion: 'v17',
  configVersion: 'v4',
  containerId: 'GTM-ABCD',
  events: [
    { name: 'purchase', resolvedNames: { meta: 'Purchase', google_ga4: 'purchase' } },
    { name: 'view_content', resolvedNames: { meta: 'ViewContent', google_ga4: 'view_item' } },
  ],
  generatedAt: '2026-05-13T19:30:00.000Z',
});

describe('computeBundleId', () => {
  it('produit un hash 12 chars hex', () => {
    const id = computeBundleId(baseInput());
    expect(id).toMatch(/^[a-f0-9]{12}$/);
  });

  it('est déterministe (même input → même output)', () => {
    expect(computeBundleId(baseInput())).toBe(computeBundleId(baseInput()));
  });

  it('est stable malgré l\'ordre des events', () => {
    const a = baseInput();
    const b = baseInput();
    b.events = [...b.events].reverse();
    expect(computeBundleId(a)).toBe(computeBundleId(b));
  });

  it('change si une resolvedName change', () => {
    const a = baseInput();
    const b = baseInput();
    b.events = [
      { name: 'purchase', resolvedNames: { meta: 'PremiumPurchase', google_ga4: 'purchase' } },
      ...b.events.slice(1),
    ];
    expect(computeBundleId(a)).not.toBe(computeBundleId(b));
  });

  it('change si mappingVersion change', () => {
    expect(computeBundleId({ ...baseInput(), mappingVersion: 'v17' }))
      .not.toBe(computeBundleId({ ...baseInput(), mappingVersion: 'v18' }));
  });

  it('change si configVersion change', () => {
    expect(computeBundleId({ ...baseInput(), configVersion: 'v4' }))
      .not.toBe(computeBundleId({ ...baseInput(), configVersion: 'v5' }));
  });

  it('change si containerId change', () => {
    expect(computeBundleId({ ...baseInput(), containerId: 'GTM-PROD' }))
      .not.toBe(computeBundleId({ ...baseInput(), containerId: 'GTM-STAGE' }));
  });

  it('change si generatedAt change', () => {
    expect(computeBundleId({ ...baseInput(), generatedAt: '2026-05-13T19:30:00.000Z' }))
      .not.toBe(computeBundleId({ ...baseInput(), generatedAt: '2026-05-13T19:31:00.000Z' }));
  });
});

describe('isValidBundleId', () => {
  it('accepte un hash valide', () => {
    expect(isValidBundleId('a7c4f2e9b81d')).toBe(true);
  });

  it('rejette les autres formats', () => {
    expect(isValidBundleId('a7c4')).toBe(false);
    expect(isValidBundleId('A7C4F2E9B81D')).toBe(false);
    expect(isValidBundleId('')).toBe(false);
    expect(isValidBundleId(123)).toBe(false);
    expect(isValidBundleId(null)).toBe(false);
    expect(isValidBundleId(undefined)).toBe(false);
    expect(isValidBundleId('zzzzzzzzzzzz')).toBe(false);
  });
});
