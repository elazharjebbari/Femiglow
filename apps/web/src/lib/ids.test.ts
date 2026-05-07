import { describe, it, expect } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
  it('génère un identifiant alphanumérique sans préfixe', () => {
    const id = createId();
    expect(id.length).toBeGreaterThanOrEqual(12);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('préfixe avec underscore', () => {
    const id = createId('lead');
    expect(id.startsWith('lead_')).toBe(true);
    expect(id.length).toBeGreaterThan('lead_'.length);
  });

  it('produit des identifiants distincts', () => {
    const ids = new Set();
    for (let i = 0; i < 200; i += 1) ids.add(createId());
    expect(ids.size).toBe(200);
  });
});
