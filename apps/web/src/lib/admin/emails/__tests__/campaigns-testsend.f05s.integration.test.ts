// @vitest-environment node
/**
 * F05-S — test-send : le corps libre est SANITIZÉ avant de partir dans une VRAIE
 * boîte (sécurité G12), contre une vraie Postgres (femiglow_test_m03campagnes).
 *
 * On mocke la frontière Listmonk (subscribers.upsert + transactional.send) pour
 * observer EXACTEMENT le `data.body` transmis ; la DB est réelle (draft seedé).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m03campagnes#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/lib/admin/emails/__tests__/campaigns-testsend.f05s.integration.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createId } from '@/lib/ids';
import { memoryStore } from '@/lib/db/client';
import { TEST_SEND_RATE_LIMIT } from '@/lib/admin/emails/campaigns-shared';
import { emailCampaignLink } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeCampaignLink } from '@/test/factories/emails.factory';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const lmUpsert = vi.fn();
const lmTxSend = vi.fn();
vi.mock('@/lib/mail/listmonk/client', () => ({
  ListmonkConfigError: class ListmonkConfigError extends Error {},
  ListmonkApiError: class ListmonkApiError extends Error {},
  listmonk: {
    subscribers: { upsert: (...a: unknown[]) => lmUpsert(...a) },
    transactional: { send: (...a: unknown[]) => lmTxSend(...a) },
  },
}));

import { sendCampaignTest } from '@/lib/admin/emails/wizard-actions';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

async function seedDraftWithTemplate(payloadOver: Record<string, unknown> = {}): Promise<string> {
  const row = makeCampaignLink({
    id: createId('camp'),
    status: 'draft',
    subject: '✨ Aïd Moubarak',
    // readPayloadTemplateId lit payload_json.listmonkTemplateId.
    payloadJson: { listmonkTemplateId: 5, body: '<p>corps</p>', ...payloadOver },
  });
  await db.insert(emailCampaignLink).values(row);
  return row.id;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncateEmailTables();
  memoryStore().rateLimitCounters.clear(); // isolation du compteur in-memory
  lmUpsert.mockResolvedValue({ data: { id: 1 } });
  lmTxSend.mockResolvedValue({ data: true });
});
afterAll(async () => {
  await closeTestDb();
});

describeEmailsDb('F05-S — test-send (corps sanitizé, vraie DB)', () => {
  it('F05-S-007 : le corps fourni est SANITIZÉ avant transactional.send (merge-tag préservé)', async () => {
    const id = await seedDraftWithTemplate();
    const res = await sendCampaignTest({
      id,
      email: 'nadia@femiglow-maroc.com',
      bodyHtml: '<p>Salut {{ .Subscriber.Name }}</p><script>steal()</script><a href="javascript:alert(1)">x</a>',
    });
    expect(res.ok).toBe(true);
    expect(lmTxSend).toHaveBeenCalledTimes(1);
    const data = (lmTxSend.mock.calls[0]![0] as { data: { body: string } }).data;
    expect(data.body).not.toMatch(/<script/i);
    expect(data.body).not.toMatch(/javascript:/i);
    expect(data.body).toContain('{{ .Subscriber.Name }}');
  });

  it('F05-S-008 : à défaut de corps fourni, le corps du payload est SANITIZÉ aussi', async () => {
    const id = await seedDraftWithTemplate({ body: '<p>Promo</p><iframe src="//evil.tld"></iframe>' });
    await sendCampaignTest({ id, email: 'nadia@femiglow-maroc.com' });
    const data = (lmTxSend.mock.calls[0]![0] as { data: { body: string } }).data;
    expect(data.body).not.toMatch(/<iframe/i);
    expect(data.body).toContain('Promo');
  });

  it('F05-S-013 : l’audit MINIMISE le PII (destinataire masqué, pas en clair)', async () => {
    const { logAuditEvent } = await import('@/lib/audit/log-event');
    const id = await seedDraftWithTemplate();
    await sendCampaignTest({ id, email: 'cliente.secrete@gmail.com' });
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mail.campaign.test_sent',
        meta: expect.objectContaining({ to: 'c***@gmail.com' }),
      }),
    );
    // Aucune trace du local part complet.
    const call = (logAuditEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![0];
    expect(JSON.stringify(call)).not.toContain('cliente.secrete');
  });

  it('F05-S-009 : rate-limit anti-abus — au-delà de la limite/min, le test-send est refusé', async () => {
    const id = await seedDraftWithTemplate();
    const { limit } = TEST_SEND_RATE_LIMIT;
    // `limit` envois passent…
    for (let i = 0; i < limit; i++) {
      const r = await sendCampaignTest({ id, email: 'nadia@femiglow-maroc.com' });
      expect(r.ok).toBe(true);
    }
    // …le suivant est bloqué SANS toucher Listmonk.
    expect(lmTxSend).toHaveBeenCalledTimes(limit);
    const blocked = await sendCampaignTest({ id, email: 'nadia@femiglow-maroc.com' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Trop d'envois de test/i);
    expect(lmTxSend).toHaveBeenCalledTimes(limit); // pas d'appel supplémentaire
  });
});
