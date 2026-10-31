/**
 * Étape 2 du wizard — où en est la cliente (`city` → `address` → `ready`).
 *
 * Fonction pure : sert au tracking d'abandon et, dans la V2, au libellé et à
 * l'action du bouton.
 */

export type AddressPhase = 'city' | 'address' | 'ready' | 'submitting';

export const ADDRESS_CITY_MIN_LENGTH = 2;
export const ADDRESS_LINE_MIN_LENGTH = 4;

export function isAddressCityValid(city: string | null | undefined): boolean {
  return (city ?? '').trim().length >= ADDRESS_CITY_MIN_LENGTH;
}

export function isAddressLineValid(line: string | null | undefined): boolean {
  return (line ?? '').trim().length >= ADDRESS_LINE_MIN_LENGTH;
}

export interface DeriveAddressPhaseInput {
  city: string | null | undefined;
  addressLine1: string | null | undefined;
  /** Champ adresse à l'écran. `false` : il reste à le révéler. */
  addressRevealed?: boolean;
  submitting?: boolean;
}

export function deriveAddressPhase({
  city,
  addressLine1,
  addressRevealed = true,
  submitting = false,
}: DeriveAddressPhaseInput): AddressPhase {
  if (submitting) return 'submitting';
  if (!isAddressCityValid(city)) return 'city';
  if (addressRevealed && isAddressLineValid(addressLine1)) return 'ready';
  return 'address';
}
