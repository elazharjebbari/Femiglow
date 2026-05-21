/**
 * Tests du détecteur de correction de champ — helper pur.
 */
import { describe, it, expect } from 'vitest';

import { detectCorrection } from './field-correction-detector';

describe('detectCorrection', () => {
  it('vide → vide : pas de correction', () => {
    expect(detectCorrection('', '')).toBe(false);
  });

  it('vide → 1 char : pas de correction (frappe normale)', () => {
    expect(detectCorrection('', 'Y')).toBe(false);
  });

  it('"Yasmine" → "Yasmin" : pas de correction (delete 1)', () => {
    expect(detectCorrection('Yasmine', 'Yasmin')).toBe(false);
  });

  it('"Yasmine" → "Yas" : correction (drop > 50 %)', () => {
    expect(detectCorrection('Yasmine', 'Yas')).toBe(true);
  });

  it('"Yasmine" → "" : correction (full clear)', () => {
    expect(detectCorrection('Yasmine', '')).toBe(true);
  });

  it('"0612345678" → "0612" : correction (drop > 50 %)', () => {
    expect(detectCorrection('0612345678', '0612')).toBe(true);
  });

  it('"0612345678" → "061234567" : pas de correction (delete 1)', () => {
    expect(detectCorrection('0612345678', '061234567')).toBe(false);
  });

  it('cas limite drop = 50 % exact : pas de correction (strict <)', () => {
    expect(detectCorrection('1234', '12')).toBe(false);
  });
});
