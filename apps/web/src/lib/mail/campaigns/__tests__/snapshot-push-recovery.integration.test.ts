/**
 * LMK-INT-PUSH-* — Push snapshot vers Listmonk : nominal, idempotence,
 * reprise après push partiel, robustesse 409 / create-fail. Vraie DB
 * (email_audience(_snapshot)(_member)) + MSW interceptant l'API Listmonk
 * sur une URL loopback mockée (jamais la prod).
 *
 * Le code applicatif (pushSnapshotToListmonk) lit `db()` de @/lib/db/client
 * (donc DATABASE_URL) et `process.env.LISTMONK_*`. On câble les deux sur la
 * DB/loopback de test ; describeEmailsDb skippe honnêtement sans env.
 *
 * Couvre : OK, IDEM, RECOVERY, COUNT, 409, NOCONFIG, CREATE-FAIL.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { eq } from 'drizzle-orm';

import {
  emailAudience,
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
} from '@/lib/db/schema-emails';
import {
  makeEmailAudience,
  makeAudienceSnapshot,
  resetEmailFactories,
} from '@/test/factories/emails.factory';
import {
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
  closeTestDb,
} from '@/test/db/emails-db';

const BASE = 'http://127.0.0.1:9912';

const server = setupServer();

/**
 * Seed une audience + snapshot (sans listmonkListId) + N membres. Retourne
 * l'id de la snapshot. Le type d'insert exige rulesSnapshot/exclusionSnapshot
 * (NOT NULL) — fournis par la factory.
 */
async function seedSnapshot(memberCount: number): Promise<string> {
  const dbt = emailsTestDb();
  const [aud] = await dbt
    .insert(emailAudience)
    .values(makeEmailAudience())
    .returning({ id: emailAudience.id });
  const [snap] = await dbt
    .insert(emailAudienceSnapshot)
    .values(
      makeAudienceSnapshot({
        audienceId: aud!.id,
        size: memberCount,
        // Snapshot PAS encore poussée : pas de liste Listmonk.
        listmonkListId: null,
        listmonkListName: null,
      }),
    )
    .returning({ id: emailAudienceSnapshot.id });
  const snapshotId = snap!.id;
  for (let i = 0; i < memberCount; i++) {
    await dbt
      .insert(emailAudienceSnapshotMember)
      .values({ snapshotId, email: `member${i}@exemple.test`, payload: {} });
  }
  return snapshotId;
}

/** Handlers Listmonk nominaux : create list + per-subscriber (409 si déjà vu) + attach. */
function nominalListmonk(state: { created: Set<string>; listId: number }) {
  return [
    http.post(`${BASE}/api/lists`, () =>
      HttpResponse.json({ data: { id: state.listId } }),
    ),
    http.post(`${BASE}/api/subscribers`, async ({ request }) => {
      const body = (await request.json()) as { email: string };
      if (state.created.has(body.email)) {
        return HttpResponse.json({ message: 'exists' }, { status: 409 });
      }
      state.created.add(body.email);
      return HttpResponse.json({ data: { id: state.created.size } });
    }),
    http.get(`${BASE}/api/subscribers`, () =>
      HttpResponse.json({ data: { results: [{ id: 1 }] } }),
    ),
    http.put(`${BASE}/api/subscribers/lists`, () =>
      HttpResponse.json({ data: { count: 1 } }),
    ),
  ];
}

