// @vitest-environment node
/**
 * CHANTIER E — PHASE 8 DURCISSEMENT — couverture trou context-resolver.ts
 * (0 % → cible). C'est le pont lead → variables Handlebars : il alimente
 * firstName/orderCount/totalSpent/dates/URLs de TOUT email custom. Un bug ici
 * = email envoyé avec un mauvais prénom, un mauvais total, ou un fallback raté.
 *
 * Oracle métier (vraie DB) :
 *   - identité : `firstName` = premier token du nom ; fallback « cliente » si nom
 *     absent/vide/espaces ; `fullName`/`email`/`phone` reflètent le lead.
 *   - commerce : `orderCount` et `totalSpent` AGRÉGÉS sur les vraies commandes ;
 *     `lastOrderId`/`lastOrderDate`/`lastOrderTotal` = commande la PLUS RÉCENTE.
 *   - best-effort : email inconnu → identité fallback, commerce à zéro, PAS
 *     d'exception (les URLs/dates restent calculées).
 *   - dates : déterministes via `now` injecté (jour FR, mois FR, année).
 *   - précédence : `customVars` ÉCRASE les clés calculées (override template).
 *   - normalisation : l'email de sortie est trim + lowercase.
 *
 * IDs : TPL-CUS-CTX-001..012 (module 06-templates, surface context-resolver).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_phase8#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/templates/custom/__qa__/context-resolver.integration.test.ts
 */
import { afterAll, beforeEach, expect, it } from 'vitest';

import { createId } from '@/lib/ids';
import { leads, orders } from '@/lib/db/schema';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { buildEmailContext } from '../context-resolver';
import { TEMPLATE_VARIABLE_KEYS } from '@/components/admin/emails/templates/template-variables';

// Init PARESSEUSE (emailsTestDb()/emailsTestSql() throw sans URL femiglow_test).
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, prop) => (emailsTestSql() as never)[prop],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

// 12 juin 2026 = un vendredi → dayOfWeek déterministe.
const NOW = new Date('2026-06-12T09:00:00.000Z');

async function cleanup(): Promise<void> {
  // orders FK → leads ; truncateEmailTables ne touche ni leads ni orders.
  await pg`DELETE FROM orders`;
  await pg`DELETE FROM leads`;
  await truncateEmailTables();
}

async function seedLead(over: Partial<typeof leads.$inferInsert> = {}) {
  const row = {
    id: createId('l'),
    email: 'cliente@exemple.test',
    name: 'Salma Benani',
    phone: '+212600112233',
    consentMarketing: true,
    ...over,
  };
  await db.insert(leads).values(row);
  return row;
}

async function seedOrder(
  leadId: string,
  totalCents: number,
  createdAt: Date,
  over: Partial<typeof orders.$inferInsert> = {},
) {
  const row = {
    id: createId('ord'),
    leadId,
    totalCents,
    currency: 'MAD',
    shippingMode: 'standard',
    paymentMethod: 'cod',
    createdAt,
    ...over,
  };
  await db.insert(orders).values(row);
  return row;
}

