/**
 * CLI-INT-OPTIN-* — Opt-in email post-achat contre une VRAIE Postgres migrée.
 *
 * C'EST LE TEST QUI DEVIENT ROUGE SUR LE DRIFT lead_tag (uuid vs text).
 * Les tests à base de mocks acceptent n'importe quel type → ils masquent le
 * 500 observé en prod (34 échecs/30j). Ici on exécute la VRAIE route contre
 * le VRAI schéma : si `lead_tag.lead_id` diverge du type de `leads.id`,
 * l'INSERT du tag lève et la route renvoie 500 → ce test échoue bruyamment.
 *
 * Dépôt cible :
 *   apps/web/src/app/api/checkout/order/[orderId]/email/__tests__/integration.test.ts
 * Prérequis : DATABASE_URL_TEST migrée avec drizzle-kit migrate (cf.
 *   05-conventions-harnais §4) et lead_tag présent dans EMAIL_TABLES.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

import { leads, leadTag, orders, chatLead } from '@/lib/db/schema';
import { POST as createOrderUnused } from '@/app/api/checkout/order/route'; // type-only ref
import { PATCH } from '@/app/api/checkout/order/[orderId]/email/route';

void createOrderUnused; // garde l'import (ref symbolique au flow de commande)

const TEST_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://localhost/femiglow_test';

if (/femiglow(?!_test)/.test(TEST_URL)) {
  throw new Error('SÉCURITÉ : DATABASE_URL_TEST doit pointer une base de test.');
}

const sql = postgres(TEST_URL, { max: 4 });
const dbt = drizzle(sql);

// La route importe `db()` depuis @/lib/db/client ; on s'assure qu'il pointe
// la base de test (le harnais global configure DATABASE_URL=DATABASE_URL_TEST
// pour les suites d'intégration — cf. test-plan.yaml).

let leadId: string;
let chatLeadId: string;
let orderId: string;

async function seed() {
  leadId = `lead_${Date.now().toString(36)}`;
  chatLeadId = `cl_${Date.now().toString(36)}`;
  orderId = `o_${Date.now().toString(36)}`;

  await dbt.insert(leads).values({
    id: leadId,
    // colonnes minimales requises — à compléter selon schema.ts réel
    email: null as unknown as string,
    consentMarketing: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);

  await dbt.insert(chatLead).values({
    id: chatLeadId,
    firstName: 'Kaoutar',
    createdAt: new Date(),
  } as never);

  await dbt.insert(orders).values({
    id: orderId,
    leadId,
    chatLeadId,
    totalCents: 19900,
    currency: 'MAD',
    createdAt: new Date(),
  } as never);
}

function patchReq(body: unknown, idemKey = `idem_${Math.random()}`): Request {
  return new Request(`http://test/api/checkout/order/${orderId}/email`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idemKey,
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  // sanity : la table lead_tag doit exister (migration appliquée).
  await sql`SELECT 1 FROM lead_tag LIMIT 1`.catch(() => {
    throw new Error('lead_tag absente — exécuter drizzle-kit migrate sur la base de test.');
  });
});

afterEach(async () => {
  await sql`TRUNCATE lead_tag, orders, chat_lead, leads RESTART IDENTITY CASCADE`;
});

afterAll(async () => {
  await sql.end();
});

describe('CLI-INT-OPTIN — opt-in post-achat (vraie DB, attrape le drift lead_tag)', () => {
  it('CLI-INT-OPTIN-DRIFT/OK : opt-in crée le tag + maj leads + renvoie 200', async () => {
    await seed();
    const res = await PATCH(
      patchReq({ email: 'kaoutar@exemple.test', emailConsent: true }) as never,
      { params: { orderId } } as never,
    );

    // ORACLE DRIFT : si lead_tag.lead_id diverge du type de leads.id,
    // l'INSERT du tag lève → la route renvoie 500. On EXIGE 200.
    expect(
      res.status,
      'opt-in doit réussir ; un 500 ici = drift lead_tag (uuid vs text)',
    ).toBe(200);

    const tags = await dbt
      .select()
      .from(leadTag)
      .where(eq(leadTag.leadId, leadId));
    expect(tags).toHaveLength(1);
    expect(tags[0]!.tag).toBe('post-purchase-optin');

    const [lead] = await dbt.select().from(leads).where(eq(leads.id, leadId));
    expect(lead!.email).toBe('kaoutar@exemple.test');
    expect(lead!.consentMarketing).toBe(true);
  });

  it('CLI-INT-OPTIN-REPLAY : replay idempotent → 1 seul tag', async () => {
    await seed();
    const idem = 'idem-fixe-replay';
    const body = { email: 'kaoutar@exemple.test', emailConsent: true };

    const r1 = await PATCH(patchReq(body, idem) as never, { params: { orderId } } as never);
    const r2 = await PATCH(patchReq(body, idem) as never, { params: { orderId } } as never);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const tags = await dbt.select().from(leadTag).where(eq(leadTag.leadId, leadId));
    expect(tags, 'le replay ne doit pas dupliquer le tag').toHaveLength(1);
  });

  it('CLI-INT-OPTIN-NOORDER : orderId inexistant → 404 not_found', async () => {
    orderId = 'o_inexistant_xyz';
    const res = await PATCH(
      patchReq({ email: 'x@exemple.test', emailConsent: true }) as never,
      { params: { orderId } } as never,
    );
    expect(res.status).toBe(404);
  });

  it('CLI-INT-OPTIN-NOLEAD : order sans chatLeadId → invalid_state', async () => {
    leadId = `lead_${Date.now().toString(36)}`;
    orderId = `o_${Date.now().toString(36)}`;
    await dbt.insert(leads).values({
      id: leadId, email: null as unknown as string, consentMarketing: false,
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    await dbt.insert(orders).values({
      id: orderId, leadId, chatLeadId: null,
      totalCents: 19900, currency: 'MAD', createdAt: new Date(),
    } as never);

    const res = await PATCH(
      patchReq({ email: 'x@exemple.test', emailConsent: true }) as never,
      { params: { orderId } } as never,
    );
    expect([400, 422]).toContain(res.status);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/invalid_state|lead/i);
  });

  it('CLI-UNIT-002 (intégration) : emailConsent=false rejeté', async () => {
    await seed();
    const res = await PATCH(
      patchReq({ email: 'kaoutar@exemple.test', emailConsent: false }) as never,
      { params: { orderId } } as never,
    );
    expect(res.status).toBe(422);
    const tags = await dbt.select().from(leadTag).where(eq(leadTag.leadId, leadId));
    expect(tags, 'aucun tag sans consentement explicite').toHaveLength(0);
  });
});
