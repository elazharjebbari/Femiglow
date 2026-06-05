// @vitest-environment node
/**
 * CHANTIER 1.6 — Ordre render/INSERT dans `sendTransactional`. Suite VRAIE-DB
 * (femiglow_test_outbox).
 *
 * Contexte du bug (P0) : l'ancien `sendTransactional` faisait le render
 * (`meta.schema.parse(payload)` Zod + react-email) AVANT l'INSERT outbox. Comme
 * tous les call-sites appellent `void sendTransactional(...)` (fire-and-forget),
 * un payload Zod-invalide levait une exception remontée dans le vide : AUCUNE
 * ligne en DB → email perdu, invisible du cockpit, indiagnosticable.
 *
 * Fix : INSERT `pending` d'abord (payload brut + idempotencyKey), render
 * ensuite ; échec de render → UPDATE `failed` + `lastError` parlant, et AUCUN
 * envoi SMTP n'est tenté.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/send-order.integration.test.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP mock : enregistre tout sendMail tenté. L'oracle « aucun envoi tenté »
// repose dessus.
const sendMailCalls: unknown[] = [];

vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class SmtpNotConfiguredError extends Error {
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
import { sendTransactional, type SendInput } from '../send';

const db = () => emailsTestDb();

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sendMailCalls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

/** Attend que la ligne fire-and-forget attemptSend() ait bougé l'état. */
async function findRow(id: string) {
  return db().query.emailOutbox.findFirst({ where: (t) => eq(t.id, id) });
}

describeEmailsDb('sendTransactional — ordre INSERT avant render (CHANTIER 1.6)', () => {
  // OBX-SEND-001 — payload Zod-invalide : une ligne outbox EXISTE en `failed`
  // avec un lastError parlant, et AUCUN envoi SMTP n'a été tenté.
  it('payload invalide → ligne failed avec lastError, zéro SMTP tenté', async () => {
    // order-confirmation exige itemsCount = entier positif. -3 viole le schéma
    // Zod → renderTemplate throw. Cast volontaire : on simule un appelant qui
    // passe un payload corrompu (le vrai bug : ces erreurs étaient perdues).
    const input = {
      template: 'order-confirmation',
      to: { email: 'cliente-invalide@exemple.test', name: 'Cliente' },
      payload: {
        firstName: 'Salma',
        orderId: 'FG-1',
        orderTotal: '199 MAD',
        itemsCount: -3, // invalide
        deliveryEstimate: '2-4 jours',
      },
      idempotencyKey: 'idem-invalide-001',
      source: 'test',
    } as unknown as SendInput<'order-confirmation'>;

    const result = await sendTransactional(input);

    // L'appel ne throw PAS (la trace est posée en DB).
    expect(result.status).toBe('failed');
    expect(result.status === 'failed' && result.outboxId).toBeTruthy();

    const id = (result as { outboxId: string }).outboxId;
    const row = await findRow(id);
    expect(row).toBeTruthy();
    expect(row!.status).toBe('failed');
    // lastError doit nommer le render (diagnostic opérateur).
    expect(row!.lastError).toMatch(/render failed/i);
    // idempotencyKey posé dès l'INSERT (anti-doublon garanti).
    expect(row!.idempotencyKey).toBe('idem-invalide-001');
    // payload brut conservé pour diagnostic.
    expect(row!.payloadJson).toMatchObject({ itemsCount: -3 });

    // AUCUN envoi SMTP tenté sur un render raté.
    expect(sendMailCalls).toHaveLength(0);
  });

  // OBX-SEND-002 — idempotence : ré-appeler avec la même clé après un échec de
  // render ne crée PAS un 2e enregistrement (la ligne failed sert de trace +
  // de garde anti-doublon).
  it('ré-appel même idempotencyKey après render raté → duplicate, pas de 2e ligne', async () => {
    const input = {
      template: 'order-confirmation',
      to: { email: 'cliente-dup@exemple.test' },
      payload: { firstName: 'Imane', orderId: 'X', orderTotal: '1', itemsCount: 0, deliveryEstimate: 'x' },
      idempotencyKey: 'idem-dup-002',
    } as unknown as SendInput<'order-confirmation'>;

    const first = await sendTransactional(input);
    expect(first.status).toBe('failed');

    const second = await sendTransactional(input);
    expect(second.status).toBe('duplicate');

    const rows = await db().query.emailOutbox.findMany({
      where: (t) => eq(t.idempotencyKey, 'idem-dup-002'),
    });
    expect(rows).toHaveLength(1);
  });

  // OBX-SEND-003 — NON-RÉGRESSION : payload VALIDE → ligne queued, snapshots
  // rendus, sujet réel (pas le placeholder), et un envoi SMTP est tenté.
  it('payload valide → ligne avec snapshots rendus + sujet réel + SMTP tenté', async () => {
    const input: SendInput<'order-confirmation'> = {
      template: 'order-confirmation',
      to: { email: 'cliente-ok@exemple.test', name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-20260604-007',
        orderTotal: '490 MAD',
        itemsCount: 2,
        deliveryEstimate: '2-4 jours',
      },
      idempotencyKey: 'idem-valide-003',
      source: 'test',
    };

    const result = await sendTransactional(input);
    expect(result.status).toBe('queued');
    const id = (result as { outboxId: string }).outboxId;

    // Le sujet réel est posé (pas le placeholder), les snapshots sont remplis.
    await vi.waitFor(async () => {
      const row = await findRow(id);
      expect(row).toBeTruthy();
      expect(row!.subject).not.toBe('(rendering…)');
      expect(row!.subject).toContain('FG-20260604-007');
      expect(row!.htmlSnapshot).toBeTruthy();
      expect(row!.textSnapshot).toBeTruthy();
      // L'attempt fire-and-forget a livré la ligne (status sent).
      expect(row!.status).toBe('sent');
    });

    // Au moins un envoi SMTP a bien été tenté sur un payload valide.
    expect(sendMailCalls.length).toBeGreaterThanOrEqual(1);
  });
});
