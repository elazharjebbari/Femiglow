/**
 * LMK — Sync de statut campagne (cron email-campaign-sync) : reflète l'état
 * Listmonk dans FemiGlow SANS jamais régresser un état terminal, et rafraîchit
 * les métriques. Vraie DB (email_campaign_link) + MSW Listmonk loopback ; le
 * VRAI client est exercé (env.LISTMONK_INTERNAL_URL mocké vers 127.0.0.1).
 *
 * Oracles : running -> sending ; finished -> sent + finishedAt ; un poll obsolète
 * (Listmonk encore `running` alors que FemiGlow est `sent`) NE régresse PAS mais
 * met quand même à jour les compteurs ; un 404/500 Listmonk n'arrête pas le cron
 * (errors comptés, pas de crash) → garantie « créds invalides / Listmonk KO ne
 * crashent pas le cron ».
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      LISTMONK_INTERNAL_URL: 'http://127.0.0.1:9914',
      LISTMONK_API_USER: 'apiuser',
      LISTMONK_API_TOKEN: 'tok',
    },
  };
});

import { emailCampaignLink } from '@/lib/db/schema-emails';
import { makeCampaignLink, resetEmailFactories } from '@/test/factories/emails.factory';
import {
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
  closeTestDb,
} from '@/test/db/emails-db';

const BASE = 'http://127.0.0.1:9914';
const server = setupServer();

/** Réponse campagne Listmonk minimale. */
function lmCampaign(over: Record<string, unknown> = {}) {
  return {
    data: {
      id: 1,
      status: 'running',
      sent: 0,
      views: 0,
      clicks: 0,
      bounces: 0,
      to_send: 0,
      ...over,
    },
  };
}

async function seedCampaign(over: Parameters<typeof makeCampaignLink>[0] = {}) {
  const dbt = emailsTestDb();
  const [row] = await dbt
    .insert(emailCampaignLink)
    .values(makeCampaignLink(over))
    .returning({ id: emailCampaignLink.id, listmonkCampaignId: emailCampaignLink.listmonkCampaignId });
  return row!;
}

describeEmailsDb('Module 10 — campaign status sync (vraie DB + MSW)', () => {
  let syncCampaignStatuses: typeof import('../listmonk-status-sync').syncCampaignStatuses;

  beforeAll(async () => {
    server.listen({ onUnhandledRequest: 'error' });
    ({ syncCampaignStatuses } = await import('../listmonk-status-sync'));
  });
  afterEach(() => server.resetHandlers());
  afterAll(async () => {
    server.close();
    await closeTestDb();
  });
  beforeEach(async () => {
    resetEmailFactories();
    await truncateEmailTables();
  });

  it('LMK-CMP-SYNC : Listmonk finished -> FemiGlow sent + finishedAt + métriques', async () => {
    const c = await seedCampaign({ status: 'sending', listmonkCampaignId: 11 });
    server.use(
      http.get(`${BASE}/api/campaigns/11`, () =>
        HttpResponse.json(lmCampaign({ id: 11, status: 'finished', sent: 4200, views: 800, clicks: 120, bounces: 9 })),
      ),
    );
    const res = await syncCampaignStatuses();
    expect(res.checked).toBe(1);
    expect(res.updated).toBe(1);

    const dbt = emailsTestDb();
    const [row] = await dbt
      .select()
      .from(emailCampaignLink)
      .where(eq(emailCampaignLink.id, c.id));
    expect(row!.status).toBe('sent');
    expect(row!.finishedAt, 'finishedAt posé à la complétion').not.toBeNull();
    expect(row!.sentCount).toBe(4200);
    expect(row!.openCount).toBe(800);
    expect(row!.clickCount).toBe(120);
    expect(row!.bounceCount).toBe(9);
  });

  it('LMK-CMP-SYNC : running -> sending', async () => {
    const c = await seedCampaign({ status: 'scheduled', listmonkCampaignId: 12 });
    server.use(
      http.get(`${BASE}/api/campaigns/12`, () =>
        HttpResponse.json(lmCampaign({ id: 12, status: 'running', sent: 10 })),
      ),
    );
    await syncCampaignStatuses();
    const dbt = emailsTestDb();
    const [row] = await dbt
      .select()
      .from(emailCampaignLink)
      .where(eq(emailCampaignLink.id, c.id));
    expect(row!.status).toBe('sending');
  });

  it('LMK-CMP-SYNC-NOREGRESS : sent déjà acquis + Listmonk renvoie running -> reste sent, métriques rafraîchies', async () => {
    // Candidat « sent récemment » (finishedAt < 24h) → repollé pour les métriques.
    const c = await seedCampaign({
      status: 'sent',
      listmonkCampaignId: 13,
      finishedAt: new Date(Date.now() - 3_600_000), // il y a 1h
      sentCount: 100,
    });
    server.use(
      http.get(`${BASE}/api/campaigns/13`, () =>
        // Poll obsolète : Listmonk dit encore running.
        HttpResponse.json(lmCampaign({ id: 13, status: 'running', sent: 150, views: 40 })),
      ),
    );
    const res = await syncCampaignStatuses();
    const dbt = emailsTestDb();
    const [row] = await dbt
      .select()
      .from(emailCampaignLink)
      .where(eq(emailCampaignLink.id, c.id));
    expect(row!.status, 'état terminal sent NE régresse PAS vers sending').toBe('sent');
    expect(row!.sentCount, 'mais les métriques sont rafraîchies').toBe(150);
    expect(row!.openCount).toBe(40);
    expect(res.updated, 'aucune transition de statut appliquée').toBe(0);
  });

  it('LMK-CMP-SYNC-404 : Listmonk 404 -> cron ne crashe pas, error comptée', async () => {
    await seedCampaign({ status: 'sending', listmonkCampaignId: 14 });
    server.use(
      http.get(`${BASE}/api/campaigns/14`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    );
    const res = await syncCampaignStatuses();
    expect(res.checked).toBe(1);
    expect(res.errors, 'erreur isolée, pas de throw').toBe(1);
    expect(res.updated).toBe(0);
  });

  it('LMK-CMP-SYNC-401 : créds invalides (401) -> cron survit, error comptée', async () => {
    await seedCampaign({ status: 'sending', listmonkCampaignId: 15 });
    server.use(
      http.get(`${BASE}/api/campaigns/15`, () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );
    const res = await syncCampaignStatuses();
    expect(res.errors, 'un 401 ne fait pas planter le cron entier').toBe(1);
  });

  it('LMK-CMP-SYNC : campagne terminale ancienne (>24h) n’est PAS repollée', async () => {
    await seedCampaign({
      status: 'sent',
      listmonkCampaignId: 16,
      finishedAt: new Date(Date.now() - 48 * 3_600_000), // il y a 2 jours
    });
    // Aucun handler : si elle était repollée, onUnhandledRequest:'error' casserait.
    const res = await syncCampaignStatuses();
    expect(res.checked, 'campagne terminale ancienne hors fenêtre de poll').toBe(0);
  });
});