describeEmailsDb('context-resolver — pont lead → variables (vraie DB)', () => {
  beforeEach(cleanup);
  afterAll(closeTestDb);

  // TPL-CUS-CTX-001 — identité résolue depuis le lead.
  it('résout firstName (premier token) + fullName + phone depuis le lead', async () => {
    const lead = await seedLead({ name: 'Salma Benani', phone: '+212600112233' });

    const ctx = await buildEmailContext(lead.email, { now: NOW });

    expect(ctx.firstName).toBe('Salma');
    expect(ctx.fullName).toBe('Salma Benani');
    expect(ctx.phone).toBe('+212600112233');
    expect(ctx.email).toBe('cliente@exemple.test');
  });

  // TPL-CUS-CTX-002 — fallback identité quand le nom est null.
  it('retombe sur « cliente » quand le lead n a pas de nom', async () => {
    const lead = await seedLead({ name: null });
    const ctx = await buildEmailContext(lead.email, { now: NOW });
    expect(ctx.firstName).toBe('cliente');
    // fullName retombe sur firstName quand name est null.
    expect(ctx.fullName).toBe('cliente');
  });

  // TPL-CUS-CTX-003 — nom uniquement espaces → fallback (pickFirstName trim).
  it('retombe sur « cliente » quand le nom n est que des espaces', async () => {
    const lead = await seedLead({ name: '   ' });
    const ctx = await buildEmailContext(lead.email, { now: NOW });
    expect(ctx.firstName).toBe('cliente');
  });

  // TPL-CUS-CTX-004 — email INCONNU : best-effort, aucune exception, commerce à 0.
  it('best-effort sur email inconnu : fallback identité, commerce à zéro, pas d exception', async () => {
    const ctx = await buildEmailContext('inconnue@exemple.test', { now: NOW });
    expect(ctx.firstName).toBe('cliente');
    expect(ctx.orderCount).toBe(0);
    expect(ctx.totalSpent).toBe('0 MAD');
    expect(ctx.lastOrderId).toBe('');
    expect(ctx.lastOrderDate).toBe('');
    expect(ctx.lastOrderTotal).toBe('');
    // Les dérivés indépendants du lead restent calculés.
    expect(ctx.country).toBe('MA');
    expect(typeof ctx.today).toBe('string');
  });

  // TPL-CUS-CTX-005 — agrégation commerce : orderCount + totalSpent sur vraies commandes.
  it('agrège orderCount et totalSpent sur toutes les commandes du lead', async () => {
    const lead = await seedLead();
    await seedOrder(lead.id, 19900, new Date('2026-05-01T10:00:00Z'));
    await seedOrder(lead.id, 30000, new Date('2026-05-10T10:00:00Z'));
    await seedOrder(lead.id, 50100, new Date('2026-06-01T10:00:00Z'));

    const ctx = await buildEmailContext(lead.email, { now: NOW });

    expect(ctx.orderCount).toBe(3);
    // 19900 + 30000 + 50100 = 100000 cents = 1000 MAD.
    expect(ctx.totalSpent).toBe('1000 MAD');
  });

  // TPL-CUS-CTX-006 — lastOrder* = la commande la plus RÉCENTE (desc createdAt).
  it('lastOrderId/Total pointent sur la commande la plus récente', async () => {
    const lead = await seedLead();
    await seedOrder(lead.id, 19900, new Date('2026-05-01T10:00:00Z'));
    const recent = await seedOrder(lead.id, 88800, new Date('2026-06-09T10:00:00Z'));

    const ctx = await buildEmailContext(lead.email, { now: NOW });

    expect(ctx.lastOrderId).toBe(recent.id);
    // 88800 cents = 888 MAD.
    expect(ctx.lastOrderTotal).toBe('888 MAD');
    // Date FR formatée (jour 09, juin 2026).
    expect(ctx.lastOrderDate).toContain('2026');
    expect(ctx.lastOrderDate).toContain('juin');
  });

  // TPL-CUS-CTX-007 — lead SANS commande : commerce à zéro mais identité résolue.
  it('lead sans commande : orderCount 0, totalSpent 0 MAD, identité résolue', async () => {
    const lead = await seedLead({ name: 'Imane' });
    const ctx = await buildEmailContext(lead.email, { now: NOW });
    expect(ctx.firstName).toBe('Imane');
    expect(ctx.orderCount).toBe(0);
    expect(ctx.totalSpent).toBe('0 MAD');
    expect(ctx.lastOrderId).toBe('');
  });

  // TPL-CUS-CTX-008 — dates déterministes via `now` injecté.
  it('calcule les dates FR de façon déterministe depuis `now`', async () => {
    const lead = await seedLead();
    const ctx = await buildEmailContext(lead.email, { now: NOW });
    // 12 juin 2026 = vendredi.
    expect(ctx.dayOfWeek).toBe('Vendredi');
    expect(ctx.currentMonth).toBe('Juin');
    expect(ctx.currentYear).toBe('2026');
    // tomorrow = 13 juin → contient « 2026 ».
    expect(String(ctx.tomorrow)).toContain('2026');
  });

  // TPL-CUS-CTX-009 — URLs construites, unsubscribeUrl porte l email encodé.
  it('construit les URLs avec l email normalisé encodé dans unsubscribeUrl', async () => {
    const lead = await seedLead({ email: 'a+b@exemple.test' });
    const ctx = await buildEmailContext(lead.email, { now: NOW });
    expect(String(ctx.unsubscribeUrl)).toContain('/api/mail/unsubscribe?email=');
    // '+' encodé → %2B (pas de '+' brut dans la query).
    expect(String(ctx.unsubscribeUrl)).toContain('a%2Bb%40exemple.test');
    expect(String(ctx.shopUrl)).toContain('/rituel');
  });

  // TPL-CUS-CTX-010 — customVars ÉCRASE les clés calculées (précédence template).
  it('customVars override les clés calculées (firstName injecté gagne)', async () => {
    const lead = await seedLead({ name: 'Salma' });
    const ctx = await buildEmailContext(lead.email, {
      now: NOW,
      customVars: { firstName: 'Madame', code: 'VIP10' },
    });
    expect(ctx.firstName).toBe('Madame');
    expect(ctx.code).toBe('VIP10');
  });

  // TPL-CUS-CTX-011 — triggerEvent propagé dans ctx.trigger.
  it('propage le triggerEvent dans ctx.trigger', async () => {
    const lead = await seedLead();
    const ctx = await buildEmailContext(lead.email, {
      now: NOW,
      triggerEvent: { eventName: 'cart.abandoned', properties: { cartId: 'c1' } },
    });
    expect(ctx.trigger).toEqual({
      eventName: 'cart.abandoned',
      properties: { cartId: 'c1' },
    });
  });

  // TPL-CUS-CTX-012 — l email entrant MAJUSCULES + espaces est normalisé (match lead lowercase).
  it('normalise l email entrant (trim + lowercase) pour matcher le lead', async () => {
    const lead = await seedLead({ email: 'cliente@exemple.test', name: 'Kaoutar' });
    const ctx = await buildEmailContext('  CLIENTE@EXEMPLE.TEST  ', { now: NOW });
    // Le lead est retrouvé malgré la casse/espaces.
    expect(ctx.firstName).toBe('Kaoutar');
    expect(ctx.email).toBe('cliente@exemple.test');
    void lead;
  });

  // F07-I-112 — cohérence catalogue d'assistance ↔ resolver : chaque clé proposée
  // dans l'éditeur résout RÉELLEMENT ; city/address retirées (TPL-11).
  it('F07-I-112 : toutes les clés du catalogue de variables résolvent (et city/address sont retirées)', async () => {
    const ctx = (await buildEmailContext('inconnue@exemple.test', { now: NOW })) as Record<
      string,
      unknown
    >;
    for (const key of TEMPLATE_VARIABLE_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(ctx, key)).toBe(true);
    }
    expect(Object.prototype.hasOwnProperty.call(ctx, 'city')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(ctx, 'address')).toBe(false);
  });
});
