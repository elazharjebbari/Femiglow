// @vitest-environment node
/**
 * CHANTIER H — R-009 : allowlist interne court-circuitant la suppression.
 * Module 08 (pipeline outbox). Suite VRAIE-DB (femiglow_test_outbox).
 *
 * ── Bug R-009 (rouge → fix → vert) ──────────────────────────────────────────
 * `sendTransactional` appelait `isSuppressed(toEmail)` pour TOUTE adresse, sans
 * distinction client/interne. Les notifications internes (nouveau lead chat,
 * F-094) partent vers `info@femiglow-maroc.com`. Si cette boîte interne
 * atterrit un jour dans `email_suppression` (un seul bounce temporaire suffit),
 * TOUTES les notifications de leads sont silencieusement bloquées : l'équipe
 * cesse de recevoir les leads sans aucun signal. Perte totale et invisible d'un
 * canal critique.
 *
 * Fix : `isInternalAddress()` + court-circuit dans `isSuppressed()` (cf.
 * suppression.ts). Une adresse interne (allowlist d'adresses/domaines,
 * `MAIL_INTERNAL_ALLOWLIST` + défauts projet) n'est JAMAIS considérée
 * suppressée → l'email PART quand même.
 *
 * Oracle inverse (non-affaiblissement) : un CLIENT suppressé reste bien bloqué.
 *
 * IDs matrice couverts : PIP-INT-100, PIP-INT-101, PIP-INT-102, PIP-INT-053,
 * PIP-INT-054, PIP-INT-107.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/suppression-allowlist.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP mock — enregistre chaque sendMail tenté (l'oracle « l'email part » repose
// sur le fait qu'un envoi SMTP est réellement déclenché pour l'adresse interne).
const sentToEmails: string[] = [];

vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class SmtpNotConfiguredError extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: { to?: string; headers?: Record<string, string> }) => {
      sentToEmails.push(String(opts.to ?? ''));
      const id = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
      return { messageId: `<msg-${id}@test>`, response: '250 OK' };
    },
  }),
}));

import { emailOutbox, emailSuppression } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeSuppression } from '@/test/factories/emails.factory';
import { sendTransactional, type SendInput } from '../../send';
import { isSuppressed, isInternalAddress, addSuppression } from '../../suppression';

const db = () => emailsTestDb();

const INTERNAL_EMAIL = 'info@femiglow-maroc.com';
const CLIENT_EMAIL = 'cliente.suppressee@exemple.test';

/** Payload valide pour une notification interne de lead chat. */
function leadNotifInput(to: string, idem: string): SendInput<'lead-notification'> {
  return {
    template: 'lead-notification',
    to: { email: to },
    payload: {
      leadName: 'Salma',
      leadPhone: '+212 6 12 34 56 78',
      leadEmail: null,
      intent: 'achat-rituels',
      outcomeContext: 'user: Bonjour\nassistant: Bonjour ✨',
      adminUrl: 'https://admin.femiglow-maroc.com/admin/leads/abc',
    },
    idempotencyKey: idem,
    source: 'test.r009',
  };
}

/** Payload valide d'accusé de contact pour un envoi client. */
function contactAckInput(to: string, idem: string): SendInput<'contact-acknowledgement'> {
  return {
    template: 'contact-acknowledgement',
    to: { email: to },
    payload: { firstName: 'Salma', messageExcerpt: 'Bonjour, une question…' },
    idempotencyKey: idem,
    source: 'test.r009',
  };
}

