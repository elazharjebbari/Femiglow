// @vitest-environment node
/**
 * Module 03 — Campagnes : finalisation atomique + sync de statuts/métriques,
 * contre une VRAIE Postgres de test (femiglow_test_m03campagnes).
 *
 * C'est la couche qui attrape les défauts transactionnels (R-010 : campagne
 * fantôme / double-envoi) et de machine d'états (A-CMP-5). On ne mock QUE les
 * frontières externes (Listmonk, requireAdmin, audit, next/cache) ; la DB est
 * réelle → on observe l'état exact après chaque incident injecté.
 *
 * Couvre : CMP-INT-001..012, 025..028 (finalize),
 *          CMP-INT-013..024 (status-sync),
 *          CMP-UNIT-033/034 (machine d'états + mapping — testés en pur ici).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m03campagnes#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/lib/admin/emails/__tests__/campaigns-finalize.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { randomUUID } from 'node:crypto';

import { createId } from '@/lib/ids';
import {
  emailAudience,
  emailAudienceSnapshot,
  emailCampaignLink,
} from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import {
  makeAudienceSnapshot,
  makeCampaignLink,
  makeEmailAudience,
} from '@/test/factories/emails.factory';

// ── Mocks de frontières externes ─────────────────────────────────────────
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Listmonk client mocké : on observe create / updateStatus / get.
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

// Audience native (M5.4) : snapshot + push Listmonk mockés pour CMP-INT-008/009.
const snapshotAudience = vi.fn();
const pushSnapshotToListmonk = vi.fn();
vi.mock('@/lib/mail/audiences/snapshot', () => ({
  snapshotAudience: (...a: unknown[]) => snapshotAudience(...a),
}));
vi.mock('@/lib/mail/campaigns/listmonk-sync', () => ({
  pushSnapshotToListmonk: (...a: unknown[]) => pushSnapshotToListmonk(...a),
}));

import {
  finalizeCampaign,
  updateCampaignDraft,
  createCampaignDraft,
  discardCampaign,
} from '@/lib/admin/emails/wizard-actions';
import {
  syncCampaignStatuses,
  isLegalTransition,
  mapListmonkStatus,
  type FemiGlowCampaignStatus,
} from '@/lib/mail/campaigns/listmonk-status-sync';

// Init paresseuse (Proxy) : emailsTestDb() throw sans URL femiglow_test ; un
// accès module-level casserait le run global. Résolution au 1er accès, dans un
// test actif (cf. automation-engine.integration.test.ts §convention).
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

type CampaignOver = Parameters<typeof makeCampaignLink>[0];

/**
 * Seed d'un brouillon `draft` complet (legacy lists par défaut, lm id null).
 * Renvoie l'id inséré.
 */
async function seedDraft(over: CampaignOver = {}): Promise<string> {
  const row = makeCampaignLink({
    id: createId('camp'),
    name: 'Aïd 2026 — offre rituels',
    subject: '✨ Aïd Moubarak',
    status: 'draft',
    audienceLinkIds: [11],
    listmonkCampaignId: null,
    payloadJson: {},
    createdByUserId: 'nadia@femiglow-maroc.com',
    ...over,
  });
  await db.insert(emailCampaignLink).values(row);
  return row.id;
}

/** Crée une audience native (satisfait la FK email_campaign_link.audience_id). */
async function seedAudience(id: string): Promise<string> {
  await db.insert(emailAudience).values(makeEmailAudience({ id } as never));
  return id;
}

/**
 * Crée un snapshot lié à une audience (satisfait la FK
 * email_campaign_link.snapshot_id quand finalize persiste le snapshot natif).
 * Renvoie l'id (uuid) du snapshot.
 */
