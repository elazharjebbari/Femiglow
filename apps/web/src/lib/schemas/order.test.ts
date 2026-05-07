import { describe, it, expect } from 'vitest';
import {
  phoneMaroc9DigitsSchema,
  orderIdSchema,
  checkoutAddressSchema,
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

describe('checkoutAddressSchema', () => {
  const base = {
    line1: '12 rue des Pivoines',
    quartier: 'Gauthier',
    city: 'casablanca' as const,
    country: 'MA' as const,
    shippingMode: 'standard' as const,
  };

  it('accepte une adresse Casablanca sans code postal', () => {
    expect(checkoutAddressSchema.safeParse(base).success).toBe(true);
  });

  it('exige cityOther quand city = autre', () => {
    const result = checkoutAddressSchema.safeParse({
      ...base,
      city: 'autre',
    });
    expect(result.success).toBe(false);
  });

  it('accepte autre + cityOther rempli', () => {
    const result = checkoutAddressSchema.safeParse({
      ...base,
      city: 'autre',
      cityOther: 'El Jadida',
    });
    expect(result.success).toBe(true);
  });
});

describe('checkoutFormSchema', () => {
  const valid = {
    contact: {
      firstName: 'Salma',
      lastName: 'El Mansouri',
      email: 'salma@exemple.ma',
      phone: '612345678',
      acceptNewsletter: false,
      createAccount: false,
    },
    address: {
      line1: '12 rue des Pivoines',
      quartier: 'Gauthier',
      city: 'casablanca' as const,
      country: 'MA' as const,
      shippingMode: 'standard' as const,
    },
    paymentMethod: 'cod' as const,
    consent: true as const,
  };

  it('accepte un payload complet', () => {
    expect(checkoutFormSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse si consent=false', () => {
    expect(
      checkoutFormSchema.safeParse({ ...valid, consent: false }).success,
    ).toBe(false);
  });
});
