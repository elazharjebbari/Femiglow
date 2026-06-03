/**
 * Tests repo crédits de fidélité (Phase 3) — émission idempotente, validation,
 * rédemption à usage unique, expiration. memoryStore.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  findActiveGrantByPhone,
  findGrantByCode,
  generateGrantCode,
  generateMemorableGrantCode,
  issueGrant,
  listGrants,
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
  it('U001 émet un crédit avec code MÉMORABLE « FG-<MOT>-<NNNN> »', async () => {
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1' });
    expect(g?.code).toMatch(/^FG-[A-Z]+-\d{4}$/);
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
    // activatesAt très ancien → expiresAt = activatesAt + 60j toujours dépassé.
    const activatesAt = new Date('2026-01-01T00:00:00Z');
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1', activatesAt });
    const now = new Date('2026-06-02T00:00:00Z'); // > activatesAt + 60j
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

describe('LOY code mémorable + unicité téléphone + activation', () => {
  it('U020 generateMemorableGrantCode au format FG-<MOT>-<NNNN>', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(generateMemorableGrantCode()).toMatch(/^FG-(RITUEL|ATLAS|SAUGE|ECLAT|ACCUEIL|MAISON|GESTE|ATELIER|LUMIERE|SAISON)-\d{4}$/);
    }
  });

  it('U021 unicité par téléphone : 2 commandes même phone → même code', async () => {
    const a = await issueGrant({ ...base, sourceOrderId: 'o_1', phoneE164: '+212600000001' });
    const b = await issueGrant({ ...base, sourceOrderId: 'o_2', phoneE164: '+212600000001' });
    expect(b?.code).toBe(a?.code); // le crédit actif est réutilisé, pas de doublon
    expect((await listGrants({ phoneE164: '+212600000001' })).length).toBe(1);
  });

  it('U022 findActiveGrantByPhone renvoie le crédit issued', async () => {
    await issueGrant({ ...base, sourceOrderId: 'o_1', phoneE164: '+212600000002' });
    expect((await findActiveGrantByPhone('+212600000002'))?.status).toBe('issued');
    expect(await findActiveGrantByPhone('+212699999999')).toBeNull();
  });

  it('U023 activation différée : not_yet_active avant activatesAt', async () => {
    const activatesAt = new Date('2026-07-01T00:00:00Z');
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1', phoneE164: '+212600000003', activatesAt });
    const before = await validateGrant(g!.code, new Date('2026-06-15T00:00:00Z'));
    expect(before.valid).toBe(false);
    if (!before.valid) {
      expect(before.reason).toBe('not_yet_active');
      expect(before.activatesAt).toBeTruthy();
    }
    const after = await validateGrant(g!.code, new Date('2026-07-02T00:00:00Z'));
    expect(after.valid).toBe(true);
  });

  it('U024 expiresAt = activatesAt + 60 j', async () => {
    const activatesAt = new Date('2026-07-01T00:00:00Z');
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1', phoneE164: '+212600000004', activatesAt });
    const exp = new Date(g!.expiresAt!);
    expect(Math.round((exp.getTime() - activatesAt.getTime()) / (24 * 3600 * 1000))).toBe(60);
  });

  it('U025 listGrants filtre par statut', async () => {
    // Activation hier → ACTIF (now >= activatesAt) et NON expiré (+60j) → redeemable.
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const g = await issueGrant({ ...base, sourceOrderId: 'o_1', phoneE164: '+212600000005', activatesAt: yesterday });
    await redeemGrant(g!.code, 'o_redeem');
    expect((await listGrants({ status: 'redeemed' })).length).toBe(1);
    expect((await listGrants({ status: 'issued' })).length).toBe(0);
  });
});
