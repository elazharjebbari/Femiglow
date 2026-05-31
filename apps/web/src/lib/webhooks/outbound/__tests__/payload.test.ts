/**
 * CHA-260 — Tests unit du module `payload.ts`.
 *
 * Vérifie :
 *   - le schéma Zod valide / refuse correctement les champs requis ;
 *   - le strip des optionnels null/empty ;
 *   - les helpers `composeFullName` / `formatPhoneForWebhook` /
 *     `normalizePhoneForPayload`.
 */
import { describe, expect, it } from 'vitest';

import {
  OutboundPayloadValidationError,
  composeFullName,
  formatPhoneForWebhook,
  normalizePhoneForPayload,
  validateOutboundPayload,
} from '../payload';

describe('validateOutboundPayload — requis et défauts', () => {
  it('accepte un payload minimal valide et applique les défauts', () => {
    const out = validateOutboundPayload({
      id: 'order-2026-0042',
      full_name: 'Youssef Amrani',
      phone: '0661234567',
    });
    expect(out.id).toBe('order-2026-0042');
    expect(out.currency).toBe('MAD');
    expect(out.quantity).toBe(1);
  });

  it('strip les optionnels null / undefined / chaîne vide', () => {
    const out = validateOutboundPayload({
      id: 'x_001',
      full_name: 'A',
      phone: '0612345678',
      address: '',
      city: null,
      country: undefined,
      email: '',
    });
    expect('address' in out).toBe(false);
    expect('city' in out).toBe(false);
    expect('country' in out).toBe(false);
    expect('email' in out).toBe(false);
  });

  it('accepte source et conversation conforme', () => {
    const out = validateOutboundPayload({
      id: 'chat-lead:cl_1',
      full_name: 'Sara',
      phone: '0612345678',
      source: 'chat_widget',
      conversation: [
        {
          role: 'user',
          name: 'Sara',
          text: 'Je veux commander',
          ts: '2026-05-14T10:00:00.000Z',
        },
      ],
    });
    expect(out.source).toBe('chat_widget');
    expect(out.conversation?.[0]?.role).toBe('user');
  });

  it('rejette une conversation de plus de 50 messages', () => {
    expect(() =>
      validateOutboundPayload({
        id: 'chat-lead:cl_1',
        full_name: 'Sara',
        phone: '0612345678',
        conversation: Array.from({ length: 51 }, (_, i) => ({
          role: 'user',
          text: `msg ${i}`,
          ts: '2026-05-14T10:00:00.000Z',
        })),
      }),
    ).toThrow(OutboundPayloadValidationError);
  });

  it('rejette un payload sans id / full_name / phone', () => {
    expect(() => validateOutboundPayload({})).toThrow(OutboundPayloadValidationError);
    expect(() => validateOutboundPayload({ id: 'a' })).toThrow(OutboundPayloadValidationError);
    expect(() => validateOutboundPayload({ id: 'a', full_name: 'B' })).toThrow(
      OutboundPayloadValidationError,
    );
  });

  it('rejette une devise non ISO-3', () => {
    expect(() =>
      validateOutboundPayload({
        id: 'x',
        full_name: 'A',
        phone: '0612345678',
        currency: 'eur',
      }),
    ).toThrow();
    expect(() =>
      validateOutboundPayload({
        id: 'x',
        full_name: 'A',
        phone: '0612345678',
        currency: 'EUR3',
      }),
    ).toThrow();
  });

  it('rejette un id avec caractères interdits', () => {
    expect(() =>
      validateOutboundPayload({
        id: 'a b c', // espace interdit
        full_name: 'A',
        phone: '0612345678',
      }),
    ).toThrow();
  });
});

describe('composeFullName', () => {
  it('joint prénom + nom', () => {
    expect(composeFullName('Yas', 'Amrani')).toBe('Yas Amrani');
  });
  it('renvoie le prénom seul si nom absent', () => {
    expect(composeFullName('Yas')).toBe('Yas');
    expect(composeFullName('Yas', null)).toBe('Yas');
  });
  it('chaîne vide si rien', () => {
    expect(composeFullName('', null)).toBe('');
  });
});

describe('normalizePhoneForPayload', () => {
  it('renvoie ok=true et format trunk pour un MA valide', () => {
    const r = normalizePhoneForPayload('+212661234567', 'MA');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('0661234567');
      expect(r.e164).toBe('+212661234567');
    }
  });

  it('renvoie ok=false reason=empty pour vide', () => {
    const r = normalizePhoneForPayload('', 'MA');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty');
  });

  it('renvoie ok=false reason=invalid pour numéro mal formé', () => {
    const r = normalizePhoneForPayload('abc', 'MA');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid');
  });
});

describe('formatPhoneForWebhook — trunk countries', () => {
  it('préfixe 0 pour MA', () => {
    expect(
      formatPhoneForWebhook({
        e164: '+212661234567',
        country: 'MA',
        countryCallingCode: '212',
        national: '661234567',
        type: 'mobile',
      }),
    ).toBe('0661234567');
  });
  it('préfixe 0 pour FR', () => {
    expect(
      formatPhoneForWebhook({
        e164: '+33612345678',
        country: 'FR',
        countryCallingCode: '33',
        national: '612345678',
        type: 'mobile',
      }),
    ).toBe('0612345678');
  });
  it('garde E.164 pour TN (pas de trunk)', () => {
    expect(
      formatPhoneForWebhook({
        e164: '+21620123456',
        country: 'TN',
        countryCallingCode: '216',
        national: '20123456',
        type: 'mobile',
      }),
    ).toBe('+21620123456');
  });
});