async function seedSnapshot(audienceId: string): Promise<string> {
  const id = randomUUID();
  await db
    .insert(emailAudienceSnapshot)
    .values(makeAudienceSnapshot({ id, audienceId } as never));
  return id;
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
  // Le client Listmonk applicatif est mocké, mais snapshot/push lisent ces env
  // via getListmonkConfig — on les positionne par prudence (mock domine).
  process.env.LISTMONK_INTERNAL_URL = 'http://127.0.0.1:9000';
  process.env.LISTMONK_API_USER = 'admin';
  process.env.LISTMONK_API_TOKEN = 'token';
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

// ── Machine d'états (pur) — CMP-UNIT-033 / 034 ───────────────────────────
describeEmailsDb('campagnes — machine d\'états & mapping (pur)', () => {
  // CMP-UNIT-034 : mapping Listmonk→FemiGlow exhaustif.
  it.each([
    ['running', 'sending'],
    ['finished', 'sent'],
    ['cancelled', 'cancelled'],
    ['scheduled', 'scheduled'],
    ['paused', null],
    ['draft', null],
    ['unknown-future-status', null],
  ] as const)('CMP-UNIT-034 : map %s → %s', (lm, expected) => {
    expect(mapListmonkStatus(lm)).toBe(expected);
  });

  // CMP-UNIT-033 : table des transitions légales / illégales.
  it.each([
    // légales
    ['draft', 'scheduled', true],
    ['draft', 'sending', true],
    ['scheduled', 'sending', true],
    ['sending', 'sent', true],
    ['sending', 'cancelled', true],
    ['scheduled', 'cancelled', true],
    ['draft', 'cancelled', true],
    ['sent', 'sent', true], // no-op idempotent
    // illégales (régressions terminales / impossibles)
    ['sent', 'sending', false],
    ['sent', 'scheduled', false],
    ['cancelled', 'sending', false],
    ['cancelled', 'scheduled', false],
    ['sent', 'cancelled', false],
    ['sending', 'scheduled', false],
    ['sending', 'draft', false],
  ] as const)('CMP-UNIT-033 : %s → %s légal=%s', (from, to, expected) => {
    expect(
      isLegalTransition(from as FemiGlowCampaignStatus, to as FemiGlowCampaignStatus),
    ).toBe(expected);
  });
});

// ── Finalize : happy path & préconditions ────────────────────────────────
describeEmailsDb('finalizeCampaign — happy path & préconditions', () => {
  it('CMP-INT-001 : send-now crée la campagne Listmonk + mirror DB cohérent', async () => {
    const id = await seedDraft();
    const res = await finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>Aïd Moubarak</p>' });

    expect(res.campaignId).toBe(777);
    expect(lmCreate).toHaveBeenCalledTimes(1);
    expect(lmUpdateStatus).toHaveBeenCalledWith(777, 'running');

    const row = await loadRow(id);
    expect(row?.status).toBe('sending');
    expect(row?.listmonkCampaignId).toBe(777);
    expect(row?.startedAt).not.toBeNull();
  });

  it('CMP-INT-011 : scheduled positionne status=scheduled et laisse startedAt null', async () => {
    lmUpdateStatus.mockResolvedValue({ data: { status: 'scheduled' } });
    const id = await seedDraft({ scheduledFor: new Date(Date.now() + 86_400_000) });
    await finalizeCampaign({ id, sendNow: false, bodyHtml: '<p>x</p>' });

    const row = await loadRow(id);
    expect(row?.status).toBe('scheduled');
    expect(row?.startedAt).toBeNull();
    expect(row?.listmonkCampaignId).toBe(777);
    expect(lmUpdateStatus).toHaveBeenCalledWith(777, 'scheduled');
  });

  it('CMP-INT-006 : sujet vide rejette AVANT tout appel Listmonk', async () => {
    const id = await seedDraft({ subject: '' });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/Sujet manquant/i);
    expect(lmCreate).not.toHaveBeenCalled();
    // Aucune mutation : le brouillon reste draft, pas de lm id.
    const row = await loadRow(id);
    expect(row?.status).toBe('draft');
    expect(row?.listmonkCampaignId).toBeNull();
  });

  it('CMP-INT-007 : aucune liste ni audience rejette avant tout create', async () => {
    const id = await seedDraft({ audienceLinkIds: [], audienceId: null });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/Aucune liste ni audience/i);
    expect(lmCreate).not.toHaveBeenCalled();
    expect((await loadRow(id))?.status).toBe('draft');
  });

  it('CMP-INT-010 : id inexistant rejette', async () => {
    await expect(
      finalizeCampaign({ id: createId('camp'), sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/introuvable/i);
    expect(lmCreate).not.toHaveBeenCalled();
  });
});

// ── Finalize : audience native (snapshot + push) — CMP-INT-008/009 ───────
describeEmailsDb('finalizeCampaign — audience native', () => {
  it('CMP-INT-008 : audienceId → snapshot + push Listmonk, create reçoit la liste éphémère', async () => {
    const audienceId = await seedAudience('11111111-1111-1111-1111-111111111111');
    const snapshotId = await seedSnapshot(audienceId);
    snapshotAudience.mockResolvedValue({ snapshotId, size: 50000, status: 'done' });
    pushSnapshotToListmonk.mockResolvedValue({ listmonkListId: 9001, pushed: 50000 });

    const id = await seedDraft({ audienceLinkIds: [], audienceId });
    await finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' });

    expect(snapshotAudience).toHaveBeenCalledWith(
      audienceId,
      expect.objectContaining({ campaignId: id, source: 'campaign' }),
    );
    expect(pushSnapshotToListmonk).toHaveBeenCalledWith(snapshotId);
    // create() reçoit la liste éphémère retournée par le push, pas la legacy.
    expect(lmCreate.mock.calls[0]![0]).toMatchObject({ lists: [9001] });

    const row = await loadRow(id);
    expect(row?.snapshotId).toBe(snapshotId);
    expect(row?.snapshotListmonkListId).toBe(9001);
    expect(row?.listmonkCampaignId).toBe(777);
    expect(row?.status).toBe('sending');
  });

  it('CMP-INT-009 : push pushed=0 rejette, campagne Listmonk NON créée', async () => {
    const audienceId = await seedAudience('22222222-2222-2222-2222-222222222222');
    const snapshotId = await seedSnapshot(audienceId);
    snapshotAudience.mockResolvedValue({ snapshotId, size: 12, status: 'done' });
    pushSnapshotToListmonk.mockResolvedValue({ listmonkListId: 9002, pushed: 0 });

    const id = await seedDraft({ audienceLinkIds: [], audienceId });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/0 a\/ont pu être ajouté|pu être ajouté/i);

    expect(lmCreate).not.toHaveBeenCalled();
    // Le brouillon reste draft (réservation faite APRÈS la précondition push).
    expect((await loadRow(id))?.status).toBe('draft');
  });
});

