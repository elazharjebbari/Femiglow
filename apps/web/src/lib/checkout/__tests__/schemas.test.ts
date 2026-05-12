/**
 * Tests Zod schemas — CHA-230 wizard checkout.
 *
 * Stratégie : pour chaque schema critique on couvre :
 *   - cas valide minimal
 *   - cas valide complet (tous les optionnels)
 *   - cas invalide (champ requis manquant)
 *   - cas invalide (valeur hors enum / hors regex)
 */
import { describe, expect, it } from 'vitest';

import { formConfigJsonSchema } from '../form-config/schema';
import {
  cartSnapshotSchema,
  normalizePhoneToE164Maroc,
  phoneMaroc9DigitsSchema,
} from '../schemas/common';
import {
  createLeadInputSchema,
  optInEmailInputSchema,
  patchLeadAddressInputSchema,
  patchLeadPaymentInputSchema,
} from '../schemas/lead';
import { createOrderInputSchema } from '../schemas/order';
import {
  getStockResponseSchema,
  patchAdminStockInputSchema,
  stockNotifyInputSchema,
} from '../schemas/stock';

const validFormContext = {
  formId: 'wizard_kit',
  formMode: 'wizard_embed' as const,
  variantKey: 'A' as const,
};

describe('common — phoneMaroc9DigitsSchema', () => {
  it('accepte 9 chiffres commençant par 5/6/7', () => {
    expect(phoneMaroc9DigitsSchema.parse('612345678')).toBe('612345678');
    expect(phoneMaroc9DigitsSchema.parse('712345678')).toBe('712345678');
    expect(phoneMaroc9DigitsSchema.parse('512345678')).toBe('512345678');
  });
  it('rejette les autres préfixes', () => {
    expect(phoneMaroc9DigitsSchema.safeParse('012345678').success).toBe(false);
    expect(phoneMaroc9DigitsSchema.safeParse('212345678').success).toBe(false);
  });
  it('rejette les longueurs invalides', () => {
    expect(phoneMaroc9DigitsSchema.safeParse('61234567').success).toBe(false);
    expect(phoneMaroc9DigitsSchema.safeParse('6123456789').success).toBe(false);
  });
});

describe('common — normalizePhoneToE164Maroc', () => {
  it('normalise les formats courants en +212XXXXXXXXX', () => {
    expect(normalizePhoneToE164Maroc('612345678')).toBe('+212612345678');
    expect(normalizePhoneToE164Maroc('0612345678')).toBe('+212612345678');
    expect(normalizePhoneToE164Maroc('+212612345678')).toBe('+212612345678');
    expect(normalizePhoneToE164Maroc('00212612345678')).toBe('+212612345678');
    expect(normalizePhoneToE164Maroc('+212 6 12 34 56 78')).toBe('+212612345678');
    expect(normalizePhoneToE164Maroc('+212-6-12-34-56-78')).toBe('+212612345678');
  });
  it('retourne null pour les formats invalides', () => {
    expect(normalizePhoneToE164Maroc('1234')).toBeNull();
    expect(normalizePhoneToE164Maroc('+33612345678')).toBeNull(); // FR pas accepté
    expect(normalizePhoneToE164Maroc('abc')).toBeNull();
  });
});

describe('cartSnapshotSchema', () => {
  it('exige au moins 1 item, max 20', () => {
    expect(cartSnapshotSchema.safeParse({ items: [], totalCents: 0, currency: 'MAD' }).success).toBe(false);
    const items = Array.from({ length: 21 }, (_, i) => ({
      sku: `s${i}`,
      name: 'x',
      quantity: 1,
      unitPriceCents: 100,
    }));
    expect(cartSnapshotSchema.safeParse({ items, totalCents: 0, currency: 'MAD' }).success).toBe(false);
  });
  it('valide une payload minimale valide', () => {
    const parsed = cartSnapshotSchema.parse({
      items: [{ sku: 'KIT-100', name: 'Kit', quantity: 1, unitPriceCents: 29900 }],
      totalCents: 29900,
      currency: 'MAD',
    });
    expect(parsed.totalCents).toBe(29900);
  });
});

