/**
 * Tests du template ResumeBanner — helper pur.
 */
import { describe, it, expect } from 'vitest';

import { formatResumeBanner } from './resume-banner-template';

describe('formatResumeBanner', () => {
  it('remplace {firstName} par la valeur', () => {
    expect(
      formatResumeBanner('Bon retour, {firstName} — on reprend.', 'Yasmine'),
    ).toBe('Bon retour, Yasmine — on reprend.');
  });

  it('remplace tous les {firstName} (multiple occurrences)', () => {
    expect(formatResumeBanner('{firstName}, {firstName} !', 'Amal')).toBe(
      'Amal, Amal !',
    );
  });

  it('retourne le template tel quel si aucun placeholder', () => {
    expect(formatResumeBanner('Pas de placeholder ici', 'X')).toBe(
      'Pas de placeholder ici',
    );
  });
});
