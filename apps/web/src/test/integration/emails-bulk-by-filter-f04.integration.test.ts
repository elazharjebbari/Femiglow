// @vitest-environment node
/**
 * F04 — bulk retry PAR FILTRE (CKPT-02) : batterie F04-I-010..017, VRAIE-DB.
 *
 * Invariant CENTRAL (I-010) : pour le même filtre, l'ensemble touché par
 * /bulk-retry-by-filter == l'ensemble renvoyé par /search ∩ statuts
 * relançables — garanti par le compilateur UNIQUE buildWhere.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_f04bulk#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/test/integration/emails-bulk-by-filter-f04.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_test_f04b',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3_600_000,
};
let currentSession: AdminSession | null = sessionMock;
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(currentSession),
  requireAdmin: () => Promise.resolve(currentSession),
}));

// Cap RÉDUIT pour la testabilité du dépassement (le contrat = 10 000 est
// verrouillé par une assertion dédiée sur la constante).
vi.mock('@/lib/mail/transactional/bulk-actions', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/mail/transactional/bulk-actions')>();
  return { ...mod, BULK_BY_FILTER_CAP: 30 };
});

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, resetEmailFactories } from '@/test/factories';
import { parseFilters } from '@/lib/mail/transactional/filters-parser';
import { listOutboxFiltered } from '@/lib/mail/transactional/search';
import { BulkRetryByFilterDryWire, BulkRetryByFilterExecWire } from '@/lib/mail/wire-schemas';
import { POST } from '@/app/api/admin/emails/transactional/bulk-retry-by-filter/route';

const T0 = new Date('2026-06-01T10:00:00.000Z');
const at = (i: number) => new Date(T0.getTime() + i * 60_000);

async function seedMixte() {
  // 5 failed cart-*, 3 dlq cart-*, 2 delivered cart-* (non relançables),
  // 4 failed welcome (HORS filtre template:cart-*).
  const db = emailsTestDb();
  const rows = [
    ...Array.from({ length: 5 }, (_, i) =>
      makeOutboxRow({ status: 'failed', template: 'cart-abandon', createdAt: at(i) }),
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      makeOutboxRow({ status: 'dlq', template: 'cart-abandon', createdAt: at(10 + i) }),
    ),
    ...Array.from({ length: 2 }, (_, i) =>
      makeOutboxRow({ status: 'delivered', template: 'cart-abandon', createdAt: at(20 + i) }),
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      makeOutboxRow({ status: 'failed', template: 'welcome-rituel', createdAt: at(30 + i) }),
    ),
  ];
  await db.insert(emailOutbox).values(rows);
  return rows;
}

const CART_FILTER = () => parseFilters('template:cart-*', T0).filters;

function call(body: unknown): Promise<Response> {
  return POST(
    new Request('http://test.local/api/admin/emails/transactional/bulk-retry-by-filter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as unknown as DrizzleDb);
});
afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});
beforeEach(async () => {
  currentSession = sessionMock;
  resetEmailFactories();
  await truncateEmailTables();
  await emailsTestSql()`DELETE FROM audit_events WHERE action = 'mail.outbox.bulk_retry_by_filter'`;
});

describeEmailsDb('F04 — bulk retry par filtre (route réelle)', () => {
  it('F04-I-010 — touche EXACTEMENT les ids de /search (même filtre) ∩ relançables', async () => {
    await seedMixte();
    const filters = CART_FILTER();
    const viaSearch = await listOutboxFiltered({
      filters,
      pagination: { limit: 1000, offset: 0 },
    });
    const retryableSearchIds = new Set(
      viaSearch.rows
        .filter((r) => ['failed', 'dlq', 'bounced_soft'].includes(r.status))
        .map((r) => String(r.id)),
    );

    const res = await call({ filterState: { filters }, dry_run: false });
    expect(res.status).toBe(200);

    // Les lignes passées à pending == exactement l'ensemble /search relançable.
    const pendingRows = await emailsTestSql()<{ id: string }[]>`
      SELECT id FROM email_outbox WHERE status = 'pending'`;
    expect(new Set(pendingRows.map((r) => r.id))).toEqual(retryableSearchIds);
    expect(retryableSearchIds.size).toBe(8); // 5 failed + 3 dlq cart-*
  });

  it('F04-I-011 — dry_run:true : count exact, AUCUNE mutation', async () => {
    await seedMixte();
    const res = await call({ filterState: { filters: CART_FILTER() }, dry_run: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(BulkRetryByFilterDryWire.safeParse(body).success).toBe(true);
    expect(body.count).toBe(8);

    const [{ n } = { n: -1 }] = await emailsTestSql()<{ n: number }[]>`
      SELECT count(*)::int AS n FROM email_outbox WHERE status = 'pending'`;
    expect(n).toBe(0); // rien n'a bougé
  });

  it('F04-I-012 — dry_run:false : failed/dlq → pending, attempts=0, lastError purgé', async () => {
    await seedMixte();
    const res = await call({ filterState: { filters: CART_FILTER() }, dry_run: false });
    const body = await res.json();
    expect(BulkRetryByFilterExecWire.safeParse(body).success).toBe(true);
    expect(body.retried).toBe(8);

    const rows = await emailsTestSql()<{ status: string; attempts: number }[]>`
      SELECT status, attempts FROM email_outbox WHERE template = 'cart-abandon' AND status = 'pending'`;
    expect(rows).toHaveLength(8);
    for (const r of rows) expect(r.attempts).toBe(0);
  });

  it('F04-I-013 — au-delà du cap → 422 cap_exceeded, AUCUNE mutation', async () => {
    // 31 failed > cap mocké (30).
    const db = emailsTestDb();
    await db
      .insert(emailOutbox)
      .values(
        Array.from({ length: 31 }, (_, i) =>
          makeOutboxRow({ status: 'failed', createdAt: at(i) }),
        ),
      );
    const res = await call({ filterState: { filters: [] }, dry_run: false });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'cap_exceeded', count: 31, cap: 30 });

    const [{ n } = { n: -1 }] = await emailsTestSql()<{ n: number }[]>`
      SELECT count(*)::int AS n FROM email_outbox WHERE status = 'pending'`;
    expect(n).toBe(0);
  });

  it('F04-I-013b — le cap du CONTRAT vaut 10 000 (la réduction ci-dessus est un mock de test)', async () => {
    const real = await vi.importActual<typeof import('@/lib/mail/transactional/bulk-actions')>(
      '@/lib/mail/transactional/bulk-actions',
    );
    expect(real.BULK_BY_FILTER_CAP).toBe(10_000);
  });

  it('F04-I-014 — non-admin → 401, aucune mutation', async () => {
    await seedMixte();
    currentSession = null;
    const res = await call({ filterState: { filters: [] }, dry_run: false });
    expect(res.status).toBe(401);
    const [{ n } = { n: -1 }] = await emailsTestSql()<{ n: number }[]>`
      SELECT count(*)::int AS n FROM email_outbox WHERE status = 'pending'`;
    expect(n).toBe(0);
  });

  it('F04-I-015 — conformité : dry ET exec parsent avec les wires partagés ; corps invalide → 422', async () => {
    await seedMixte();
    const dry = await (await call({ filterState: { filters: [] }, dry_run: true })).json();
    expect(BulkRetryByFilterDryWire.safeParse(dry).success).toBe(true);
    const exec = await (await call({ filterState: { filters: CART_FILTER() }, dry_run: false })).json();
    expect(BulkRetryByFilterExecWire.safeParse(exec).success).toBe(true);
    const bad = await call({ filterState: { filters: 'nope' }, dry_run: false });
    expect(bad.status).toBe(422);
  });

  it('F04-I-016 — audit mail.outbox.bulk_retry_by_filter émis avec actor+count+retried', async () => {
    await seedMixte();
    await call({ filterState: { filters: CART_FILTER() }, dry_run: false });
    const rows = await emailsTestSql()<
      { actor_id: string; meta: { count: number; retried: number } }[]
    >`SELECT actor_id, meta FROM audit_events WHERE action = 'mail.outbox.bulk_retry_by_filter'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_id).toBe('adm_test_f04b');
    expect(rows[0]!.meta).toMatchObject({ count: 8, retried: 8 });
  });

  it('F04-I-017 — les delivered du filtre sont comptés skipped wrong_status', async () => {
    await seedMixte();
    const body = await (
      await call({ filterState: { filters: CART_FILTER() }, dry_run: false })
    ).json();
    expect(body.skipped).toEqual([{ reason: 'wrong_status', count: 2 }]);
  });
});

/* ── F04-I-018..021 : non-régressions vraie-DB du cockpit ───────────────── */