describe('createLeadInputSchema', () => {
  const valid = {
    formContext: validFormContext,
    firstName: 'Sara',
    phone: '612345678',
    consent: true as const,
    consentVersion: '2025-11-01',
    visitorId: 'visitor_12345678',
    sessionId: 'session_12345678',
    language: 'fr' as const,
  };

  it('accepte un payload minimal valide', () => {
    expect(createLeadInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejette un consent absent ou false', () => {
    expect(createLeadInputSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    const { consent: _consent, ...withoutConsent } = valid;
    expect(createLeadInputSchema.safeParse(withoutConsent).success).toBe(false);
  });

  it('rejette un firstName trop court', () => {
    expect(createLeadInputSchema.safeParse({ ...valid, firstName: 'X' }).success).toBe(false);
  });

  it('accepte un cartSnapshot complet', () => {
    const parsed = createLeadInputSchema.parse({
      ...valid,
      cartSnapshot: {
        items: [{ sku: 'KIT-100', name: 'Kit', quantity: 1, unitPriceCents: 29900 }],
        totalCents: 29900,
        currency: 'MAD',
      },
    });
    expect(parsed.cartSnapshot?.totalCents).toBe(29900);
  });
});

describe('patchLeadAddressInputSchema', () => {
  it('accepte une adresse minimale (city + addressLine1)', () => {
    expect(
      patchLeadAddressInputSchema.safeParse({
        city: 'Casablanca',
        addressLine1: '12 rue Allal Ben Abdellah',
      }).success,
    ).toBe(true);
  });

  it('accepte un addressLine1 absent (Mode B panier) ou vide', () => {
    // CHA-233 — Mode B (panier) accepte une adresse vide. Seul le serveur
    // exige la ville pour la livraison.
    expect(
      patchLeadAddressInputSchema.safeParse({ city: 'Casablanca' }).success,
    ).toBe(true);
    expect(
      patchLeadAddressInputSchema.safeParse({ city: 'Casablanca', addressLine1: '' }).success,
    ).toBe(true);
  });

  it('rejette un addressLine1 trop long', () => {
    expect(
      patchLeadAddressInputSchema.safeParse({
        city: 'Casablanca',
        addressLine1: 'X'.repeat(161),
      }).success,
    ).toBe(false);
  });

  it('valide le postalCode optionnel (4-8 chiffres)', () => {
    expect(
      patchLeadAddressInputSchema.safeParse({
        city: 'Casablanca',
        addressLine1: '12 rue Allal',
        postalCode: '20000',
      }).success,
    ).toBe(true);
    expect(
      patchLeadAddressInputSchema.safeParse({
        city: 'Casablanca',
        addressLine1: '12 rue Allal',
        postalCode: 'abcde',
      }).success,
    ).toBe(false);
  });

  it('défaut country=MA et shippingMode=standard', () => {
    const parsed = patchLeadAddressInputSchema.parse({
      city: 'Casablanca',
      addressLine1: '12 rue Allal Ben Abdellah',
    });
    expect(parsed.country).toBe('MA');
    expect(parsed.shippingMode).toBe('standard');
  });
});

describe('patchLeadPaymentInputSchema', () => {
  it('accepte cod | bank_transfer | card', () => {
    for (const m of ['cod', 'bank_transfer', 'card'] as const) {
      expect(patchLeadPaymentInputSchema.parse({ paymentMethod: m }).paymentMethod).toBe(m);
    }
  });
  it('rejette les autres valeurs', () => {
    expect(patchLeadPaymentInputSchema.safeParse({ paymentMethod: 'paypal' }).success).toBe(false);
  });
});

describe('optInEmailInputSchema', () => {
  it('exige email valide + emailConsent=true', () => {
    expect(
      optInEmailInputSchema.safeParse({ email: 'sara@example.com', emailConsent: true })
        .success,
    ).toBe(true);
    expect(
      optInEmailInputSchema.safeParse({ email: 'not-an-email', emailConsent: true })
        .success,
    ).toBe(false);
    expect(
      optInEmailInputSchema.safeParse({ email: 'sara@example.com', emailConsent: false })
        .success,
    ).toBe(false);
  });
});

describe('createOrderInputSchema', () => {
  it('accepte un payload minimal valide', () => {
    const parsed = createOrderInputSchema.parse({
      leadId: 'cl_12345678',
      formContext: validFormContext,
      items: [{ sku: 'KIT-100', name: 'Kit', quantity: 1, unitPriceCents: 29900 }],
      expectedTotalCents: 29900,
      paymentMethod: 'cod',
    });
    expect(parsed.currency).toBe('MAD');
    expect(parsed.shippingMode).toBe('standard');
  });

  it('rejette des items vides', () => {
    expect(
      createOrderInputSchema.safeParse({
        leadId: 'cl_12345678',
        formContext: validFormContext,
        items: [],
        expectedTotalCents: 0,
        paymentMethod: 'cod',
      }).success,
    ).toBe(false);
  });
});

describe('stock schemas', () => {
  it('getStockResponseSchema — shape complète', () => {
    expect(
      getStockResponseSchema.parse({
        variantId: 'pvar_1',
        sku: 'KIT-100',
        status: 'low_stock',
        effectiveDisplay: 3,
        thresholdLow: 5,
      }),
    ).toBeTruthy();
  });

  it('stockNotifyInputSchema — exige email OU phone', () => {
    expect(
      stockNotifyInputSchema.safeParse({
        variantId: 'pvar_12345678',
        visitorId: 'visitor_12345678',
        consent: true,
      }).success,
    ).toBe(false);
    expect(
      stockNotifyInputSchema.safeParse({
        variantId: 'pvar_12345678',
        visitorId: 'visitor_12345678',
        email: 'sara@example.com',
        consent: true,
      }).success,
    ).toBe(true);
  });

  it('patchAdminStockInputSchema — actions set/increment/set_threshold', () => {
    for (const action of ['set', 'increment', 'set_threshold'] as const) {
      expect(
        patchAdminStockInputSchema.parse({ variantId: 'pvar_12345678', action, value: 100 })
          .action,
      ).toBe(action);
    }
  });
});

describe('formConfigJsonSchema', () => {
  const validConfig = {
    steps: ['lead', 'address', 'payment', 'thank_you'] as const,
    modes: ['wizard_embed'] as const,
    defaults: {
      formMode: 'wizard_embed' as const,
      currency: 'MAD',
      country: 'MA',
      paymentMethods: ['cod', 'bank_transfer'] as const,
      defaultShippingMode: 'standard' as const,
    },
    copy: {
      title: 'Commander',
      cta_lead: 'Continuer',
      cta_address: 'Payer',
      cta_payment: 'Confirmer',
      thank_you_title: 'Merci',
    },
    validation: {
      phone_min_length: 9,
      phone_max_length: 13,
      require_email_on_thank_you: false,
      require_postal_code: false,
    },
  };

  it('accepte une config valide minimale', () => {
    expect(formConfigJsonSchema.safeParse(validConfig).success).toBe(true);
  });

  it('exige les 4 steps obligatoires (lead, address, payment, thank_you)', () => {
    expect(
      formConfigJsonSchema.safeParse({
        ...validConfig,
        steps: ['lead', 'payment', 'thank_you'], // address manquant
      }).success,
    ).toBe(false);
  });

  it('rejette les champs inconnus (strict)', () => {
    expect(
      formConfigJsonSchema.safeParse({ ...validConfig, extra: 'forbidden' }).success,
    ).toBe(false);
  });

  it('accepte cart_review optionnel pour mode B', () => {
    expect(
      formConfigJsonSchema.safeParse({
        ...validConfig,
        steps: ['cart_review', 'lead', 'address', 'payment', 'thank_you'],
        modes: ['wizard_cart'],
        defaults: { ...validConfig.defaults, formMode: 'wizard_cart' },
      }).success,
    ).toBe(true);
  });
});
