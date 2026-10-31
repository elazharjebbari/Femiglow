import { z } from 'zod';

import type { WizardDictionary } from '@/lib/checkout/i18n/dictionary';
import {
  ADDRESS_CITY_MIN_LENGTH,
  ADDRESS_LINE_MIN_LENGTH,
} from '@/lib/checkout/address/address-phase';

export const ADDRESS_CITY_MAX_LENGTH = 80;
export const ADDRESS_LINE_MAX_LENGTH = 160;
export const ADDRESS_NOTES_MAX_LENGTH = 500;

/** Miroir client de `patchLeadAddressInputSchema`, messages dans la langue active. */
export function buildAddressFormSchema(errors: WizardDictionary['address']['errors']) {
  return z.object({
    city: z
      .string()
      .trim()
      .min(ADDRESS_CITY_MIN_LENGTH, errors.cityRequired)
      .max(ADDRESS_CITY_MAX_LENGTH, errors.cityTooLong),
    addressLine1: z
      .string()
      .trim()
      .min(ADDRESS_LINE_MIN_LENGTH, errors.addressRequired)
      .max(ADDRESS_LINE_MAX_LENGTH, errors.addressTooLong),
    notes: z.string().trim().max(ADDRESS_NOTES_MAX_LENGTH, errors.noteTooLong).optional(),
  });
}

export type AddressFormValues = z.input<ReturnType<typeof buildAddressFormSchema>>;