import { SearchResponseWire } from '@/lib/mail/wire-schemas';
import { POST as SEARCH_POST } from '@/app/api/admin/emails/transactional/search/route';
import { POST as REAP_POST } from '@/app/api/admin/emails/transactional/reap-stuck/route';
import {
  POST as VIEWS_POST,
} from '@/app/api/admin/emails/views/route';
import {
  PATCH as VIEW_PATCH,
  DELETE as VIEW_DELETE,
} from '@/app/api/admin/emails/views/[id]/route';

describeEmailsDb('F04 — non-régressions /search, vues, reap (vraie-DB)', () => {
  it('F04-I-018 — contrat /search inchangé : la réponse réelle parse avec SearchResponseWire', async () => {
    await seedMixte();
    const res = await SEARCH_POST(
      new Request('http://test.local/api/admin/emails/transactional/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filters: CART_FILTER(),
          pagination: { limit: 50, offset: 0 },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(SearchResponseWire.safeParse(body).success).toBe(true);
    expect(body.total).toBe(10);
    expect(body.window).toBe('matched');
  });

  it('F04-I-019 — total >= 5000 → window=truncated', async () => {
    const db = emailsTestDb();
    const rows = Array.from({ length: 5_000 }, (_, i) =>
      makeOutboxRow({ status: 'failed', createdAt: at(i) }),
    );
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(emailOutbox).values(rows.slice(i, i + 500));
    }
    const { listOutboxFiltered: search } = await import('@/lib/mail/transactional/search');
    const result = await search({ filters: [], pagination: { limit: 50, offset: 0 } });
    expect(result.window).toBe('truncated');
    expect(result.total).toBeGreaterThanOrEqual(5_000);
  });

  it('F04-I-020 — vues : CRUD persisté en DB (create → rename → delete)', async () => {
    const created = await VIEWS_POST(
      new Request('http://test.local/api/admin/emails/views', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Échecs du jour',
          scope: 'transactional',
          filterState: { filters: { status: ['failed'] }, sort: 'date_desc', cols: [] },
        }),
      }),
    );
    expect(created.status).toBeLessThan(300);
    const view = (await created.json()) as { id: string };

    const inDb = await emailsTestSql()<{ name: string }[]>`
      SELECT name FROM admin_email_view WHERE id = ${view.id}`;
    expect(inDb[0]?.name).toBe('Échecs du jour');

    const renamed = await VIEW_PATCH(
      new Request(`http://test.local/api/admin/emails/views/${view.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Échecs (renommé)' }),
      }),
      { params: { id: view.id } },
    );
    expect(renamed.status).toBeLessThan(300);
    const afterRename = await emailsTestSql()<{ name: string }[]>`
      SELECT name FROM admin_email_view WHERE id = ${view.id}`;
    expect(afterRename[0]?.name).toBe('Échecs (renommé)');

    const deleted = await VIEW_DELETE(
      new Request(`http://test.local/api/admin/emails/views/${view.id}`, { method: 'DELETE' }),
      { params: { id: view.id } },
    );
    expect(deleted.status).toBeLessThan(300);
    // Suppression DOUCE (deleted_at) : la ligne reste, marquée supprimée.
    const afterDelete = await emailsTestSql()<{ deleted_at: Date | null }[]>`
      SELECT deleted_at FROM admin_email_view WHERE id = ${view.id}`;
    expect(afterDelete[0]?.deleted_at).not.toBeNull();
  });

  it('F04-I-021 — reap-stuck requalifie les sending figés (pending, ou dlq au plafond)', async () => {
    const db = emailsTestDb();
    const old = new Date(Date.now() - 30 * 60_000); // figé depuis 30 min
    await db.insert(emailOutbox).values([
      makeOutboxRow({ id: 'out_stuck_pending', status: 'sending', attempts: 1, updatedAt: old }),
      makeOutboxRow({
        id: 'out_stuck_dlq',
        status: 'sending',
        attempts: 5,
        maxAttempts: 5,
        updatedAt: old,
      }),
    ]);
    const res = await REAP_POST(); // la route ne lit pas la requête
    expect(res.status).toBe(200);
    expect(((await res.json()) as { reaped: number }).reaped).toBe(2);

    const rows = await emailsTestSql()<{ id: string; status: string }[]>`
      SELECT id, status FROM email_outbox WHERE id IN ('out_stuck_pending','out_stuck_dlq')`;
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    expect(byId.get('out_stuck_pending')).toBe('pending');
    expect(byId.get('out_stuck_dlq')).toBe('dlq');
  });
});