describeEmailsDb('Module 10 — push snapshot → Listmonk (vraie DB + MSW)', () => {
  let pushSnapshotToListmonk: typeof import('../listmonk-sync').pushSnapshotToListmonk;

  beforeAll(async () => {
    process.env.LISTMONK_INTERNAL_URL = BASE;
    process.env.LISTMONK_API_USER = 'apiuser';
    process.env.LISTMONK_API_TOKEN = 'tok';
    server.listen({ onUnhandledRequest: 'error' });
    ({ pushSnapshotToListmonk } = await import('../listmonk-sync'));
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

  // LMK-INT-PUSH-OK
  it('LMK-INT-PUSH-OK : 5 membres -> liste créée + 5 poussés + listId persisté', async () => {
    const snapshotId = await seedSnapshot(5);
    const state = { created: new Set<string>(), listId: 4242 };
    server.use(...nominalListmonk(state));

    const res = await pushSnapshotToListmonk(snapshotId);
    expect(res.listmonkListId).toBe(4242);
    expect(res.pushed).toBe(5);

    const dbt = emailsTestDb();
    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId, 'listId persisté sur la snapshot').toBe(4242);
    expect(state.created.size, '5 abonnés créés côté Listmonk').toBe(5);
  });

  // LMK-INT-PUSH-IDEM
  it('LMK-INT-PUSH-IDEM : snapshot déjà pushée -> no-op, aucun create', async () => {
    const snapshotId = await seedSnapshot(3);
    const dbt = emailsTestDb();
    // « Déjà poussée » = liste + marqueur de complétion (metadata.listmonkPushedAt).
    await dbt
      .update(emailAudienceSnapshot)
      .set({
        listmonkListId: 999,
        listmonkListName: 'deja',
        metadata: { listmonkPushedAt: '2026-06-01T10:00:00.000Z' },
      })
      .where(eq(emailAudienceSnapshot.id, snapshotId));

    let createCalled = false;
    server.use(
      http.post(`${BASE}/api/lists`, () => {
        createCalled = true;
        return HttpResponse.json({ data: { id: 1 } });
      }),
    );
    const res = await pushSnapshotToListmonk(snapshotId);
    expect(res.listmonkListId).toBe(999);
    expect(createCalled, 'aucun create si déjà pushée').toBe(false);
  });

  // LMK-INT-PUSH-RECOVERY
  it('LMK-INT-PUSH-RECOVERY : crash après 3/5 -> re-run complète à 5 sans double', async () => {
    const snapshotId = await seedSnapshot(5);
    const dbt = emailsTestDb();
    const state = { created: new Set<string>(), listId: 4242 };

    // 1er run : échoue au 4e POST subscriber (simule crash réseau mi-parcours).
    let postCount = 0;
    server.use(
      http.post(`${BASE}/api/lists`, () => HttpResponse.json({ data: { id: 4242 } })),
      http.post(`${BASE}/api/subscribers`, async ({ request }) => {
        postCount += 1;
        if (postCount === 4) return HttpResponse.error(); // crash réseau
        const body = (await request.json()) as { email: string };
        state.created.add(body.email);
        return HttpResponse.json({ data: { id: state.created.size } });
      }),
      http.get(`${BASE}/api/subscribers`, () =>
        HttpResponse.json({ data: { results: [{ id: 1 }] } }),
      ),
      http.put(`${BASE}/api/subscribers/lists`, () =>
        HttpResponse.json({ data: { count: 1 } }),
      ),
    );
    await pushSnapshotToListmonk(snapshotId).catch(() => {});
    expect(state.created.size, '3 poussés avant le crash').toBe(3);

    // Oracle reprise : listId persisté TÔT (avant les membres) pour rejouer.
    const [mid] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(mid!.listmonkListId, 'listId persisté tôt pour la reprise').toBe(4242);

    // 2e run : nominal, idempotent par email (409 sur déjà-poussés → attach).
    server.resetHandlers();
    server.use(...nominalListmonk(state));
    const res2 = await pushSnapshotToListmonk(snapshotId);
    // CIBLE : 5 membres uniques côté Listmonk, pas de re-création des 3 premiers.
    expect(state.created.size, 'au total 5 membres uniques côté Listmonk').toBe(5);
    expect(res2.listmonkListId).toBe(4242);
  });

  // LMK-INT-PUSH-COUNT
  it('LMK-INT-PUSH-COUNT : nombre poussé == snapshot.size (compte exact)', async () => {
    const snapshotId = await seedSnapshot(7);
    const state = { created: new Set<string>(), listId: 7001 };
    server.use(...nominalListmonk(state));
    const res = await pushSnapshotToListmonk(snapshotId);
    expect(res.pushed, 'pushed == size').toBe(7);
    expect(state.created.size).toBe(7);
  });

  // LMK-INT-PUSH-409
  it('LMK-INT-PUSH-409 : subscriber existant (409) -> attaché à la liste, pas perdu', async () => {
    const snapshotId = await seedSnapshot(1);
    let attachCalled = false;
    let attachBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/lists`, () => HttpResponse.json({ data: { id: 4242 } })),
      http.post(`${BASE}/api/subscribers`, () =>
        HttpResponse.json({ message: 'exists' }, { status: 409 }),
      ),
      http.get(`${BASE}/api/subscribers`, () =>
        HttpResponse.json({ data: { results: [{ id: 77 }] } }),
      ),
      http.put(`${BASE}/api/subscribers/lists`, async ({ request }) => {
        attachCalled = true;
        attachBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { count: 1 } });
      }),
    );
    const res = await pushSnapshotToListmonk(snapshotId);
    expect(attachCalled, 'le 409 déclenche un attach à la liste').toBe(true);
    expect(attachBody, 'attache le subscriber trouvé (77) à la liste 4242').toMatchObject({
      ids: [77],
      target_list_ids: [4242],
    });
    expect(res.pushed, 'le membre attaché compte comme poussé').toBe(1);
  });

  // LMK-INT-PUSH-NOCONFIG
  it('LMK-INT-PUSH-NOCONFIG : config Listmonk absente -> erreur claire avant tout réseau', async () => {
    const snapshotId = await seedSnapshot(2);
    const saved = process.env.LISTMONK_INTERNAL_URL;
    delete process.env.LISTMONK_INTERNAL_URL;
    try {
      // Aucun handler : si un fetch partait, onUnhandledRequest:'error' casserait.
      await expect(pushSnapshotToListmonk(snapshotId)).rejects.toThrow(/not configured/i);
    } finally {
      process.env.LISTMONK_INTERNAL_URL = saved;
    }
  });

  // LMK-INT-PUSH-CREATE-FAIL
  it('LMK-INT-PUSH-CREATE-FAIL : create list 500 -> rejette, aucun listId persisté', async () => {
    const snapshotId = await seedSnapshot(2);
    server.use(
      http.post(`${BASE}/api/lists`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await expect(pushSnapshotToListmonk(snapshotId)).rejects.toThrow();
    const dbt = emailsTestDb();
    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId, 'aucun listId si create échoue').toBeNull();
  });
});
