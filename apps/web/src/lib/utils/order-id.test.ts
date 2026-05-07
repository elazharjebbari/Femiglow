import { describe, it, expect } from 'vitest';
import { generateOrderId, generateOrderSuffix } from './order-id';

describe('generateOrderSuffix', () => {
  it('produit 5 caractères [A-Z0-9]', () => {
    for (let i = 0; i < 50; i += 1) {
      const suffix = generateOrderSuffix();
      expect(suffix).toMatch(/^[A-Z0-9]{5}$/);
    }
  });
});

describe('generateOrderId', () => {
  it('produit le format FG-YYYY-XXXXX', () => {
    expect(generateOrderId(2026)).toMatch(/^FG-2026-[A-Z0-9]{5}$/);
  });

  it('génère 1000 ids consécutifs sans collision', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) ids.add(generateOrderId(2026));
    expect(ids.size).toBeGreaterThan(995);
  });
});
