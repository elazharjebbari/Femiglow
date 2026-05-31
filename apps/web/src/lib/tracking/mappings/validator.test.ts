import { describe, expect, it } from 'vitest';
import { validateCell, validateMappings, mappingCellSchema } from './validator';

describe('validateCell (par provider)', () => {
  it('Meta : standard event valide', () => {
    expect(validateCell({ mappedName: 'Purchase' }, 'meta')).toEqual({ ok: true });
  });
  it('Meta : nom kebab invalide', () => {
    const r = validateCell({ mappedName: 'pur-chase' }, 'meta');
    expect(r.ok).toBe(false);
  });
  it('GA4 : snake_case valide', () => {
    expect(validateCell({ mappedName: 'purchase' }, 'google_ga4')).toEqual({ ok: true });
  });
  it('GA4 : capital invalide', () => {
    const r = validateCell({ mappedName: 'Purchase' }, 'google_ga4');
    expect(r.ok).toBe(false);
  });
  it('null mappedName toujours OK (= pas de dispatch)', () => {
    expect(validateCell({ mappedName: null }, 'meta')).toEqual({ ok: true });
    expect(validateCell({ mappedName: null }, 'google_ga4')).toEqual({ ok: true });
  });
});

describe('mappingCellSchema (Zod)', () => {
  it('parse minimal valid cell', () => {
    const r = mappingCellSchema.safeParse({ mappedName: 'Purchase', isCustom: false, isEnabled: true });
    expect(r.success).toBe(true);
  });
  it('rejette champ inconnu (strict)', () => {
    const r = mappingCellSchema.safeParse({ mappedName: 'X', extraField: 'oops' });
    expect(r.success).toBe(false);
  });
  it('notes max 200 chars', () => {
    const longNote = 'x'.repeat(201);
    const r = mappingCellSchema.safeParse({ mappedName: 'X', notes: longNote });
    expect(r.success).toBe(false);
  });
});

describe('validateMappings (matrice complète)', () => {
  const validCell = { mappedName: 'Purchase', isCustom: false, isEnabled: true, notes: null };
  const buildEvent = () => ({
    meta: validCell,
    google_ga4: { ...validCell, mappedName: 'purchase' },
    google_ads: { ...validCell, mappedName: 'purchase' },
    tiktok: { ...validCell, mappedName: 'CompletePayment' },
    snap: { ...validCell, mappedName: 'PURCHASE' },
    pinterest: { ...validCell, mappedName: 'checkout' },
  });

  it('matrice valide → ok=true, errors vide', () => {
    const r = validateMappings({ purchase: buildEvent() });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('cellule Meta kebab → erreur listée', () => {
    const r = validateMappings({
      purchase: { ...buildEvent(), meta: { ...validCell, mappedName: 'pur-chase' } },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]!.path).toContain('purchase.meta.mappedName');
  });

  it('shape entièrement invalide → ok=false', () => {
    const r = validateMappings({ purchase: 'not_an_object' });
    expect(r.ok).toBe(false);
  });
});