async function findRow(id: string) {
  return db().query.emailOutbox.findFirst({ where: (t) => eq(t.id, id) });
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sentToEmails.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('R-009 — suppression court-circuitée pour les adresses internes', () => {
  // PIP-INT-101 — ROUGE→VERT : l'adresse interne EST posée en suppression, puis
  // on enfile une notification interne. Oracle : l'email PART quand même
  // (status queued/sent, pas suppressed) — l'allowlist court-circuite.
  // Sans le fix : la ligne serait `suppressed`, outboxId null, ZÉRO envoi.
  it('adresse interne suppressée → la notification PART quand même (queued + SMTP tenté)', async () => {
    // La boîte interne a bouncé un jour → elle s'est retrouvée en suppression.
    await db()
      .insert(emailSuppression)
      .values(
        makeSuppression({
          email: INTERNAL_EMAIL,
          reason: 'hard_bounce',
          source: 'stalwart',
        }),
      );

    // Garde-fou : la ligne de suppression existe BIEN en base (sinon le test
    // ne prouve rien).
    const supp = await db().query.emailSuppression.findFirst({
      where: (t) => eq(t.email, INTERNAL_EMAIL),
    });
    expect(supp, 'la suppression de l adresse interne doit exister en base').toBeTruthy();

    const result = await sendTransactional(leadNotifInput(INTERNAL_EMAIL, 'r009-internal-1'));

    // Oracle dur : l'email N'EST PAS suppressé → il est enfilé (queued).
    expect(result.status).not.toBe('suppressed');
    expect(result.status).toBe('queued');
    const id = (result as { outboxId: string }).outboxId;
    expect(id).toBeTruthy();

    // Une ligne outbox a bien été créée pour l'adresse interne.
    const row = await findRow(id);
    expect(row, 'une ligne outbox doit exister pour la notif interne').toBeTruthy();
    expect(row!.toEmail).toBe(INTERNAL_EMAIL);

    // L'attempt fire-and-forget a effectivement tenté un envoi SMTP vers la
    // boîte interne → la notification part.
    await vi.waitFor(() => {
      expect(sentToEmails.some((to) => to.includes(INTERNAL_EMAIL))).toBe(true);
    });
  });

  // PIP-INT-102 — variante domaine : une adresse interne ARBITRAIRE du domaine
  // `@femiglow-maroc.com` (admin, alertes) suppressée reste envoyable. Couvre
  // le volet « domaine entier » de l'allowlist.
  it('adresse arbitraire du domaine interne suppressée → envoi non bloqué', async () => {
    const adminEmail = 'alerts@femiglow-maroc.com';
    await db()
      .insert(emailSuppression)
      .values(makeSuppression({ email: adminEmail, reason: 'manual_admin', source: 'manual' }));

    expect(isInternalAddress(adminEmail), 'le domaine interne doit matcher').toBe(true);
    // Court-circuit : isSuppressed retourne false malgré la ligne en base.
    expect(await isSuppressed(adminEmail)).toBe(false);

    const result = await sendTransactional(leadNotifInput(adminEmail, 'r009-internal-domain'));
    expect(result.status).not.toBe('suppressed');
  });

  // PIP-INT-100 — INVERSE (non-affaiblissement de l'oracle) : un CLIENT
  // suppressé reste BIEN bloqué — le fix n'ouvre PAS la vanne pour tout le
  // monde. Oracle : status=suppressed, outboxId null, ZÉRO ligne, ZÉRO SMTP.
  it('client externe suppressé → reste bloqué (suppressed, aucune ligne, aucun SMTP)', async () => {
    await db()
      .insert(emailSuppression)
      .values(
        makeSuppression({ email: CLIENT_EMAIL, reason: 'unsubscribe', source: 'manual' }),
      );

    expect(isInternalAddress(CLIENT_EMAIL)).toBe(false);
    expect(await isSuppressed(CLIENT_EMAIL)).toBe(true);

    const result = await sendTransactional(contactAckInput(CLIENT_EMAIL, 'r009-client-1'));

    expect(result.status).toBe('suppressed');
    expect((result as { outboxId: null }).outboxId).toBeNull();

    // Aucune ligne outbox créée pour un client suppressé.
    const rows = await db().query.emailOutbox.findMany({
      where: (t) => eq(t.toEmail, CLIENT_EMAIL),
    });
    expect(rows).toHaveLength(0);

    // Et surtout : aucun envoi SMTP tenté. On laisse le temps à un éventuel
    // fire-and-forget (il n'y en a pas, mais on est robuste).
    await new Promise((r) => setTimeout(r, 0));
    expect(sentToEmails.some((to) => to.includes(CLIENT_EMAIL))).toBe(false);
  });

  // PIP-INT-107 — e2e suppression : après suppression d'un client, DEUX envois
  // ultérieurs (deux templates / idempotencyKeys distincts) sont tous deux
  // bloqués. Vérifie que la suppression tient dans le temps, pas seulement au
  // premier appel.
  it('client suppressé → deux envois successifs distincts tous deux bloqués', async () => {
    await addSuppression({ email: CLIENT_EMAIL, reason: 'hard_bounce', source: 'stalwart' });

    const a = await sendTransactional(contactAckInput(CLIENT_EMAIL, 'r009-client-a'));
    const b = await sendTransactional(leadNotifInput(CLIENT_EMAIL, 'r009-client-b'));

    expect(a.status).toBe('suppressed');
    expect(b.status).toBe('suppressed');
    const rows = await db().query.emailOutbox.findMany({
      where: (t) => eq(t.toEmail, CLIENT_EMAIL),
    });
    expect(rows).toHaveLength(0);
  });
});

describeEmailsDb('Enqueue — suppression check & idempotence avant envoi', () => {
  // PIP-INT-053 — un client suppressé → SendResult.status=suppressed,
  // outboxId=null, et AUCUN insert d'envoi. (Re-cadré côté enqueue.)
  it('PIP-INT-053 — adresse suppressée → status suppressed, outboxId null, pas d insert', async () => {
    await db()
      .insert(emailSuppression)
      .values(makeSuppression({ email: CLIENT_EMAIL, reason: 'unsubscribe', source: 'manual' }));

    const result = await sendTransactional(contactAckInput(CLIENT_EMAIL, 'pip-053'));
    expect(result.status).toBe('suppressed');
    expect((result as { outboxId: null }).outboxId).toBeNull();

    const count = await db().query.emailOutbox.findMany();
    expect(count).toHaveLength(0);
  });

  // PIP-INT-054 — même idempotencyKey deux fois → une seule ligne outbox, le 2e
  // appel renvoie `duplicate` avec l'outboxId existant (oracle VRAIE DB :
  // exactement 1 row pour la clé). Empêche le double envoi sur double-trigger.
  it('PIP-INT-054 — même idempotencyKey 2× → un seul outbox row, 2e appel = duplicate', async () => {
    const input = contactAckInput('cliente.idem@exemple.test', 'pip-054-key');

    const first = await sendTransactional(input);
    expect(first.status).toBe('queued');
    const firstId = (first as { outboxId: string }).outboxId;

    const second = await sendTransactional(input);
    expect(second.status).toBe('duplicate');
    expect((second as { outboxId: string }).outboxId).toBe(firstId);

    // Une seule et unique ligne pour cette idempotencyKey.
    const rows = await db().query.emailOutbox.findMany({
      where: (t) => eq(t.idempotencyKey, 'pip-054-key'),
    });
    expect(rows).toHaveLength(1);
  });
});
