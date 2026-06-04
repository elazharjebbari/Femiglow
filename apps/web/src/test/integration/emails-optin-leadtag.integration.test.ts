// @vitest-environment node
/**
 * CHANTIER 1.1 — DRIFT lead_tag (P0).
 *
 * Reproduit le bug prod : PATCH /api/checkout/order/[orderId]/email → 500.
 * Cause : `lead_tag.id` est `uuid DEFAULT gen_random_uuid()` en base (prod +
 * migrations), mais le schéma Drizzle déclare `text` et la route insère
 * `createId('tag')` (= `tag_…`, non-uuid) → l'INSERT échoue au cast uuid →
 * la route catch et renvoie 500 (`internal_error`).
 *
 * Cette suite exerce le HANDLER PATCH importé directement (pas de serveur HTTP)
 * contre une vraie DB de test (femiglow_test_leadtag). Elle vérifie l'effet de
 * bord COMPLET de l'opt-in :
 *   - 200 + body `email_optin_saved`
 *   - `chat_lead.email` / `chat_lead.email_consent` mis à jour
 *   - `leads.email` (legacy) + `consent_marketing` synchronisés
 *   - ligne `lead_tag` (tag=post-purchase-optin, source=automation) créée
 *   - `user_event` `lead.email_optin_post_purchase` émis (trigger automation)
 *
 * Lancement (cf. mission) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_leadtag#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/test/integration/emails-optin-leadtag.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { leads, leadTag, orders, userEvent } from '@/lib/db/schema';
import {
  chatInstructionVersion,
  chatLead,
  chatSession,
} from '@/lib/chat/db/schema';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { PATCH } from '@/app/api/checkout/order/[orderId]/email/route';

// — Garde-fou : la route lit process.env.DATABASE_URL via db()/chatDb(). Le
//   harnais a déjà imposé femiglow_test, mais on documente l'exigence ici.

type Seed = {
  sessionId: string;
  chatLeadId: string;
  legacyLeadId: string;
  orderId: string;
};

/**
 * Sème la chaîne complète exigée par la route :
 *   chat_instruction_version → chat_session → chat_lead
 *   leads (legacy)
 *   orders (lead_id → leads, chat_lead_id → chat_lead)
 *
 * Le chat_lead est créé SANS email (email=null, email_consent=false) — l'opt-in
 * est précisément ce que la route doit poser. Le legacy lead a un email
 * différent + consent_marketing=false pour pouvoir asserter la synchro.
 */
async function seed(
  overrides: { legacyEmail?: string } = {},
): Promise<Seed> {
  const db = emailsTestDb();
  const instructionVersionId = createId('ci');
  const sessionId = createId('cs');
  const chatLeadId = createId('cl');
  const legacyLeadId = createId('l');
  const orderId = createId('o');

  await db.insert(chatInstructionVersion).values({
    id: instructionVersionId,
    version: 1,
    body: 'instructions de test',
    enabled: false,
    createdBy: 'test',
  });

  await db.insert(chatSession).values({
    id: sessionId,
    visitorId: 'visitor_optin_test',
    instructionVersionId,
  });

  await db.insert(chatLead).values({
    id: chatLeadId,
    sessionId,
    triggerReason: 'purchase-intent',
    firstName: 'Kaoutar',
    phoneE164: '+212600112233',
    phoneRaw: '0600112233',
    consentVersion: '2025-11-01',
    visitorId: 'visitor_optin_test',
    language: 'fr',
    identityHash: createId('idh'),
    source: 'wizard_kit',
    // email NON renseigné → email=null, email_consent=false (défaut DB)
  });

  await db.insert(leads).values({
    id: legacyLeadId,
    email: overrides.legacyEmail ?? 'ancien-email@example.ma',
    phone: '+212600112233',
    name: 'Kaoutar',
    consentMarketing: false,
  });

  await db.insert(orders).values({
    id: orderId,
    leadId: legacyLeadId,
    chatLeadId,
    totalCents: 49000,
    currency: 'MAD',
    shippingMode: 'standard',
    paymentMethod: 'cod',
  });

  return { sessionId, chatLeadId, legacyLeadId, orderId };
}

