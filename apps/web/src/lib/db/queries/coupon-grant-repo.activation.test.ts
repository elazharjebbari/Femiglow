/**
 * F20 — Cycle de vie du crédit fidélité : activation différée + unicité + 60 j.
 *
 * Couche I (Vitest + memoryStore + horloge injectée, AUCUN Date.now() dans les
 * oracles). Verrouille : maxDeliveryDays/computeActivatesAt (délai ville),
 * issueGrant idempotent (commande + téléphone), expiresAt = activatesAt + 60 j,
 * et toutes les frontières/raisons de validateGrant.
 *
 * S'appuie sur les VRAIES fonctions ; dates injectées depuis les fixtures.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  ACTIVATION_BUFFER_DAYS,
  computeActivatesAt,
  DEFAULT_MAX_DELIVERY_DAYS,
  maxDeliveryDays,
} from '@/lib/coupons/delivery-delay';
import {
  findActiveGrantByPhone,
  generateMemorableGrantCode,
  GRANT_VALIDITY_DAYS,
  issueGrant,
  listGrants,
  redeemGrant,
  validateGrant,
} from './coupon-grant-repo';
import fixtures from './__fixtures__/activation.fixtures.json';

beforeEach(() => resetMemoryStore());

const DAY_MS = 24 * 3600 * 1000;

describe('F20 maxDeliveryDays (INV-ACTIVATION parse)', () => {
  it('F20-I001 « 48 à 72 h » → 3 (borne haute heures, ceil(72/24))', () => {
    expect(maxDeliveryDays(fixtures.eta.h48_72.value)).toBe(3);
  });

  it('F20-I002 « 24h » → 1', () => {
    expect(maxDeliveryDays(fixtures.eta.h24.value)).toBe(1);
  });

  it('F20-I003 « 24-48h » → 2', () => {
    expect(maxDeliveryDays(fixtures.eta.h24_48.value)).toBe(2);
  });

  it('F20-I004 « 3-5 jours » → 5 (borne haute jours)', () => {
    expect(maxDeliveryDays(fixtures.eta.d3_5.value)).toBe(5);
  });

  it('F20-I005 null → DEFAULT_MAX_DELIVERY_DAYS=4', () => {
    expect(maxDeliveryDays(fixtures.eta.none.value)).toBe(4);
    expect(maxDeliveryDays(null)).toBe(DEFAULT_MAX_DELIVERY_DAYS);
  });

  it('F20-I006 libellé non parsable « express » → 4', () => {
    expect(maxDeliveryDays(fixtures.eta.express.value)).toBe(4);
  });
});

describe('F20 computeActivatesAt (INV-ACTIVATION formule)', () => {
  it('F20-I007 commande + livraison(3) + buffer(1) = +4 jours (« 48 à 72 h »)', () => {
    const orderDate = new Date(fixtures.order.date);
    const got = computeActivatesAt(orderDate, fixtures.eta.h48_72.value);
    const expected = new Date(orderDate.getTime() + 4 * DAY_MS);
    expect(got.getTime()).toBe(expected.getTime());
    expect(ACTIVATION_BUFFER_DAYS).toBe(1);
  });

  it('F20-I008 eta null → défaut(4) + buffer(1) = +5 jours', () => {
    const orderDate = new Date(fixtures.order.date);
    const got = computeActivatesAt(orderDate, fixtures.eta.none.value);
    const expected = new Date(orderDate.getTime() + 5 * DAY_MS);
    expect(got.getTime()).toBe(expected.getTime());
  });
});

describe('F20 émission & code mémorable', () => {
  it('F20-I009 issueGrant → code mémorable, status issued, valueCents', async () => {
    const g = await issueGrant({ ...fixtures.issue.base });
    expect(g?.code).toMatch(/^FG-[A-Z]+-\d{4}$/);
    expect(g?.status).toBe('issued');
    expect(g?.valueCents).toBe(2000);
  });

  it('F20-I010 generateMemorableGrantCode au format FG-<MOT>-<NNNN>', () => {
    const re = new RegExp(`^FG-(${fixtures.words.join('|')})-\\d{4}$`);
    for (let i = 0; i < 30; i += 1) {
      expect(generateMemorableGrantCode()).toMatch(re);
    }
  });
});

describe('F20 idempotence & unicité (INV-IDEMP-ORDER / INV-IDEMP-PHONE)', () => {
  it('F20-I011 idempotent par sourceOrderId → même grant', async () => {
    const a = await issueGrant({ ...fixtures.issue.base });
    const b = await issueGrant({ ...fixtures.issue.base });
    expect(a?.id).toBe(b?.id);
    expect(a?.code).toBe(b?.code);
  });

  it('F20-I012 unicité par téléphone : 2 commandes même phone → même code, 1 seul grant', async () => {
    const { phoneE164 } = fixtures.issue.phoneA;
    const [order0, order1] = fixtures.issue.phoneA.orders as [string, string];
    const a = await issueGrant({
      templateCouponId: fixtures.issue.phoneA.templateCouponId,
      leadId: fixtures.issue.phoneA.leadId,
      valueCents: fixtures.issue.phoneA.valueCents,
      currency: fixtures.issue.phoneA.currency,
      sourceOrderId: order0,
      phoneE164,
    });
    const b = await issueGrant({
      templateCouponId: fixtures.issue.phoneA.templateCouponId,
      leadId: fixtures.issue.phoneA.leadId,
      valueCents: fixtures.issue.phoneA.valueCents,
      currency: fixtures.issue.phoneA.currency,
      sourceOrderId: order1,
      phoneE164,
    });
    expect(b?.code).toBe(a?.code);
    expect((await listGrants({ phoneE164 })).length).toBe(1);
  });

  it('F20-I013 findActiveGrantByPhone → issued ; téléphone inconnu → null', async () => {
    await issueGrant({ ...fixtures.issue.phoneB });
    const found = await findActiveGrantByPhone(fixtures.issue.phoneB.phoneE164);
    expect(found?.status).toBe('issued');
    expect(await findActiveGrantByPhone('+212699999999')).toBeNull();
  });
});

describe('F20 validité 60 j & frontières (INV-VALIDITY / INV-ACTIVATION)', () => {
  const activated = fixtures.issue.activated;

  function issueActivated() {
    return issueGrant({
      templateCouponId: activated.templateCouponId,
      leadId: activated.leadId,
      sourceOrderId: activated.sourceOrderId,
      valueCents: activated.valueCents,
      currency: activated.currency,
      phoneE164: activated.phoneE164,
      activatesAt: new Date(activated.activatesAt),
    });
  }

  it('F20-I014 expiresAt = activatesAt + 60 jours ; GRANT_VALIDITY_DAYS=60', async () => {
    const g = await issueActivated();
    const activatesAt = new Date(activated.activatesAt).getTime();
    const expiresAt = new Date(g!.expiresAt!).getTime();
    expect(Math.round((expiresAt - activatesAt) / DAY_MS)).toBe(60);
    expect(GRANT_VALIDITY_DAYS).toBe(60);
    // parité avec la date dérivée attendue de la fixture
    expect(new Date(g!.expiresAt!).getTime()).toBe(new Date(activated.derivedExpiresAt).getTime());
  });

  it('F20-I015 avant activatesAt → not_yet_active + activatesAt fourni', async () => {
    const g = await issueActivated();
    const v = await validateGrant(g!.code, new Date(fixtures.now.before));
    expect(v.valid).toBe(false);
    if (!v.valid) {
      expect(v.reason).toBe('not_yet_active');
      expect(v.activatesAt).toBeTruthy();
    }
  });

  it('F20-I016 now === activatesAt → valide (borne incluse)', async () => {
    const g = await issueActivated();
    const v = await validateGrant(g!.code, new Date(fixtures.now.atActivation));
    expect(v.valid).toBe(true);
  });

  it('F20-I017 activatesAt - 1ms → not_yet_active (strictement avant)', async () => {
    const g = await issueActivated();
    const v = await validateGrant(g!.code, new Date(fixtures.now.justBefore));
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('not_yet_active');
  });

  it('F20-I018 dans la fenêtre → valide + valueCents', async () => {
    const g = await issueActivated();
    const v = await validateGrant(g!.code, new Date(fixtures.now.inWindow));
    expect(v.valid).toBe(true);
    if (v.valid) expect(v.valueCents).toBe(2000);
  });

  it('F20-I019 now === expiresAt → valide (borne incluse)', async () => {
    const g = await issueActivated();
    const v = await validateGrant(g!.code, new Date(fixtures.now.atExpiry));
    expect(v.valid).toBe(true);
  });

  it('F20-I020 après expiresAt → expired', async () => {
    const g = await issueActivated();
    const v = await validateGrant(g!.code, new Date(fixtures.now.afterExpiry));
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('expired');
  });
});

describe('F20 raisons & robustesse (INV-VALIDITY)', () => {
  const activated = fixtures.issue.activated;
  function issueActivated() {
    return issueGrant({
      templateCouponId: activated.templateCouponId,
      leadId: activated.leadId,
      sourceOrderId: activated.sourceOrderId,
      valueCents: activated.valueCents,
      currency: activated.currency,
      phoneE164: activated.phoneE164,
      activatesAt: new Date(activated.activatesAt),
    });
  }

  it('F20-I021 code inconnu → not_found', async () => {
    const v = await validateGrant(fixtures.unknown.code);
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('not_found');
  });

  it('F20-I022 consommé → already_redeemed (prioritaire)', async () => {
    const g = await issueActivated();
    // redeem dans la fenêtre de validité
    const now = new Date(fixtures.now.inWindow);
    await redeemGrant(g!.code, 'o_redeem', now);
    const v = await validateGrant(g!.code, now);
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.reason).toBe('already_redeemed');
  });

  it('F20-I023 insensible casse + espaces : « fg-...-NNNN » résout le grant', async () => {
    const g = await issueActivated();
    const padded = `  ${g!.code.toLowerCase()}  `;
    const v = await validateGrant(padded, new Date(fixtures.now.inWindow));
    expect(v.valid).toBe(true);
  });

  it('F20-I024 activatesAt null → jamais not_yet_active', async () => {
    const g = await issueGrant({
      templateCouponId: fixtures.issue.noActivation.templateCouponId,
      leadId: fixtures.issue.noActivation.leadId,
      sourceOrderId: fixtures.issue.noActivation.sourceOrderId,
      valueCents: fixtures.issue.noActivation.valueCents,
      currency: fixtures.issue.noActivation.currency,
      activatesAt: null,
    });
    const v = await validateGrant(g!.code, new Date('2026-01-01T00:00:00.000Z'));
    expect(v.valid).toBe(true);
  });
});

describe('F20 bout-en-bout livraison → états grant (INV-ACTIVATION + INV-VALIDITY)', () => {
  it('F20-I025 délai ville → activatesAt → not_yet_active puis valide', async () => {
    const e2e = fixtures.e2e.delivery;
    const orderDate = new Date(e2e.orderDate);
    const activatesAt = computeActivatesAt(orderDate, e2e.eta);
    expect(activatesAt.getTime()).toBe(new Date(e2e.expectedActivatesAt).getTime());

    const g = await issueGrant({
      templateCouponId: 'cpn_tpl',
      leadId: 'lead_e2e',
      sourceOrderId: 'o_e2e',
      valueCents: 2000,
      currency: 'MAD',
      phoneE164: '+212600000099',
      activatesAt,
    });
    expect(new Date(g!.expiresAt!).getTime()).toBe(new Date(e2e.expectedExpiresAt).getTime());

    const before = await validateGrant(g!.code, new Date(e2e.nowBefore));
    expect(before.valid).toBe(false);
    if (!before.valid) expect(before.reason).toBe('not_yet_active');

    const after = await validateGrant(g!.code, new Date(e2e.nowAfter));
    expect(after.valid).toBe(true);
  });
});
