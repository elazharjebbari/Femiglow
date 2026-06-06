// @vitest-environment node
/**
 * F02 — route GET /api/admin/emails/nav-counters — VRAIE-DB
 * (batterie F02-I-001..003, 006, 007 + verrou statique TTL).
 *
 * Skip honnête sans DATABASE_URL femiglow_test (`describeEmailsDb`).
 * Sérialisé (--no-file-parallelism). Lancement local :
 *   DBURL=postgres://.../femiglow_test_f02nav
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/app/api/admin/emails/nav-counters/__tests__/route.db.test.ts
 *
 * NOTE I-004/005 (cache TTL 30 s) : `unstable_cache` n'est pas fidèlement
 * exécutable hors runtime Next (pas d'incremental cache en vitest). Le TTL
 * est verrouillé STATIQUEMENT ici (revalidate: 30 présent dans la source) ;
 * le comportement dynamique relève du spec E2E SM-F02-02.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';

// Auth contrôlable par test : admin par défaut, null pour le cas 401.
const getAdminSession = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: (...a: unknown[]) => getAdminSession(...a),
  requireAdmin: vi.fn(),
}));

import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
  closeTestDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, makeEmailAutomation, makeAutomationRun, resetEmailFactories } from '@/test/factories/emails.factory';
import { emailOutbox, emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { navCountersSchema } from '@/lib/mail/wire-schemas';
import { GET } from '../route';

describeEmailsDb('nav-counters route (vraie DB)', () => {
  beforeAll(() => {
    __setTestDb(emailsTestDb() as never);
  });

  beforeEach(async () => {
    await truncateEmailTables();
    resetEmailFactories();
    vi.clearAllMocks();
    getAdminSession.mockResolvedValue({ email: 'admin@test', id: 'admin-1' });
  });

  afterAll(async () => {
    __resetTestDb();
    await closeTestDb();
  });

  it('F02-I-001 — non authentifié → 401 JSON (pas de redirect HTML)', async () => {
    getAdminSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('F02-I-002 — authentifié → 200 conforme navCountersSchema (conformité contrat)', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const parsed = navCountersSchema.safeParse(await res.json());
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  });

  it('F02-I-003 — les compteurs reflètent l’état DB réel (dlq=2, errored=1)', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values([
      makeOutboxRow({ status: 'dlq' }),
      makeOutboxRow({ status: 'dlq' }),
      makeOutboxRow({ status: 'sent' }),
    ]);
    const [auto] = await db
      .insert(emailAutomation)
      .values(makeEmailAutomation())
      .returning({ id: emailAutomation.id });
    await db.insert(emailAutomationRun).values([
      makeAutomationRun({ automationId: auto!.id, status: 'errored' }),
      makeAutomationRun({ automationId: auto!.id, status: 'completed' }),
    ]);

    const body = (await (await GET()).json()) as { dlq: number; automationErrors: number };
    expect(body.dlq).toBe(2);
    expect(body.automationErrors).toBe(1);
  });

  it('F02-I-006 — listmonkSyncFailed=0 tant que F10 n’a pas livré ses colonnes', async () => {
    const body = (await (await GET()).json()) as { listmonkSyncFailed: number };
    expect(body.listmonkSyncFailed).toBe(0);
  });

  it('F02-I-007 — DB indisponible → 500 franc (jamais un 200 trompeur)', async () => {
    // Vraie panne simulée : Postgres injoignable (port mort), timeout court.
    const deadSql = postgres('postgres://nobody@127.0.0.1:9/absente', {
      connect_timeout: 1,
      max: 1,
    });
    __setTestDb(drizzlePg(deadSql) as never);
    try {
      const res = await GET();
      expect(res.status).toBe(500);
      expect(((await res.json()) as { error: string }).error).toBeTruthy();
    } finally {
      await deadSql.end({ timeout: 1 }).catch(() => {});
      __setTestDb(emailsTestDb() as never);
    }
  });

  it('F02-I-004/005 (verrou statique) — revalidate: 30 EXPLICITE dans la route', () => {
    // Le gotcha unstable_cache-sans-TTL est interdit en revue ; ce verrou le
    // rend non-régressable. Le comportement dynamique : E2E SM-F02-02.
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/admin/emails/nav-counters/route.ts'),
      'utf8',
    );
    expect(src).toMatch(/revalidate:\s*30/);
    expect(src).toMatch(/tags:\s*\['emails-nav-counters'\]/);
  });
});
