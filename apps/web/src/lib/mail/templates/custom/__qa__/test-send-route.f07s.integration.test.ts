// @vitest-environment node
/**
 * F07-S (Lot 4) — route test-send sécurisée, contre une vraie Postgres.
 * Sanitization du corps, rate-limit per-admin, minimisation PII audit, 401.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_phase8#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/templates/custom/__qa__/test-send-route.f07s.integration.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { memoryStore } from '@/lib/db/client';
import { emailOutbox, emailTemplateCustom } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { TEST_SEND_RATE_LIMIT } from '@/lib/admin/emails/campaigns-shared';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn() }));

import { POST } from '@/app/api/admin/emails/templates/[id]/test-send/route';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

async function seedTemplate(htmlSource: string): Promise<string> {
  const id = randomUUID();
  await db.insert(emailTemplateCustom).values({
    id,
    slug: `tpl-${id.slice(0, 8)}`,
    name: 'Épreuve',
    subjectTmpl: 'Bonjour {{firstName}}',
    preheaderTmpl: null,
    htmlSource,
    customVars: {},
    createdBy: 'nadia@femiglow-maroc.com',
  });
  return id;
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/emails/templates/x/test-send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function outboxRows() {
  return db.select().from(emailOutbox);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncateEmailTables();
  memoryStore().rateLimitCounters.clear();
  (getAdminSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    email: 'nadia@femiglow-maroc.com',
  });
});
afterAll(async () => {
  await closeTestDb();
});

describeEmailsDb('F07-S — route test-send (vraie DB)', () => {
  it('F07-S-001 : corps SANITIZÉ dans l’outbox (pas de <script>) + source=template-test', async () => {
    const id = await seedTemplate('<p>Salut {{firstName}}</p><script>steal()</script>');
    const res = await POST(postReq({ recipient: 'dest@example.com' }), { params: { id } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'queued' });
    const rows = await outboxRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.htmlSnapshot).not.toMatch(/<script/i);
    expect(rows[0]!.htmlSnapshot).toContain('Salut'); // contenu légitime conservé
    expect(rows[0]!.source).toBe('template-test');
    expect(rows[0]!.toEmail).toBe('dest@example.com');
  });

  it('F07-S-002 : non authentifié → 401 (aucune écriture outbox)', async () => {
    (getAdminSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const id = await seedTemplate('<p>x</p>');
    const res = await POST(postReq({ recipient: 'dest@example.com' }), { params: { id } });
    expect(res.status).toBe(401);
    expect(await outboxRows()).toHaveLength(0);
  });

  it('F07-S-003 : template introuvable → 404', async () => {
    const res = await POST(postReq({ recipient: 'dest@example.com' }), { params: { id: randomUUID() } });
    expect(res.status).toBe(404);
  });

  it('F07-S-004 : recipient invalide → 422', async () => {
    const id = await seedTemplate('<p>x</p>');
    const res = await POST(postReq({ recipient: 'pas-un-email' }), { params: { id } });
    expect(res.status).toBe(422);
    expect(await outboxRows()).toHaveLength(0);
  });

  it('F07-S-010 : rate-limit per-admin → 429 au-delà de la limite (pas d’outbox en trop)', async () => {
    const id = await seedTemplate('<p>x</p>');
    const { limit } = TEST_SEND_RATE_LIMIT;
    for (let i = 0; i < limit; i++) {
      const r = await POST(postReq({ recipient: 'dest@example.com' }), { params: { id } });
      expect(r.status).toBe(200);
    }
    const blocked = await POST(postReq({ recipient: 'dest@example.com' }), { params: { id } });
    expect(blocked.status).toBe(429);
    expect(await outboxRows()).toHaveLength(limit); // le 11e n'a rien inséré
  });

  it('F07-S-020 : audit MINIMISE le PII (destinataire masqué)', async () => {
    const id = await seedTemplate('<p>x</p>');
    await POST(postReq({ recipient: 'cliente.secrete@gmail.com' }), { params: { id } });
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mail.template.test_sent',
        meta: expect.objectContaining({ to: 'c***@gmail.com' }),
      }),
    );
    const call = (logAuditEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![0];
    expect(JSON.stringify(call)).not.toContain('cliente.secrete');
  });
});