// ── Finalize : garde anti double-envoi (R-010 / A-CMP-2) ─────────────────
describeEmailsDb('finalizeCampaign — garde anti double-envoi', () => {
  it('CMP-INT-003 : retry après succès NE recrée PAS de campagne Listmonk', async () => {
    const id = await seedDraft();
    await finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' });
    expect(lmCreate).toHaveBeenCalledTimes(1);

    // L'opérateur reclique : le brouillon est désormais 'sending'.
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/ne peut plus être finalisée/i);

    // Oracle clé R-010 : create appelé UNE SEULE fois sur les deux tentatives.
    expect(lmCreate).toHaveBeenCalledTimes(1);
    expect(lmUpdateStatus).toHaveBeenCalledTimes(1);
  });

  it('CMP-INT-004 : un brouillon déjà sending refuse la finalisation (aucune mutation Listmonk)', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 500 });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/ne peut plus être finalisée/i);
    expect(lmCreate).not.toHaveBeenCalled();
    expect(lmUpdateStatus).not.toHaveBeenCalled();
  });

  it('CMP-INT-005 : un brouillon sent refuse la finalisation', async () => {
    const id = await seedDraft({ status: 'sent', listmonkCampaignId: 501 });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/ne peut plus être finalisée/i);
    expect(lmCreate).not.toHaveBeenCalled();
  });
});