function buildPatchRequest(
  orderId: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(
    `http://localhost/api/checkout/order/${orderId}/email`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
  );
}

beforeAll(() => {
  // Force la résolution d'URL (garde-fou femiglow_test) au plus tôt.
  emailsTestDb();
});

beforeEach(async () => {
  // `truncateEmailTables()` purge lead_tag + tables emailing. On vide AUSSI les
  // tables coeur/chat touchées par la route (hors périmètre EMAIL_TABLES) pour
  // garantir l'isolation inter-tests (CASCADE depuis chat_instruction_version
  // purge chat_session/chat_lead/orders).
  await truncateEmailTables();
  const pg = emailsTestSql();
  await pg.unsafe(
    'TRUNCATE TABLE user_event, checkout_idempotency, orders, leads, ' +
      'chat_lead, chat_session, chat_instruction_version ' +
      'RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await closeTestDb();
});

describeEmailsDb('PATCH /api/checkout/order/[orderId]/email — opt-in + lead_tag (chantier 1.1)', () => {
  // PCL-INT-001 — happy path : 200 + body email_optin_saved + lead_tag créé
  it('renvoie 200, pose le tag post-purchase-optin et émet le user_event', async () => {
    const db = emailsTestDb();
    const { chatLeadId, legacyLeadId, orderId } = await seed();

    const req = buildPatchRequest(orderId, {
      email: 'NouvelleAdresse@Example.MA',
      emailConsent: true,
    });

    const res = await PATCH(req as never, { params: { orderId } });

    // Oracle 1 — la route répond 200 (et NON 500 du drift uuid).
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe('email_optin_saved');
    expect(json.orderId).toBe(orderId);
    expect(json.email).toBe('NouvelleAdresse@Example.MA');

    // Oracle 2 — chat_lead opt-in : email normalisé (lowercase+trim) + consent.
    const chatRows = await db
      .select()
      .from(chatLead)
      .where(eq(chatLead.id, chatLeadId));
    expect(chatRows).toHaveLength(1);
    expect(chatRows[0]!.email).toBe('nouvelleadresse@example.ma');
    expect(chatRows[0]!.emailConsent).toBe(true);

    // Oracle 3 — legacy leads synchronisé (email lowercase + consent true).
    const leadRows = await db.select().from(leads).where(eq(leads.id, legacyLeadId));
    expect(leadRows).toHaveLength(1);
    expect(leadRows[0]!.email).toBe('nouvelleadresse@example.ma');
    expect(leadRows[0]!.consentMarketing).toBe(true);

    // Oracle 4 — lead_tag post-purchase-optin créé (c'est l'INSERT qui crashait
    // sur le drift uuid). source=automation, sourceRef=checkout:<orderId>.
    const tagRows = await db
      .select()
      .from(leadTag)
      .where(eq(leadTag.leadId, legacyLeadId));
    expect(tagRows).toHaveLength(1);
    expect(tagRows[0]!.tag).toBe('post-purchase-optin');
    expect(tagRows[0]!.source).toBe('automation');
    expect(tagRows[0]!.sourceRef).toBe(`checkout:${orderId}`);
    // id doit être un uuid valide (généré par la DB), pas un `tag_…`.
    expect(tagRows[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // Oracle 5 — user_event lead.email_optin_post_purchase émis (trigger
    // automation), lié au lead legacy, avec orderId dans properties.
    const events = await db
      .select()
      .from(userEvent)
      .where(eq(userEvent.eventName, 'lead.email_optin_post_purchase'));
    expect(events).toHaveLength(1);
    expect(events[0]!.email).toBe('nouvelleadresse@example.ma');
    expect(events[0]!.leadId).toBe(legacyLeadId);
    expect(events[0]!.source).toBe('server');
    expect((events[0]!.properties as Record<string, unknown>).orderId).toBe(orderId);
  });

  // PCL-INT-002 — idempotence applicative du tag (re-appel) : 1 seule ligne
  // lead_tag malgré 2 appels (onConflictDoNothing sur (lead_id, tag)).
  it('reste idempotent sur lead_tag : 2 opt-ins ne créent qu\'une ligne tag', async () => {
    const db = emailsTestDb();
    const { legacyLeadId, orderId } = await seed();

    const body = { email: 'cliente@example.ma', emailConsent: true };
    const res1 = await PATCH(buildPatchRequest(orderId, body) as never, {
      params: { orderId },
    });
    expect(res1.status).toBe(200);

    const res2 = await PATCH(buildPatchRequest(orderId, body) as never, {
      params: { orderId },
    });
    expect(res2.status).toBe(200);

    const tagRows = await db
      .select()
      .from(leadTag)
      .where(eq(leadTag.leadId, legacyLeadId));
    // Oracle — onConflictDoNothing (lead_id, tag) → exactement 1 ligne.
    expect(tagRows).toHaveLength(1);
    expect(tagRows[0]!.tag).toBe('post-purchase-optin');
  });

  // PCL-INT-003 — replay via Idempotency-Key : même réponse rejouée, et le
  // chemin idempotence (store checkout_idempotency) n'introduit pas de drift.
  it('rejoue la réponse 200 sur Idempotency-Key identique sans dupliquer le tag', async () => {
    const db = emailsTestDb();
    const { legacyLeadId, orderId } = await seed();

    const body = { email: 'cliente2@example.ma', emailConsent: true };
    const idemKey = `idem_${createId('k')}`;

    const res1 = await PATCH(
      buildPatchRequest(orderId, body, { 'Idempotency-Key': idemKey }) as never,
      { params: { orderId } },
    );
    expect(res1.status).toBe(200);
    const json1 = (await res1.json()) as Record<string, unknown>;

    const res2 = await PATCH(
      buildPatchRequest(orderId, body, { 'Idempotency-Key': idemKey }) as never,
      { params: { orderId } },
    );
    expect(res2.status).toBe(200);
    const json2 = (await res2.json()) as Record<string, unknown>;

    // Oracle — réponse rejouée à l'identique.
    expect(json2).toEqual(json1);

    const tagRows = await db
      .select()
      .from(leadTag)
      .where(eq(leadTag.leadId, legacyLeadId));
    expect(tagRows).toHaveLength(1);
  });

  // PCL-INT-004 — order non lié à un chat_lead → 409 invalid_state, aucun tag.
  it('renvoie 409 invalid_state si la commande n\'est pas liée à un lead wizard', async () => {
    const db = emailsTestDb();
    // Order legacy sans chat_lead_id : on sème un lead + order sans chatLeadId.
    const legacyLeadId = createId('l');
    const orderId = createId('o');
    await db.insert(leads).values({
      id: legacyLeadId,
      email: 'legacy@example.ma',
      consentMarketing: false,
    });
    await db.insert(orders).values({
      id: orderId,
      leadId: legacyLeadId,
      totalCents: 49000,
      currency: 'MAD',
      shippingMode: 'standard',
      paymentMethod: 'cod',
      // chatLeadId NON renseigné → null
    });

    const res = await PATCH(
      buildPatchRequest(orderId, {
        email: 'cliente@example.ma',
        emailConsent: true,
      }) as never,
      { params: { orderId } },
    );

    // Oracle — la route refuse proprement (409), sans toucher lead_tag.
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe('invalid_state');

    const tagRows = await db
      .select()
      .from(leadTag)
      .where(eq(leadTag.leadId, legacyLeadId));
    expect(tagRows).toHaveLength(0);
  });
});
