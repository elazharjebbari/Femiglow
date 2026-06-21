/**
 * F07 P3.4-l (Lot 6) — dédup PURE du slug à la duplication.
 */
import { describe, expect, it } from 'vitest';
import { nextDuplicateSlug, duplicateName } from '../duplicate-slug';

describe('F07 — dédup de slug (duplication)', () => {
  it('F07-U-121 — base : slug libre → `<slug>-copie`', () => {
    expect(nextDuplicateSlug('welcome', [])).toBe('welcome-copie');
    expect(nextDuplicateSlug('welcome', ['welcome'])).toBe('welcome-copie');
  });

  it('F07-U-122 — collisions → incrémente le compteur', () => {
    expect(nextDuplicateSlug('welcome', ['welcome', 'welcome-copie'])).toBe('welcome-copie-2');
    expect(
      nextDuplicateSlug('welcome', ['welcome-copie', 'welcome-copie-2', 'welcome-copie-3']),
    ).toBe('welcome-copie-4');
  });

  it('F07-U-123 — dupliquer une copie repart de la racine (pas de -copie-copie)', () => {
    // La source elle-même (`welcome-copie`) est dans l'ensemble pris.
    expect(nextDuplicateSlug('welcome-copie', ['welcome-copie'])).toBe('welcome-copie-2');
    expect(nextDuplicateSlug('welcome-copie-2', ['welcome-copie-2'])).toBe('welcome-copie');
  });

  it('F07-U-124 — dédup considère AUSSI les slugs supprimés (unicité globale)', () => {
    // `welcome-copie` soft-deleted occupe quand même la contrainte unique.
    expect(nextDuplicateSlug('welcome', ['welcome', 'welcome-copie'])).toBe('welcome-copie-2');
  });

  it('F07-U-125 — duplicateName suffixe « (copie) »', () => {
    expect(duplicateName('Bienvenue')).toBe('Bienvenue (copie)');
  });
});