// ── Finalize : atomicité / crash mid-flow (R-010 / A-CMP-1) ──────────────
describeEmailsDb('finalizeCampaign — atomicité (crash mid-flow)', () => {
  it('CMP-INT-002 : crash pendant updateStatus(running) — pas de fantôme, retry ne double PAS l\'envoi', async () => {
    const id = await seedDraft();

    // Listmonk crée la campagne (lm id 777), puis updateStatus tombe (ECONNRESET).
    // À ce stade, l'ID externe a déjà été persisté APRÈS create (fix R-010) et
    // le brouillon est passé 'sending' lors de la réservation atomique.
    lmUpdateStatus.mockRejectedValueOnce(new Error('ECONNRESET pendant updateStatus'));

    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/ECONNRESET/);

    const row = await loadRow(id);
    // Oracle cible (R-010) : l'état reflète l'incident — sending + lm id tracé.
    // PAS de fantôme silencieux (une campagne 777 existe et EST référencée).
    expect(row?.status).toBe('sending');
    expect(row?.listmonkCampaignId).toBe(777);
    expect(lmCreate).toHaveBeenCalledTimes(1);

    // L'opérateur, croyant l'envoi raté, reclique.
    lmUpdateStatus.mockResolvedValue({ data: { status: 'running' } });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/ne peut plus être finalisée/i);

    // Oracle anti double-envoi : create reste à 1 (idempotence par claim+lm id).
    expect(lmCreate).toHaveBeenCalledTimes(1);
  });

  it('R-010 : échec de campaigns.create() déréserve le brouillon (retour draft, pas de fantôme)', async () => {
    const id = await seedDraft();
    lmCreate.mockRejectedValueOnce(new Error('Listmonk 503 sur /api/campaigns'));

    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/503/);

    // Aucun envoi n'a démarré (updateStatus non appelé) → on peut retenter.
    const row = await loadRow(id);
    expect(row?.status).toBe('draft');
    expect(row?.listmonkCampaignId).toBeNull();
    expect(lmUpdateStatus).not.toHaveBeenCalled();

    // Retry propre : une seule campagne finit par être créée et tracée.
    lmCreate.mockResolvedValue({ data: { id: 778 } });
    await finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' });
    const after = await loadRow(id);
    expect(after?.status).toBe('sending');
    expect(after?.listmonkCampaignId).toBe(778);
    expect(lmCreate).toHaveBeenCalledTimes(2); // 1 échec + 1 succès, jamais 2 envois
  });

  it('CMP-INT-012 : l\'unique index listmonk_campaign_id empêche deux mirrors avec le même lm id', async () => {
    await seedDraft({ listmonkCampaignId: 999, status: 'sending' });
    await expect(
      seedDraft({ listmonkCampaignId: 999, status: 'sending' }),
    ).rejects.toThrow();
  });
});

// ── CRUD draft — CMP-INT-025 / 026 / 027 / 028 ───────────────────────────
describeEmailsDb('CRUD draft', () => {
  it('CMP-INT-025 : createCampaignDraft insère status=draft + audit', async () => {
    const { logAuditEvent } = await import('@/lib/audit/log-event');
    const fd = new FormData();
    fd.set('name', 'Campagne créée par test');
    // createCampaignDraft termine par redirect() qui lève en environnement test.
    await createCampaignDraft(fd).catch(() => {});

    const rows = await db.select().from(emailCampaignLink);
    const created = rows.find((r) => r.name === 'Campagne créée par test');
    expect(created).toBeDefined();
    expect(created?.status).toBe('draft');
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mail.campaign.draft_created' }),
    );
  });

  it('CMP-INT-026 : updateCampaignDraft n\'applique QUE les champs fournis', async () => {
    const id = await seedDraft({ name: 'Nom initial', preheader: 'avant', subject: 'Sujet initial' });
    await updateCampaignDraft({ id, subject: 'Nouveau sujet' });
    const row = await loadRow(id);
    expect(row?.subject).toBe('Nouveau sujet');
    expect(row?.name).toBe('Nom initial'); // inchangé
    expect(row?.preheader).toBe('avant'); // inchangé
  });

  it('CMP-INT-027 : discardCampaign passe status=cancelled + audit', async () => {
    const { logAuditEvent } = await import('@/lib/audit/log-event');
    const id = await seedDraft();
    const fd = new FormData();
    fd.set('id', id);
    await discardCampaign(fd).catch(() => {}); // redirect() lève en test
    const row = await loadRow(id);
    expect(row?.status).toBe('cancelled');
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mail.campaign.cancelled', resourceId: id }),
    );
  });

  it('CMP-INT-028 : finalize refusé si status != draft (garde d\'édition côté action)', async () => {
    // L'édition/finalisation d'une campagne sending/sent est verrouillée par la
    // garde status!=draft — preuve : aucune mutation Listmonk pour sending.
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 600 });
    await expect(
      finalizeCampaign({ id, sendNow: true, bodyHtml: '<p>x</p>' }),
    ).rejects.toThrow(/ne peut plus être finalisée/i);
    expect(lmCreate).not.toHaveBeenCalled();
  });
});

