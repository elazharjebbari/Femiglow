/**
 * Tests repo crédits de fidélité (Phase 3) — émission idempotente, validation,
 * rédemption à usage unique, expiration. memoryStore.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  findGrantByCode,
  generateGrantCode,
  issueGrant,
  redeemGrant,
  validateGrant,
} from './coupon-grant-repo';

beforeEach(() => resetMemoryStore());

const base = {
  templateCouponId: 'cpn_tpl',
  leadId: 'lead_1',
  valueCents: 2000,
  currency: 'MAD',
};

describe('P3 émission', () => {
  it('U001 émet un crédit avec code unique « FG-… »', async () => {
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    expect(g?.code).toMatch(/^FG-[A-Z2-9]{6}$/);
    expect(g?.status).toBe('issued');
    expect(g?.valueCents).toBe(2000);
  });

  it('U002 idempotent : un seul crédit par commande source', async () => {
    const a = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    const b = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    expect(a?.id).toBe(b?.id); // même crédit renvoyé
  });

  it('U003 generateGrantCode évite les caractères ambigus', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateGrantCode()).not.toMatch(/[IO01]/);
    }
  });
});

describe('P3 validation / rédemption', () => {
  it('U010 code inconnu → invalid (not_found)', async () => {
    const v = await validateGrant('FG-ZZZZZZ');
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('not_found');
  });

  it('U011 valide tant que issued + non expiré', async () => {
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    const v = await validateGrant(g!.code);
    expect(v.valid).toBe(true);
    if (v.valid) expect(v.valueCents).toBe(2000);
  });

  it('U012 rédemption marque redeemed + lie la commande, et bloque la réutilisation', async () => {
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    const redeemed = await redeemGrant(g!.code, 'o_2');
    expect(redeemed?.status).toBe('redeemed');
    expect(redeemed?.redeemedOrderId).toBe('o_2');
    // 2e tentative → refusée
    expect(await redeemGrant(g!.code, 'o_3')).toBeNull();
    const v = await validateGrant(g!.code);
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('already_redeemed');
  });

  it('U013 crédit expiré → invalid (expired) et non redeemable', async () => {
    const past = new Date('2026-01-01T00:00:00Z');
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1', expiresAt: past });
    const now = new Date('2026-06-02T00:00:00Z');
    const v = await validateGrant(g!.code, now);
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('expired');
    expect(await redeemGrant(g!.code, 'o_2', now)).toBeNull();
  });

  it('U014 code insensible à la casse', async () => {
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    const v = await validateGrant(g!.code.toLowerCase());
    expect(v.valid).toBe(true);
    expect(await findGrantByCode(g!.code)).not.toBeNull();
  });
});
