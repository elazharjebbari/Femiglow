import { describe, expect, it } from 'vitest';

import { getWizardDictionary, type DictionaryLanguage } from '@/lib/checkout/i18n/dictionary';
import { buildAddressFormSchema } from './address-form-schema';

const LANGUAGES: DictionaryLanguage[] = ['fr', 'ar', 'en'];
const schemaFor = (lang: DictionaryLanguage) =>
  buildAddressFormSchema(getWizardDictionary(lang).address.errors);
const messages = (lang: DictionaryLanguage, input: object) => {
  const res = schemaFor(lang).safeParse(input);
  return res.success ? [] : res.error.issues.map((i) => i.message);
};
const repeat = (n: number) => 'a'.repeat(n);

describe('buildAddressFormSchema', () => {
  it.each(LANGUAGES)('%s : messages traduits, un par erreur', (lang) => {
    const errors = getWizardDictionary(lang).address.errors;
    expect(messages(lang, { city: 'a', addressLine1: 'abc' })).toEqual([
      errors.cityRequired,
      errors.addressRequired,
    ]);
    expect(
      messages(lang, { city: repeat(81), addressLine1: repeat(161), notes: repeat(501) }),
    ).toEqual([errors.cityTooLong, errors.addressTooLong, errors.noteTooLong]);
  });

  it('en arabe, aucun message ne contient de lettre latine', () => {
    for (const message of Object.values(getWizardDictionary('ar').address.errors)) {
      expect(message).not.toMatch(/[A-Za-z]/);
    }
  });

  it('bornes : 2 et 80 caractères pour la ville, 4 et 160 pour l’adresse', () => {
    const ok = schemaFor('fr').safeParse({ city: repeat(2), addressLine1: repeat(4) });
    const max = schemaFor('fr').safeParse({ city: repeat(80), addressLine1: repeat(160) });
    expect(ok.success).toBe(true);
    expect(max.success).toBe(true);
  });

  it('adresse facultative : vide ou courte acceptée, longueur maximale gardée', () => {
    const schema = buildAddressFormSchema(getWizardDictionary('fr').address.errors, {
      addressOptional: true,
    });
    expect(schema.safeParse({ city: 'Fès', addressLine1: '' }).success).toBe(true);
    expect(schema.safeParse({ city: 'Fès', addressLine1: 'ab' }).success).toBe(true);
    expect(schema.safeParse({ city: 'Fès', addressLine1: repeat(161) }).success).toBe(false);
    expect(schema.safeParse({ city: 'a', addressLine1: '' }).success).toBe(false);
  });

  it('accepte une saisie en arabe', () => {
    expect(
      schemaFor('ar').safeParse({ city: 'وجدة', addressLine1: 'حي السلام' }).success,
    ).toBe(true);
  });
});
