/**
 * LMK-INT-CLEANUP-* / LMK-INT-PURGE-* / LMK-INT-ORDER / LMK-INT-ORPHAN-TAG —
 * Cleanup des listes Listmonk éphémères + purge des snapshots, et l'ORDRE qui
 * évite la fuite de listes (L-LEAK). Vraie DB + MSW Listmonk loopback.
 *
 * Écarts audit couverts :
 *  - L-LEAK : deux opérations (cleanup Listmonk, purge DB) sur le même critère
 *    `purgeable_after < now()`. Si la purge supprime la snapshot AVANT que le
 *    cleanup ait supprimé la liste distante, le listmonkListId est perdu →
 *    fuite de liste. Garantie : cleanup d'abord, puis purge GARDÉE
 *    (ne touche QUE les snapshots `listmonkListId IS NULL`).
 *
 * Oracles durs : la liste distante est DELETE avant que la snapshot disparaisse ;
 * une snapshot encore liée survit à la purge ; le cleanup ne touche QUE les
 * listes éphémères expirées.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { eq, sql } from 'drizzle-orm';

import {
  emailAudience,
  emailAudienceSnapshot,
} from '@/lib/db/schema-emails';
import { makeEmailAudience, makeAudienceSnapshot, resetEmailFactories } from '@/test/factories/emails.factory';
import {
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
  closeTestDb,
} from '@/test/db/emails-db';

const BASE = 'http://127.0.0.1:9913';
const server = setupServer();

/** Crée une snapshot (audience + snapshot) expirée ou non, avec/ sans listId. */
async function seedSnapshot(opts: {
  listmonkListId: number | null;
  expired: boolean;
}): Promise<string> {
  const dbt = emailsTestDb();
  const [aud] = await dbt
    .insert(emailAudience)
    .values(makeEmailAudience())
    .returning({ id: emailAudience.id });
  const purgeableAfter = opts.expired
    ? new Date(Date.now() - 86_400_000) // hier → expiré
    : new Date(Date.now() + 30 * 86_400_000); // dans 30j → vivant
  const [snap] = await dbt
    .insert(emailAudienceSnapshot)
    .values(
      makeAudienceSnapshot({
        audienceId: aud!.id,
        listmonkListId: opts.listmonkListId,
        listmonkListName: opts.listmonkListId != null ? `fg-list-${opts.listmonkListId}` : null,
        purgeableAfter,
      }),
    )
    .returning({ id: emailAudienceSnapshot.id });
  return snap!.id;
}

async function countSnapshots(): Promise<number> {
  const dbt = emailsTestDb();
  const [row] = await dbt
    .select({ n: sql<number>`count(*)::int` })
    .from(emailAudienceSnapshot);
  return row!.n;
}