// ── Status sync : transitions & métriques ────────────────────────────────
describeEmailsDb('syncCampaignStatuses — transitions & métriques', () => {
  function lmCampaign(over: Record<string, unknown>) {
    return {
      data: { status: 'running', sent: 0, views: 0, clicks: 0, bounces: 0, to_send: 0, ...over },
    };
  }

  it('CMP-INT-013 : running → sending applique les compteurs', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 110 });
    lmGet.mockResolvedValue(lmCampaign({ status: 'running', sent: 1200, views: 300, clicks: 20, bounces: 2 }));
    await syncCampaignStatuses();
    const row = await loadRow(id);
    expect(row?.status).toBe('sending');
    expect(row?.sentCount).toBe(1200);
    expect(row?.openCount).toBe(300);
    expect(row?.clickCount).toBe(20);
    expect(row?.bounceCount).toBe(2);
  });

  it('CMP-INT-014 : finished → sent + finishedAt + métriques', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 100 });
    lmGet.mockResolvedValue(
      lmCampaign({ status: 'finished', sent: 49000, views: 12000, clicks: 800, bounces: 30 }),
    );
    const res = await syncCampaignStatuses();
    expect(res.updated).toBeGreaterThanOrEqual(1);
    const row = await loadRow(id);
    expect(row?.status).toBe('sent');
    expect(row?.finishedAt).not.toBeNull();
    expect(row?.sentCount).toBe(49000);
    expect(row?.openCount).toBe(12000);
    expect(row?.clickCount).toBe(800);
    expect(row?.bounceCount).toBe(30);
  });

  it('CMP-INT-015 : cancelled Listmonk → cancelled FemiGlow', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 115 });
    lmGet.mockResolvedValue(lmCampaign({ status: 'cancelled' }));
    await syncCampaignStatuses();
    expect((await loadRow(id))?.status).toBe('cancelled');
  });

  it('CMP-INT-016 : sent (terminal) n\'est PAS remis en sending par un poll rejoué', async () => {
    const id = await seedDraft({
      status: 'sent',
      listmonkCampaignId: 101,
      finishedAt: new Date(Date.now() - 60_000),
      openCount: 12000,
    });
    // Listmonk renvoie un état obsolète 'running' (rejeu).
    lmGet.mockResolvedValue(lmCampaign({ status: 'running', sent: 49000, views: 12500 }));
    await syncCampaignStatuses();
    const row = await loadRow(id);
    // Oracle A-CMP-5 : la régression sent→sending est interdite.
    expect(row?.status).toBe('sent');
    // Les métriques, elles, restent rafraîchies (dans la fenêtre).
    expect(row?.openCount).toBe(12500);
  });

  it('CMP-INT-017 : cancelled (terminal) ne repasse pas en sending', async () => {
    const id = await seedDraft({
      status: 'cancelled',
      listmonkCampaignId: 116,
      // cancelled n'est candidate au poll que via la branche sending/scheduled ;
      // ici on force la candidature en gardant un finishedAt récent serait
      // inopérant (status != sent). On exerce donc la garde de mapping
      // directement : même incluse, la transition resterait illégale.
    });
    lmGet.mockResolvedValue(lmCampaign({ status: 'running' }));
    await syncCampaignStatuses();
    // cancelled n'est pas dans la fenêtre de candidats → non pollée → inchangée.
    expect((await loadRow(id))?.status).toBe('cancelled');
  });

  it('CMP-INT-018 : campagne sent finishedAt H-25 n\'est plus pollée (métriques figées)', async () => {
    const id = await seedDraft({
      status: 'sent',
      listmonkCampaignId: 102,
      finishedAt: new Date(Date.now() - 25 * 3_600_000),
      openCount: 100,
    });
    lmGet.mockResolvedValue(lmCampaign({ status: 'finished', views: 99999 }));
    await syncCampaignStatuses();
    // Hors fenêtre → non candidate → openCount figé à 100 (écart A-CMP-3 documenté).
    expect(lmGet).not.toHaveBeenCalledWith(102);
    expect((await loadRow(id))?.openCount).toBe(100);
  });

  it('CMP-INT-019 : campagne sent finishedAt H-23 reste pollée (métriques rafraîchies)', async () => {
    const id = await seedDraft({
      status: 'sent',
      listmonkCampaignId: 103,
      finishedAt: new Date(Date.now() - 23 * 3_600_000),
      openCount: 100,
    });
    lmGet.mockResolvedValue(lmCampaign({ status: 'finished', views: 555 }));
    await syncCampaignStatuses();
    expect(lmGet).toHaveBeenCalledWith(103);
    expect((await loadRow(id))?.openCount).toBe(555);
  });

  it('CMP-INT-020 : deliveredCount jamais alimenté par le sync actuel (RED — colonne morte A-CMP-4)', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 104 });
    lmGet.mockResolvedValue(lmCampaign({ status: 'finished', sent: 10 }));
    await syncCampaignStatuses();
    // Listmonk n'expose pas de "delivered" distinct du "sent" → colonne reste 0.
    // Oracle documenté : à flipper le jour où le câblage delivered sera fait.
    expect((await loadRow(id))?.deliveredCount).toBe(0);
  });

  it('CMP-INT-021 : compteurs DB == valeurs Listmonk après sync', async () => {
    const id = await seedDraft({ status: 'sending', listmonkCampaignId: 121 });
    const payload = { status: 'finished', sent: 4321, views: 999, clicks: 77, bounces: 9 };
    lmGet.mockResolvedValue(lmCampaign(payload));
    await syncCampaignStatuses();
    const row = await loadRow(id);
    expect(row?.sentCount).toBe(payload.sent);
    expect(row?.openCount).toBe(payload.views);
    expect(row?.clickCount).toBe(payload.clicks);
    expect(row?.bounceCount).toBe(payload.bounces);
  });

  it('CMP-INT-022 : une erreur Listmonk n\'interrompt pas le batch', async () => {
    const ok = await seedDraft({ status: 'sending', listmonkCampaignId: 105 });
    await seedDraft({ status: 'sending', listmonkCampaignId: 106 });
    lmGet.mockImplementation(async (lmId: number) => {
      if (lmId === 106) throw new Error('Listmonk 503');
      return lmCampaign({ status: 'finished', sent: 5 });
    });
    const res = await syncCampaignStatuses();
    expect(res.checked).toBe(2);
    expect(res.errors).toBeGreaterThanOrEqual(1);
    // L'autre campagne est bien traitée malgré l'échec de la 106.
    expect((await loadRow(ok))?.status).toBe('sent');
  });

  it('CMP-INT-023 : draft sans listmonkCampaignId est exclu du poll', async () => {
    await seedDraft({ status: 'draft', listmonkCampaignId: null });
    const res = await syncCampaignStatuses();
    expect(res.checked).toBe(0);
    expect(lmGet).not.toHaveBeenCalled();
  });

  it('CMP-INT-024 : une scheduled reste candidate jusqu\'à running', async () => {
    const id = await seedDraft({ status: 'scheduled', listmonkCampaignId: 124 });
    lmGet.mockResolvedValue(lmCampaign({ status: 'running', sent: 10 }));
    const res = await syncCampaignStatuses();
    expect(res.checked).toBeGreaterThanOrEqual(1);
    expect(lmGet).toHaveBeenCalledWith(124);
    expect((await loadRow(id))?.status).toBe('sending');
  });
});
