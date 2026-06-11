// @vitest-environment node
/**
 * UX4-PARCOURS-006 (volet send) — Secret de désabonnement absent : l'email NE
 * DOIT PAS partir avec un href littéral `{{unsubscribe_url}}` cassé (vraie DB).
 *
 * Issue (UX-PUB-007) : dans send.ts, la substitution de `{{unsubscribe_url}}`
 * était dans un try/catch qui, si `MAIL_UNSUB_TOKEN_SECRET` manquait, laissait
 * le placeholder littéral → `<a href="{{unsubscribe_url}}">Se désabonner</a>`,
 * soit un lien invalide cliquable (email non conforme). Le fix : basculer le
 * lien vers un canal de secours réel (mailto) + logger une erreur explicite.
 *
 * Oracle : le snapshot HTML persisté en outbox ne contient PLUS le placeholder
 * littéral, ne contient PLUS `href="{{unsubscribe_url}}"`, et porte un href
 * mailto fonctionnel.
 *
 * On retire le secret AVANT les imports (env parse process.env à l'import).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m09parcours#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/lib/mail/__tests__/send-unsub-secret-missing.ux4.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// Secret ABSENT : on le supprime de l'env avant tout import (déterminisme,
// quelle que soit la config .env de la machine de test).
vi.hoisted(() => {
  delete process.env.MAIL_UNSUB_TOKEN_SECRET;
});

vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));

// SMTP inerte : on n'envoie rien réellement ; on inspecte le snapshot persisté.
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
import { sendTransactional } from '@/lib/mail/send';

const db = () => emailsTestDb();

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sendMailCalls.length = 0;
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('sendTransactional — secret unsub absent (vraie DB)', () => {
  it('UX4-PARCOURS-006 : aucun href littéral {{unsubscribe_url}} ne fuit dans le snapshot', async () => {
    const res = await sendTransactional({
      template: 'order-confirmation',
      to: { email: 'sans-secret@exemple.test', name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-NOSEC-1',
        orderTotal: '199.00 MAD',
        itemsCount: 1,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-NOSEC-1',
      source: 'test',
    });
    expect(res.status).toBe('queued');
    expect(res.outboxId).toBeTruthy();

    const row = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.id, res.outboxId as string))
      .then((r) => r[0]!);

    // Oracle 1 — plus aucun placeholder littéral.
    expect(row.htmlSnapshot ?? '').not.toContain('{{unsubscribe_url}}');
    expect(row.textSnapshot ?? '').not.toContain('{{unsubscribe_url}}');
    // Oracle 2 — plus aucun href cassé pointant sur le placeholder.
    expect(row.htmlSnapshot ?? '').not.toContain('href="{{unsubscribe_url}}"');
    // Oracle 3 — un canal de désabonnement de secours RÉEL est présent.
    expect(row.htmlSnapshot ?? '').toContain('mailto:');
    expect(row.htmlSnapshot ?? '').toMatch(/mailto:[^"']+@femiglow-maroc\.com/);
  });
});