describeEmailsDb('Module 10 — cleanup Listmonk + purge ordonnés (vraie DB + MSW)', () => {
  let cleanupExpiredListmonkLists: typeof import('../listmonk-sync').cleanupExpiredListmonkLists;
  let cleanupOrphanEphemeralLists: typeof import('../listmonk-sync').cleanupOrphanEphemeralLists;
  let purgeExpiredSnapshots: typeof import('@/lib/mail/audiences/purge').purgeExpiredSnapshots;

  beforeAll(async () => {
    process.env.LISTMONK_INTERNAL_URL = BASE;
    process.env.LISTMONK_API_USER = 'apiuser';
    process.env.LISTMONK_API_TOKEN = 'tok';
    server.listen({ onUnhandledRequest: 'error' });
    ({ cleanupExpiredListmonkLists, cleanupOrphanEphemeralLists } = await import('../listmonk-sync'));
    ({ purgeExpiredSnapshots } = await import('@/lib/mail/audiences/purge'));
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

  // LMK-INT-CLEANUP-OK
  it('LMK-INT-CLEANUP-OK : liste éphémère expirée -> DELETE Listmonk + listmonkListId NULL', async () => {
    const snapshotId = await seedSnapshot({ listmonkListId: 4242, expired: true });
    let deletedListId = '';
    server.use(
      http.delete(`${BASE}/api/lists/:id`, ({ params }) => {
        deletedListId = String(params.id);
        return HttpResponse.json({ data: true });
      }),
    );
    const res = await cleanupExpiredListmonkLists();
    expect(res.purged).toBe(1);
    expect(deletedListId, 'la bonne liste distante est supprimée').toBe('4242');

    const dbt = emailsTestDb();
    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId, 'listId NULL après cleanup').toBeNull();
    expect(snap, 'la snapshot SURVIT au cleanup (purge séparée)').toBeDefined();
  });

  // LMK-INT-CLEANUP-404
  it('LMK-INT-CLEANUP-404 : liste déjà supprimée (404) -> traité comme succès idempotent', async () => {
    const snapshotId = await seedSnapshot({ listmonkListId: 4242, expired: true });
    server.use(
      http.delete(`${BASE}/api/lists/:id`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    );
    const res = await cleanupExpiredListmonkLists();
    expect(res.purged, '404 = déjà supprimée = succès').toBe(1);
    const dbt = emailsTestDb();
    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId).toBeNull();
  });

  // LMK-INT-CLEANUP-FAIL
  it('LMK-INT-CLEANUP-FAIL : DELETE 500 -> listmonkListId CONSERVÉ pour retry', async () => {
    const snapshotId = await seedSnapshot({ listmonkListId: 4242, expired: true });
    server.use(
      http.delete(`${BASE}/api/lists/:id`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    const res = await cleanupExpiredListmonkLists();
    expect(res.purged, 'rien purgé sur échec').toBe(0);
    const dbt = emailsTestDb();
    const [snap] = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(snap!.listmonkListId, 'listId conservé → retry au prochain cron').toBe(4242);
  });

  // LMK-INT-CLEANUP : ne touche QUE les listes EXPIRÉES (filet anti sur-suppression)
  it('cleanup : une liste éphémère NON expirée n’est PAS supprimée', async () => {
    await seedSnapshot({ listmonkListId: 5000, expired: false });
    // Aucun handler DELETE : si le code tentait un DELETE, onUnhandledRequest:'error'
    // ferait échouer le test. C'est l'oracle « ne touche que les orphelines/expirées ».
    const res = await cleanupExpiredListmonkLists();
    expect(res.purged, 'liste vivante intouchée').toBe(0);
  });

  // LMK-INT-ORDER
  it('LMK-INT-ORDER : cleanup AVANT purge -> la liste distante est supprimée avant la snapshot', async () => {
    const snapshotId = await seedSnapshot({ listmonkListId: 4242, expired: true });
    const events: string[] = [];
    server.use(
      http.delete(`${BASE}/api/lists/:id`, () => {
        events.push('listmonk-delete');
        return HttpResponse.json({ data: true });
      }),
    );

    // Orchestration correcte : cleanup PUIS purge.
    await cleanupExpiredListmonkLists();
    events.push('db-purge');
    const purge = await purgeExpiredSnapshots();

    // La liste distante a été DELETE avant la purge DB → aucune fuite.
    expect(events).toEqual(['listmonk-delete', 'db-purge']);
    expect(purge.purged, 'la snapshot (maintenant listId NULL) est purgée').toBe(1);
    expect(await countSnapshots(), 'plus aucune snapshot expirée').toBe(0);

    const dbt = emailsTestDb();
    const rows = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, snapshotId));
    expect(rows.length).toBe(0);
  });

  // LMK-INT-PURGE-GUARD
  it('LMK-INT-PURGE-GUARD : la purge ne supprime QUE les snapshots listmonkListId NULL', async () => {
    // Snapshot expirée MAIS encore liée à une liste Listmonk (cleanup pas passé).
    const stillLinked = await seedSnapshot({ listmonkListId: 7777, expired: true });
    // Snapshot expirée et déjà déliée (cleanup passé) → purgeable.
    const unlinked = await seedSnapshot({ listmonkListId: null, expired: true });

    const purge = await purgeExpiredSnapshots();
    expect(purge.purged, 'seule la snapshot déliée est purgée').toBe(1);

    const dbt = emailsTestDb();
    const linkedRows = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, stillLinked));
    expect(linkedRows.length, 'la snapshot encore liée SURVIT (anti-fuite)').toBe(1);
    const unlinkedRows = await dbt
      .select()
      .from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, unlinked));
    expect(unlinkedRows.length, 'la snapshot déliée a été purgée').toBe(0);
  });

  // LMK-INT-PURGE-OK
  it('LMK-INT-PURGE-OK : snapshot expirée sans liste -> purgée (count correct)', async () => {
    await seedSnapshot({ listmonkListId: null, expired: true });
    await seedSnapshot({ listmonkListId: null, expired: true });
    await seedSnapshot({ listmonkListId: null, expired: false }); // vivante
    const purge = await purgeExpiredSnapshots();
    expect(purge.purged).toBe(2);
    expect(await countSnapshots(), 'seule la vivante reste').toBe(1);
  });

  // LMK-INT-PURGE-IDEM
  it('LMK-INT-PURGE-IDEM : double purge -> 2e run purge 0', async () => {
    await seedSnapshot({ listmonkListId: null, expired: true });
    const first = await purgeExpiredSnapshots();
    expect(first.purged).toBe(1);
    const second = await purgeExpiredSnapshots();
    expect(second.purged, 'idempotent : plus rien à purger').toBe(0);
  });

  // LMK-INT-ORPHAN-TAG
  it('LMK-INT-ORPHAN-TAG : liste éphémère sans snapshot FemiGlow -> supprimée, les référencées épargnées', async () => {
    // Une snapshot référence la liste 100 (toujours vivante côté FemiGlow).
    await seedSnapshot({ listmonkListId: 100, expired: false });

    const deletedIds: string[] = [];
    server.use(
      // Inventaire Listmonk : 100 (référencée), 200 (orpheline ephemeral),
      // 300 (NON ephemeral → hors périmètre, jamais touchée).
      http.get(`${BASE}/api/lists`, () =>
        HttpResponse.json({
          data: {
            results: [
              { id: 100, name: 'fg-snap-vivante', tags: ['ephemeral'] },
              { id: 200, name: 'fg-snap-orpheline', tags: ['ephemeral'] },
              { id: 300, name: 'newsletter-permanente', tags: ['permanent'] },
            ],
          },
        }),
      ),
      http.delete(`${BASE}/api/lists/:id`, ({ params }) => {
        deletedIds.push(String(params.id));
        return HttpResponse.json({ data: true });
      }),
    );

    const res = await cleanupOrphanEphemeralLists();
    expect(res.deleted, 'une seule orpheline supprimée').toBe(1);
    // ORACLE DUR : seule la 200 (ephemeral + sans snapshot) est supprimée.
    expect(deletedIds, 'ne supprime QUE l’orpheline').toEqual(['200']);
    // La 100 (référencée) et la 300 (non-ephemeral) sont épargnées.
    expect(deletedIds).not.toContain('100');
    expect(deletedIds).not.toContain('300');
  });

  // LMK-INT-ORPHAN-TAG : aucune orpheline -> aucun DELETE
  it('orphan sweep : aucune liste orpheline -> aucun DELETE émis', async () => {
    await seedSnapshot({ listmonkListId: 100, expired: false });
    server.use(
      http.get(`${BASE}/api/lists`, () =>
        HttpResponse.json({
          data: { results: [{ id: 100, name: 'fg', tags: ['ephemeral'] }] },
        }),
      ),
      // Pas de handler DELETE : un DELETE non prévu casserait (onUnhandledRequest).
    );
    const res = await cleanupOrphanEphemeralLists();
    expect(res.deleted).toBe(0);
    expect(res.orphans).toBe(0);
  });
});
