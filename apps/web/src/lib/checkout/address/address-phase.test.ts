import { describe, expect, it } from 'vitest';

import { deriveAddressPhase } from './address-phase';

describe('deriveAddressPhase', () => {
  it('ville absente ou trop courte → city', () => {
    expect(deriveAddressPhase({ city: '', addressLine1: 'Rue 4' })).toBe('city');
    expect(deriveAddressPhase({ city: ' a ', addressLine1: 'Rue 4' })).toBe('city');
  });

  it('ville valide, adresse manquante ou trop courte → address', () => {
    expect(deriveAddressPhase({ city: 'Fès', addressLine1: '' })).toBe('address');
    expect(deriveAddressPhase({ city: 'Fès', addressLine1: 'ab ' })).toBe('address');
  });

  it('adresse saisie mais pas encore révélée → address', () => {
    expect(
      deriveAddressPhase({ city: 'Fès', addressLine1: 'Rue 4', addressRevealed: false }),
    ).toBe('address');
  });

  it('les deux champs valides → ready', () => {
    expect(deriveAddressPhase({ city: 'الرباط', addressLine1: 'حي السلام' })).toBe('ready');
  });

  it('adresse facultative : la ville suffit, une fois le champ à l’écran', () => {
    const input = { city: 'Fès', addressLine1: '', addressOptional: true };
    expect(deriveAddressPhase(input)).toBe('ready');
    expect(deriveAddressPhase({ ...input, addressRevealed: false })).toBe('address');
    expect(deriveAddressPhase({ ...input, city: '' })).toBe('city');
  });

  it("l'envoi prime sur tout le reste", () => {
    expect(deriveAddressPhase({ city: '', addressLine1: '', submitting: true })).toBe('submitting');
  });
});
