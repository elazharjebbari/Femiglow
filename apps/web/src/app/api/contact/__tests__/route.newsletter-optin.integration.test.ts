// @vitest-environment node
/**
 * UX4-PARCOURS-003 — POST /api/contact avec `newsletterOptIn=true` déclenche le
 * VRAI double opt-in newsletter (vraie DB : femiglow_test_m09parcours).
 *
 * Issue (UX-PUB-003) : la case « Je souhaite recevoir la lettre saisonnière »
 * du formulaire de contact PROMETtait l'inscription, mais côté serveur la valeur
 * n'alimentait qu'une note webhook — aucun `sendTransactional('newsletter-confirm')`,
 * aucune trace outbox. Fausse promesse de consentement. Le fix câble le même
 * flux double opt-in que /api/newsletter.
 *
 * Oracle central : une (et une seule) ligne `email_outbox.template =
 * 'newsletter-confirm'` est créée pour l'email du contact. La case décochée n'en
 * crée AUCUNE.
 *
 * On isole l'oracle :
 *   - rate-limit neutralisé (pas de Redis en test) ;
 *   - SMTP stubbé inerte (aucun envoi réel) ;
 *   - `dispatchContactWebhook` + bridge user-event mockés (auxiliaires CRM, hors
 *     périmètre de cet oracle, et dépendants d'I/O externes) ;
 *   - le secret HMAC est posé AVANT les imports (env parse à l'import).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m09parcours#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/app/api/contact/__tests__/route.newsletter-optin.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-contact-optin-secret-0123456789abcdef';
});

vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));

// Webhook CRM + bridge user-event : auxiliaires, dépendants d'I/O — on les
// neutralise pour isoler l'effet outbox newsletter-confirm.
vi.mock('@/lib/webhooks/outbound/sources/from-contact', () => ({
  dispatchContactWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/user-events/bridges/server-actions', () => ({
  recordContactSubmitted: vi.fn().mockResolvedValue(undefined),
}));

// SMTP inerte : la queue outbox est posée par sendTransactional AVANT tout SMTP.
const sendMailCalls: unknown[] = [];
vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: unknown) => {
      sendMailCalls.push(opts);
      return { messageId: '<msg@test>', response: '250 OK' };
    },
  }),
}));

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { POST } from '../route';

const db = () => emailsTestDb();

function contactReq(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

function validBody(over: Record<string, unknown> = {}) {
  return {
    type: 'question',
    name: 'Nourelhouda Bennani',
    email: 'nourelhouda@exemple.test',
    message: 'Bonjour, je découvre la maison FemiGlow et j’aimerais en savoir plus.',
    gdprConsent: true,
    newsletterOptIn: false,
    ...over,
  };
}

async function newsletterConfirmRows(email: string) {
  return db()
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.template, 'newsletter-confirm'))
    .then((rows) => rows.filter((r) => r.toEmail === email.toLowerCase()));
}

/**
 * `sendTransactional` est fire-and-forget ET son INSERT outbox est précédé d'un
 * render React asynchrone (`@react-email/render`) → la ligne apparaît après un
 * délai non déterministe. On poll jusqu'à `expected` lignes (timeout court),
 * plutôt que d'attendre un nombre fixe de microtasks (flaky).
 */
async function waitForConfirmCount(
  email: string,
  expected: number,
  timeoutMs = 3000,
): Promise<Awaited<ReturnType<typeof newsletterConfirmRows>>> {
  const deadline = Date.now() + timeoutMs;
  let rows = await newsletterConfirmRows(email);
  while (rows.length < expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
    rows = await newsletterConfirmRows(email);
  }
  return rows;
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sendMailCalls.length = 0;
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('POST /api/contact — double opt-in newsletter (vraie DB)', () => {
  it('UX4-PARCOURS-003 : newsletterOptIn=true → EXACTEMENT 1 outbox newsletter-confirm', async () => {
    const email = 'optin-coche@exemple.test';
    const res = await POST(contactReq(validBody({ email, newsletterOptIn: true })) as never);
    expect(res.status).toBe(200);

    const rows = await waitForConfirmCount(email, 1);
    // Oracle central : exactement une confirmation newsletter.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.template).toBe('newsletter-confirm');
    expect(rows[0]!.idempotencyKey).toBe(`newsletter-confirm:${email}`);
    // Le payload porte l'URL de confirmation signée (double opt-in réel).
    const payload = rows[0]!.payloadJson as { confirmUrl?: string };
    expect(payload.confirmUrl).toContain('/api/newsletter/confirm?t=');
  });

  it('UX4-PARCOURS-003 : newsletterOptIn=false → AUCUN outbox newsletter-confirm', async () => {
    const email = 'optin-decoche@exemple.test';
    const res = await POST(contactReq(validBody({ email, newsletterOptIn: false })) as never);
    expect(res.status).toBe(200);

    // Barrière de synchro : l'accusé de contact (contact-acknowledgement) part
    // TOUJOURS. On attend qu'il soit posé pour garantir que le travail de fond a
    // bien flushé, PUIS on prouve qu'AUCUN newsletter-confirm n'a été créé.
    const deadline = Date.now() + 3000;
    let ack = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.template, 'contact-acknowledgement'));
    while (ack.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
      ack = await db()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.template, 'contact-acknowledgement'));
    }
    expect(ack.length).toBeGreaterThanOrEqual(1);

    const rows = await newsletterConfirmRows(email);
    expect(rows).toHaveLength(0);
  });

  it('UX4-PARCOURS-003 : double soumission avec opt-in → idempotent (toujours 1 confirm)', async () => {
    const email = 'optin-double@exemple.test';
    await POST(contactReq(validBody({ email, newsletterOptIn: true })) as never);
    await waitForConfirmCount(email, 1);
    await POST(contactReq(validBody({ email, newsletterOptIn: true })) as never);
    // Laisser une fenêtre au 2e envoi pour (ne pas) écrire un doublon.
    await new Promise((r) => setTimeout(r, 300));

    const rows = await newsletterConfirmRows(email);
    // La clé d'idempotence `newsletter-confirm:<email>` garantit une seule ligne.
    expect(rows).toHaveLength(1);
  });
});
