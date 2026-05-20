/**
 * Tests `pickResultStep` — helper pur.
 */
import { describe, it, expect } from 'vitest';

import { pickResultStep } from './pick-result';

describe('pickResultStep', () => {
  it('retourne null si liste vide', () => {
    expect(pickResultStep([])).toBeNull();
  });

  it('retourne le step explicitement isResult: true', () => {
    const steps = [
      { step: 1, isResult: false },
      { step: 2 },
      { step: 3, isResult: true },
      { step: 4 },
    ];
    expect(pickResultStep(steps)?.step).toBe(3);
  });

  it('fallback au dernier step si aucun isResult', () => {
    const steps = [{ step: 1 }, { step: 2 }, { step: 3 }, { step: 4 }];
    expect(pickResultStep(steps)?.step).toBe(4);
  });

  it('retourne le premier isResult: true si plusieurs', () => {
    const steps = [
      { step: 1, isResult: true },
      { step: 2 },
      { step: 3, isResult: true },
    ];
    expect(pickResultStep(steps)?.step).toBe(1);
  });

  it('ignore isResult: false', () => {
    const steps = [{ step: 1, isResult: false }, { step: 2, isResult: false }];
    expect(pickResultStep(steps)?.step).toBe(2);
  });
});
