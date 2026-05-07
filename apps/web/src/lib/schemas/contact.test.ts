import { describe, it, expect } from 'vitest';
import { contactFormSchema } from './contact';

const baseValid = {
  name: 'Léa',
  email: 'lea@example.com',
  message: 'Bonjour, j\u2019ai une question pour la maison FemiGlow.',
  gdprConsent: true as const,
  newsletterOptIn: false,
};

describe('contactFormSchema', () => {
  it('accepte une demande question minimale', () => {
    const result = contactFormSchema.safeParse({ type: 'question', ...baseValid });
    expect(result.success).toBe(true);
  });

  it('exige orderNumber quand type = order', () => {
    const result = contactFormSchema.safeParse({ type: 'order', ...baseValid });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.orderNumber?.[0]).toMatch(/numéro de commande/i);
    }
  });

  it('exige phone, companyName et role quand type = professional', () => {
    const result = contactFormSchema.safeParse({ type: 'professional', ...baseValid });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.phone?.[0]).toBeTruthy();
      expect(fields.companyName?.[0]).toBeTruthy();
      expect(fields.role?.[0]).toBeTruthy();
    }
  });

  it('refuse gdprConsent absent', () => {
    const result = contactFormSchema.safeParse({
      type: 'question',
      ...baseValid,
      gdprConsent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.gdprConsent?.[0]).toMatch(/consentement/i);
    }
  });

  it('refuse un message trop court', () => {
    const result = contactFormSchema.safeParse({
      type: 'question',
      ...baseValid,
      message: 'Court.',
    });
    expect(result.success).toBe(false);
  });

  it('autorise une demande professional complète', () => {
    const result = contactFormSchema.safeParse({
      type: 'professional',
      ...baseValid,
      phone: '+212 6 00 00 00 00',
      companyName: 'Atelier des Acacias',
      role: 'Directrice retail',
    });
    expect(result.success).toBe(true);
  });
});
