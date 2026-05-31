/**
 * Tests du helper `rowsOf` — l'unique point de la codebase qui sait
 * dénormaliser le retour `db.execute()` entre Neon HTTP (`{ rows }`)
 * et postgres-js (array direct).
 *
 * Ces tests servent de spec exécutable du contrat dual-driver. Si on
 * change de driver ou que drizzle modifie sa shape, ces tests
 * doivent rester verts.
 */
import { describe, expect, it } from 'vitest';

import { rowsOf } from './exec';

describe('rowsOf', () => {
  it('retourne l\'array tel quel si l\'input est déjà un array (postgres-js)', () => {
    const input = [{ id: '1' }, { id: '2' }];
    const result = rowsOf(input);
    expect(result).toBe(input); // référentiellement identique : zéro copie
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('extrait `.rows` si l\'input est une enveloppe Neon HTTP', () => {
    const wrapped = { rows: [{ id: '1' }, { id: '2' }] };
    const result = rowsOf(wrapped);
    expect(result).toBe(wrapped.rows); // référentiellement la même référence
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('gère un array vide (postgres-js)', () => {
    expect(rowsOf([])).toEqual([]);
  });

  it('gère une enveloppe Neon vide', () => {
    expect(rowsOf({ rows: [] })).toEqual([]);
  });

  it('préserve le typage générique', () => {
    interface Row {
      id: string;
      name: string;
    }
    const wrapped: { rows: Row[] } = { rows: [{ id: '1', name: 'a' }] };
    // Le typage doit être inféré sans cast — si cette ligne compile, on est bon.
    const list: Row[] = rowsOf(wrapped);
    expect(list[0]?.name).toBe('a');
  });

  it('ne confond pas un objet avec une propriété `rows` factice et un array', () => {
    // Cas adverse : un objet shape postgres-js (un array directement)
    // ne doit jamais être traité comme une enveloppe.
    const arrLike = [{ id: '1', rows: 'fake' }] as unknown as { id: string }[];
    const result = rowsOf(arrLike);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(arrLike);
  });
});
