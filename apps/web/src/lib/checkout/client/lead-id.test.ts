import { describe, expect, it } from 'vitest';
import { isLeadId, LEAD_ID_PATTERN, newLeadId } from './lead-id';

describe('lead-id (OWBS)', () => {
  // TST-U-01
  it('newLeadId() produit un id `cl_` + 20 chars [a-z0-9], sans collision', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      const id = newLeadId();
      expect(id).toMatch(LEAD_ID_PATTERN);
      expect(id.startsWith('cl_')).toBe(true);
      ids.add(id);
    }
    // unicité statistique (pas de collision sur 10k tirages)
    expect(ids.size).toBe(10_000);
  });

  it('isLeadId() accepte un id valide et rejette les malformés', () => {
    expect(isLeadId(newLeadId())).toBe(true);
    expect(isLeadId('cl_3xq7m2k9v4b1n8p0w5tz')).toBe(true);

    expect(isLeadId('')).toBe(false);
    expect(isLeadId('cl_TOOSHORT')).toBe(false);
    expect(isLeadId('cl_UPPER0000000000000000')).toBe(false); // majuscules interdites
    expect(isLeadId('xx_3xq7m2k9v4b1n8p0w5tz')).toBe(false); // mauvais préfixe
    expect(isLeadId('cl-3xq7m2k9v4b1n8p0w5tz')).toBe(false); // séparateur invalide
    expect(isLeadId(undefined)).toBe(false);
    expect(isLeadId(42)).toBe(false);
  });
});
