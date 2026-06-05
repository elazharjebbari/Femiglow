/**
 * CLI-INT-UNSUB-HDR — en-tête List-Unsubscribe one-click (RFC 8058) émis par
 * deliverRow (outbox.ts) : l'URL DOIT porter un token signé `?t=` que la route
 * /api/mail/unsubscribe sait vérifier (elle ne lit QUE `t`, route.ts:59,68).
 *
 * Bug d'origine (consigné vague 2, chantier m09) : l'en-tête émettait
 * `?email=<adresse en clair>` → le bouton natif Gmail/Apple Mail POSTait sans
 * `t` ⇒ 400 missing-token, AUCUNE désinscription. Le lien in-body (token signé)
 * fonctionnait, mais le chemin le plus courant était cassé.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/outbox-unsub-header.integration.test.ts
 */
// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

// Le module env parse process.env à l'import : poser le secret AVANT toute
// import hoistée (vi.hoisted s'exécute avant les imports du fichier).
vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET = 'qa-unsub-header-secret-0123456789abcdef';
});

// SMTP pilotable : capture les opts complets de sendMail (dont headers).
// eslint-disable-next-line no-var
var sentMails: Array<{ headers?: Record<string, string>; to?: string }> = [];

vi.mock('@/lib/mail/client', () => {
  class SmtpNotConfiguredError extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  }
  return {
    SmtpNotConfiguredError,
    getTransporter: () => ({
      sendMail: async (opts: { headers?: Record<string, string>; to?: string }) => {
        sentMails.push(opts);
        return { messageId: '<msg-hdr@test>', response: '250 OK' };
      },
    }),
  };
});

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow } from '@/test/factories/emails.factory';
import { attemptSend } from '../../outbox';
import { verifyUnsubToken } from '../../unsub-token';

const db = () => emailsTestDb();

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sentMails.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('List-Unsubscribe one-click — en-tête émis par deliverRow', () => {
  // CLI-INT-UNSUB-HDR-001 — l'URL http de l'en-tête porte `?t=<token>` et le
  // token VÉRIFIE vers l'adresse du destinataire (round-trip réel, pas de mock
  // de verifyUnsubToken) : le POST one-click du client mail aboutira.
  it('CLI-INT-UNSUB-HDR-001 — header `?t=` + token vérifiable vers row.toEmail', async () => {
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 0,
      nextRetry: null,
      scheduledFor: null,
      toEmail: 'kaoutar-hdr@exemple.test',
    });
    await db().insert(emailOutbox).values(row);

    await attemptSend(row.id);

    expect(sentMails).toHaveLength(1);
    const header = sentMails[0]!.headers?.['List-Unsubscribe'];
    expect(header).toBeTruthy();

    // L'URL http DOIT porter `t` (la route ne lit rien d'autre) — et ne DOIT
    // PAS exposer l'adresse en clair en query (forme `?email=` = bug d'origine,
    // désinscription non authentifiée + fuite PII dans les logs).
    const httpUrl = new URL(/<(https?:[^>]+)>/.exec(header!)![1]!);
    expect(httpUrl.pathname).toBe('/api/mail/unsubscribe');
    expect(httpUrl.searchParams.get('email')).toBeNull();
    const token = httpUrl.searchParams.get('t');
    expect(token).toBeTruthy();
    expect(verifyUnsubToken(token!)).toBe('kaoutar-hdr@exemple.test');
  });

  // CLI-INT-UNSUB-HDR-002 — RFC 8058 : la variante mailto reste présente et
  // l'en-tête List-Unsubscribe-Post one-click accompagne l'URL http.
  it('CLI-INT-UNSUB-HDR-002 — mailto conservé + List-Unsubscribe-Post one-click', async () => {
    const row = makeOutboxRow({
      status: 'pending',
      attempts: 0,
      nextRetry: null,
      scheduledFor: null,
    });
    await db().insert(emailOutbox).values(row);

    await attemptSend(row.id);

    const headers = sentMails[0]!.headers!;
    expect(headers['List-Unsubscribe']).toContain('<mailto:unsubscribe@femiglow-maroc.com>');
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});
