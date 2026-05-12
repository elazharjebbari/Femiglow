import { describe, it, expect } from 'vitest';
import {
  phoneMaroc9DigitsSchema,
  orderIdSchema,
  checkoutAddressSchema,
  checkoutContactSchema,
  checkoutFormSchema,
} from './order';

describe('phoneMaroc9DigitsSchema', () => {
  it('accepte 9 chiffres commençant par 5/6/7', () => {
    expect(phoneMaroc9DigitsSchema.safeParse('612345678').success).toBe(true);
    expect(phoneMaroc9DigitsSchema.safeParse('723456789').success).toBe(true);
    expect(phoneMaroc9DigitsSchema.safeParse('512345678').success).toBe(true);
  });

  it('refuse 8 chiffres et 10 chiffres', () => {
    expect(phoneMaroc9DigitsSchema.safeParse('61234567').success).toBe(false);
    expect(phoneMaroc9DigitsSchema.safeParse('6123456789').success).toBe(false);
  });

  it('refuse les préfixes hors 5/6/7', () => {
    expect(phoneMaroc9DigitsSchema.safeParse('412345678').success).toBe(false);
  });
});

describe('orderIdSchema', () => {
  it('accepte le format FG-YYYY-XXXXX', () => {
    expect(orderIdSchema.safeParse('FG-2026-A1B2C').success).toBe(true);
    expect(orderIdSchema.safeParse('FG-2025-ZZZZZ').success).toBe(true);
  });

  it('refuse les variantes hors format', () => {
    expect(orderIdSchema.safeParse('invalid').success).toBe(false);
    expect(orderIdSchema.safeParse('FG-2026-abc12').success).toBe(false);
    expect(orderIdSchema.safeParse('FG-26-AAAAA').success).toBe(false);
  });
});

describe('checkoutContactSchema (CHA-233)', () => {
  it('accepte prénom + téléphone seuls', () => {
    expect(
      checkoutContactSchema.safeParse({ firstName: 'Salma', phone: '612345678' }).success,
    ).toBe(true);
  });

  it('refuse un prénom trop court', () => {
    expect(
      checkoutContactSchema.safeParse({ firstName: 'A', phone: '612345678' }).success,
    ).toBe(false);
  });

  it('refuse un téléphone invalide', () => {
    expect(
      checkoutContactSchema.safeParse({ firstName: 'Salma', phone: '1234' }).success,
    ).toBe(false);
  });

  it("n'exige plus email, lastName, acceptNewsletter, createAccount", () => {
    // Aucun de ces champs n'est requis ; ils peuvent ne pas être présents.
    const result = checkoutContactSchema.safeParse({
      firstName: 'Salma',
      phone: '612345678',
    });
    expect(result.success).toBe(true);
  });
});

describe('checkoutAddressSchema (CHA-233)', () => {
  const base = {
    city: 'casablanca',
    country: 'MA' as const,
  };

  it('accepte ville seule (line1 et notes optionnels)', () => {
    expect(checkoutAddressSchema.safeParse(base).success).toBe(true);
  });

  it('accepte ville + line1 + notes', () => {
    const result = checkoutAddressSchema.safeParse({
      ...base,
      line1: '12 rue des Pivoines',
      notes: 'Sonner deux fois.',
    });
    expect(result.success).toBe(true);
  });

  it("accepte n'importe quel nom de ville libre (CHA-230)", () => {
    const result = checkoutAddressSchema.safeParse({
      ...base,
      city: 'El Jadida',
    });
    expect(result.success).toBe(true);
  });

  it("accepte un nom de ville bilingue (arabe — DB autocomplete)", () => {
    const result = checkoutAddressSchema.safeParse({
      ...base,
      city: 'الدار البيضاء',
    });
    expect(result.success).toBe(true);
  });

  it('refuse une ville vide ou trop courte', () => {
    expect(
      checkoutAddressSchema.safeParse({ ...base, city: '' }).success,
    ).toBe(false);
    expect(
      checkoutAddressSchema.safeParse({ ...base, city: 'a' }).success,
    ).toBe(false);
  });

  it("refuse un nom de ville > 80 caractères", () => {
    expect(
      checkoutAddressSchema.safeParse({
        ...base,
        city: 'x'.repeat(81),
      }).success,
    ).toBe(false);
  });

  it('accepte des champs legacy (line2, quartier, postalCode, shippingMode) silencieusement', () => {
    // Drafts pré-CHA-233 peuvent contenir ces champs — on accepte mais on
    // ne les exige plus.
    const result = checkoutAddressSchema.safeParse({
      ...base,
      city: 'casablanca',
      line2: 'Appt 4B',
      quartier: 'Gauthier',
      postalCode: '20000',
      shippingMode: 'standard' as const,
      cityOther: '',
    });
    expect(result.success).toBe(true);
  });

  it('refuse une note > 500 caractères', () => {
    expect(
      checkoutAddressSchema.safeParse({
        ...base,
        notes: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe('checkoutFormSchema (CHA-233)', () => {
  const valid = {
    contact: {
      firstName: 'Salma',
      phone: '612345678',
    },
    address: {
      city: 'casablanca',
      country: 'MA' as const,
    },
    paymentMethod: 'cod' as const,
    consent: true as const,
  };

  it('accepte un payload minimal (contact + address + paymentMethod + consent)', () => {
    expect(checkoutFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte un payload avec recapEmail valide', () => {
    expect(
      checkoutFormSchema.safeParse({
        ...valid,
        recapEmail: 'salma@exemple.ma',
      }).success,
    ).toBe(true);
  });

  it('accepte un recapEmail vide (input non rempli)', () => {
    expect(
      checkoutFormSchema.safeParse({ ...valid, recapEmail: '' }).success,
    ).toBe(true);
  });

  it('refuse un recapEmail mal formé', () => {
    expect(
      checkoutFormSchema.safeParse({
        ...valid,
        recapEmail: 'pas-un-email',
      }).success,
    ).toBe(false);
  });

  it('refuse si consent=false', () => {
    expect(
      checkoutFormSchema.safeParse({ ...valid, consent: false }).success,
    ).toBe(false);
  });
});
