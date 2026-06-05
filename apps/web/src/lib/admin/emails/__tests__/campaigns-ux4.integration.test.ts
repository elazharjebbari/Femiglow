// @vitest-environment node
/**
 * VAGUE 4 — CAMPAGNES — pilotabilité (vraie Postgres femiglow_test_m03campagnes).
 *
 * Oracles couverts :
 *  - UX4-CAMPAGNES-003 : updateCampaignDraft persiste listmonkTemplateId
 *    (rangé dans payload_json.listmonkTemplateId) ; relire le draft → 42,
 *    et NON null. + finalizeCampaign relit ce template en fallback.
 *  - UX4-CAMPAGNES-004 : duplicateCampaign(id) crée un brouillon « (copie) »
 *    copiant subject/audience/payload, statut draft, lm id réinitialisé.
 *  + pauseCampaign/cancelCampaign poussent le statut Listmonk et le miroir DB,
 *    refusent les transitions illégales.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m03campagnes#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/lib/admin/emails/__tests__/campaigns-ux4.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { emailCampaignLink } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeCampaignLink } from '@/test/factories/emails.factory';

// ── Mocks de frontières externes ─────────────────────────────────────────
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const lmCreate = vi.fn();
const lmUpdateStatus = vi.fn();
const lmGet = vi.fn();
vi.mock('@/lib/mail/listmonk/client', () => ({
  ListmonkConfigError: class ListmonkConfigError extends Error {},
  ListmonkApiError: class ListmonkApiError extends Error {},
  listmonk: {
    campaigns: {
      create: (...a: unknown[]) => lmCreate(...a),
      updateStatus: (...a: unknown[]) => lmUpdateStatus(...a),
      get: (...a: unknown[]) => lmGet(...a),
    },
  },
}));

import {
  updateCampaignDraft,
  duplicateCampaign,
  pauseCampaign,
  cancelCampaign,
  finalizeCampaign,
  readPayloadTemplateId,
} from '@/lib/admin/emails/wizard-actions';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

async function seedDraft(over: Parameters<typeof makeCampaignLink>[0] = {}): Promise<string> {
  const row = makeCampaignLink({
    id: createId('camp'),
    name: 'Aïd 2026 — offre rituels',
    subject: '✨ Aïd Moubarak',
    preheader: 'Ton rituel offert',
    status: 'draft',
    audienceLinkIds: [11, 12],
    listmonkCampaignId: null,
    payloadJson: { body: '<p>Bonjour</p>' },
    createdByUserId: 'nadia@femiglow-maroc.com',
    ...over,
  });
  await db.insert(emailCampaignLink).values(row);
  return row.id;
}

async function loadRow(id: string) {
  const [row] = await db
    .select()
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, id))
    .limit(1);
  return row;
}

beforeAll(() => {
  process.env.MAIL_FROM = 'info@femiglow-maroc.com';
});

beforeEach(async () => {
  vi.clearAllMocks();
  await truncateEmailTables();
  lmCreate.mockResolvedValue({ data: { id: 777 } });
  lmUpdateStatus.mockResolvedValue({ data: { status: 'running' } });
});

afterAll(async () => {
  await closeTestDb();
});

// ── UX4-CAMPAGNES-003 — persistance du template Listmonk ──────────────────
describeEmailsDb('UX4-CAMPAGNES-003 — updateCampaignDraft persiste listmonkTemplateId', () => {
  it('UX4-CAMPAGNES-003 : listmonkTemplateId=42 est relu (et non null)', async () => {
    const id = await seedDraft({ payloadJson: { body: '<p>x</p>' } });
    await updateCampaignDraft({ id, listmonkTemplateId: 42, payloadJson: { body: '<p>x</p>' } });

    const row = await loadRow(id);
    // Persisté dans payload_json.listmonkTemplateId, lu par le helper exporté.
    expect(readPayloadTemplateId(row?.payloadJson)).toBe(42);
    // Le body n'a PAS été écrasé par le merge.
    expect((row?.payloadJson as { body?: string }).body).toBe('<p>x</p>');
  });

  it('UX4-CAMPAGNES-003b : un update ultérieur sans template conserve le template', async () => {
    const id = await seedDraft();
    await updateCampaignDraft({ id, listmonkTemplateId: 42, payloadJson: { body: '<p>a</p>' } });
    // Update du seul sujet (pas de payload, pas de template) : ne doit pas perdre 42.
    await updateCampaignDraft({ id, subject: 'Nouveau sujet' });
    const row = await loadRow(id);
    expect(row?.subject).toBe('Nouveau sujet');
    expect(readPayloadTemplateId(row?.payloadJson)).toBe(42);
  });

  it('UX4-CAMPAGNES-003c : finalizeCampaign relit le template persisté en fallback', async () => {
    const id = await seedDraft({ audienceLinkIds: [11] });
    await updateCampaignDraft({ id, listmonkTemplateId: 42, payloadJson: { body: '<p>b</p>' } });
    // finalize SANS passer listmonkTemplateId → doit reprendre 42 depuis le draft.
    await finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>b</p>' });
    expect(lmCreate.mock.calls[0]![0]).toMatchObject({ template_id: 42 });
  });
});

// ── UX4-CAMPAGNES-004 — duplication ───────────────────────────────────────
describeEmailsDb('UX4-CAMPAGNES-004 — duplicateCampaign', () => {
  it('UX4-CAMPAGNES-004 : crée un brouillon (copie) copiant subject/audience/payload', async () => {
    const srcId = await seedDraft({
      name: 'Newsletter Aïd',
      subject: '✨ Aïd Moubarak',
      status: 'sent',
      audienceLinkIds: [11, 12],
      listmonkCampaignId: 555,
      payloadJson: { body: '<p>copie-moi</p>', listmonkTemplateId: 7 },
    });

    const fd = new FormData();
    fd.set('id', srcId);
    // duplicateCampaign termine par redirect() (lève en test) → on l'avale.
    await duplicateCampaign(fd).catch(() => {});

    const rows = await db.select().from(emailCampaignLink);
    const copy = rows.find((r) => r.id !== srcId);
    expect(copy).toBeDefined();
    expect(copy?.name).toBe('Newsletter Aïd (copie)');
    expect(copy?.subject).toBe('✨ Aïd Moubarak');
    expect(copy?.status).toBe('draft');
    expect(copy?.audienceLinkIds).toEqual([11, 12]);
    expect((copy?.payloadJson as { body?: string }).body).toBe('<p>copie-moi</p>');
    expect(readPayloadTemplateId(copy?.payloadJson)).toBe(7);
    // Réinitialisés : nouvelle campagne vierge côté envoi.
    expect(copy?.listmonkCampaignId).toBeNull();
    expect(copy?.scheduledFor).toBeNull();
  });
});

// ── UX-CAMP-002 — pause / annulation (machine d'états) ────────────────────
describeEmailsDb('UX-CAMP-002 — contrôle d’urgence (pause/annulation)', () => {
  it('pauseCampaign sending → paused pousse Listmonk + miroir', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 600 });
    const fd = new FormData();
    fd.set('id', id);
    await pauseCampaign(fd);
    expect(lmUpdateStatus).toHaveBeenCalledWith(600, 'paused');
    expect((await loadRow(id))?.status).toBe('paused');
  });

  it('cancelCampaign sending → cancelled + finishedAt', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 601 });
    const fd = new FormData();
    fd.set('id', id);
    await cancelCampaign(fd);
    expect(lmUpdateStatus).toHaveBeenCalledWith(601, 'cancelled');
    const row = await loadRow(id);
    expect(row?.status).toBe('cancelled');
    expect(row?.finishedAt).not.toBeNull();
  });

  it('pauseCampaign sur une campagne sent (terminale) est refusé, aucune mutation', async () => {
    const id = await seedDraft({ status: 'sent', listmonkCampaignId: 602 });
    const fd = new FormData();
    fd.set('id', id);
    await expect(pauseCampaign(fd)).rejects.toThrow(/interdite/i);
    expect(lmUpdateStatus).not.toHaveBeenCalled();
    expect((await loadRow(id))?.status).toBe('sent');
  });
});
