/**
 * LMK-INT-PUSH-* — Push snapshot vers Listmonk : atomicité, reprise après
 * push partiel, chunking, compte exact. Vraie DB (snapshots + members) +
 * MSW interceptant l'API Listmonk.
 *
 * Cible (écarts audit) : push non atomique / partiel non rejouable / 1 POST
 * par contact. Plusieurs assertions décrivent l'état CIBLE (chunking, reprise)
 * et guident le refactor de pushSnapshotToListmonk.
 *
 * Dépôt cible :
 *   apps/web/src/lib/mail/campaigns/__tests__/snapshot-push-recovery.integration.test.ts
 * Prérequis : DATABASE_URL_TEST migrée ; LISTMONK_* pointant le MSW.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';

import {
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
} from '@/lib/db/schema-emails';
import { pushSnapshotToListmonk } from '@/lib/mail/campaigns/listmonk-sync';

const BASE = 'http://127.0.0.1:9000';
process.env.LISTMONK_INTERNAL_URL = BASE;
process.env.LISTMONK_API_USER = 'apiuser';
process.env.LISTMONK_API_TOKEN = 'tok';

const TEST_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://localhost/femiglow_test';
if (/femiglow(?!_test)/.test(TEST_URL)) {
  throw new Error('SÉCURITÉ : DATABASE_URL_TEST doit pointer une base de test.');
}
const sql = postgres(TEST_URL, { max: 4 });
const dbt = drizzle(sql);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await sql`TRUNCATE email_audience_snapshot_member, email_audience_snapshot RESTART IDENTITY CASCADE`;
});
afterAll(async () => {
  server.close();
  await sql.end();
});

let snapshotId: string;

async function seedSnapshot(memberCount: number): Promise<void> {
  snapshotId = `snap_${Date.now().toString(36)}`;
  await dbt.insert(emailAudienceSnapshot).values({
    id: snapshotId,
    audienceId: `aud_${Date.now().toString(36)}`,
    snapshotKey: `key_${Date.now()}`,
    size: memberCount,
    status: 'done',
    purgeableAfter: new Date(Date.now() + 30 * 86400_000),
    createdAt: new Date(),
  } as never);
  for (let i = 0; i < memberCount; i++) {
    await dbt.insert(emailAudienceSnapshotMember).values({
      snapshotId,
      email: `member${i}@exemple.test`,
    } as never);
  }
}

/** Handlers Listmonk nominaux : create list + per-subscriber + lists attach. */
function nominalListmonk(state: { created: Set<string> }) {
  return [
    http.post(`${BASE}/api/lists`, () => HttpResponse.json({ data: { id: 4242 } })),
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

beforeEach(() => {});

describe('LMK-INT-PUSH — push nominal & idempotence', () => {
  it('LMK-INT-PUSH-OK : 5 membres -> liste créée + 5 poussés + listId persisté', async () => {
    await seedSnapshot(5);
    const state = { created: new Set<string>() };
    server.use(...nominalListmonk(state));

    const res = await pushSnapshotToListmonk(snapshotId);
    expect(res.listmonkListId).toBe(4242);
    expect(res.pushed).toBe(5);

    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId).toBe(4242);
  });

  it('LMK-INT-PUSH-IDEM : snapshot déjà pushé -> no-op, pas de create', async () => {
    await seedSnapshot(3);
    await dbt
      .update(emailAudienceSnapshot)
      .set({ listmonkListId: 999, listmonkListName: 'deja' })
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
    expect(createCalled, 'aucun create si déjà pushé').toBe(false);
  });
});

describe('LMK-INT-PUSH — reprise après push partiel (CIBLE)', () => {
  it('LMK-INT-PUSH-RECOVERY : crash après 3/5 -> re-run complète à 5 sans double', async () => {
    await seedSnapshot(5);
    const state = { created: new Set<string>() };

    // 1er run : échoue au 4e POST subscriber (simule crash réseau).
    let postCount = 0;
    server.use(
      http.post(`${BASE}/api/lists`, () => HttpResponse.json({ data: { id: 4242 } })),
      http.post(`${BASE}/api/subscribers`, async ({ request }) => {
        postCount += 1;
        if (postCount === 4) return HttpResponse.error(); // crash
        const body = (await request.json()) as { email: string };
        state.created.add(body.email);
        return HttpResponse.json({ data: { id: state.created.size } });
      }),
    );
    await pushSnapshotToListmonk(snapshotId).catch(() => {});
    expect(state.created.size, '3 poussés avant le crash').toBeGreaterThanOrEqual(3);

    // listmonkListId doit être persisté pour permettre la reprise.
    const [mid] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(mid!.listmonkListId, 'listId persisté tôt pour la reprise').toBe(4242);

    // 2e run : nominal, idempotent (409 sur déjà-poussés).
    server.resetHandlers();
    server.use(...nominalListmonk(state));
    const res2 = await pushSnapshotToListmonk(snapshotId);
    // CIBLE : tous les membres présents côté liste, sans re-pousser ceux déjà créés.
    expect(state.created.size, 'au total 5 membres uniques côté Listmonk').toBe(5);
    expect(res2.listmonkListId).toBe(4242);
  });
});

describe('LMK-INT-PUSH — robustesse', () => {
  it('LMK-INT-PUSH-409 : subscriber existant 409 -> attaché à la liste', async () => {
    await seedSnapshot(1);
    let attachCalled = false;
    server.use(
      http.post(`${BASE}/api/lists`, () => HttpResponse.json({ data: { id: 4242 } })),
      http.post(`${BASE}/api/subscribers`, () =>
        HttpResponse.json({ message: 'exists' }, { status: 409 }),
      ),
      http.get(`${BASE}/api/subscribers`, () =>
        HttpResponse.json({ data: { results: [{ id: 77 }] } }),
      ),
      http.put(`${BASE}/api/subscribers/lists`, () => {
        attachCalled = true;
        return HttpResponse.json({ data: { count: 1 } });
      }),
    );
    const res = await pushSnapshotToListmonk(snapshotId);
    expect(attachCalled, 'le 409 doit déclencher un attach à la liste').toBe(true);
    expect(res.pushed).toBe(1);
  });

  it('LMK-INT-PUSH-CREATE-FAIL : create list 500 -> pas d’état partiel persisté', async () => {
    await seedSnapshot(2);
    server.use(
      http.post(`${BASE}/api/lists`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await expect(pushSnapshotToListmonk(snapshotId)).rejects.toThrow();
    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId, 'aucun listId si create échoue').toBeNull();
  });
});
