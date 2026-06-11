// @vitest-environment node
/**
 * HLT-HB — le cron de drain écrit un heartbeat (F-002, marqueur dans la ROUTE).
 *
 * `pickAndProcessBatch` est GELÉ : on ne le câble PAS au heartbeat. C'est la
 * ROUTE `POST /api/cron/email-outbox` qui pose le marqueur de tick à chaque
 * exécution réussie — même quand la file est vide (picked=0). Le health check
 * lit ce marqueur pour distinguer « cron vivant » de « cron mort » (cf.
 * emails-health-f002.integration.test.ts, DSH-UNIT-045).
 *
 * On mocke `pickAndProcessBatch` (drain réel hors périmètre) et on injecte la
 * DB de test dans le client applicatif que la route consulte via `db()`.
 *
 * Suite VRAIE-DB → DATABASE_URL/DATABASE_URL_TEST sur femiglow_test_health :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_health#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/test/integration/emails-cron-heartbeat.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

// Le module env parse process.env À L'IMPORT → on pose le secret AVANT les
// imports via vi.hoisted (la factory de vi.mock est hoistée tout en haut).
const { CRON_SECRET } = vi.hoisted(() => ({
  CRON_SECRET: process.env.CRON_SECRET ?? 'c'.repeat(32),
}));

// env applicatif : la route lit `env.CRON_SECRET` → on l'aligne sur le secret de
// test (vitest.setup pose process.env.CRON_SECRET = 'c'*32).
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET } }));

// Drain réel GELÉ → mocké. On contrôle son résultat pour vérifier la propagation
// des compteurs dans le payload du heartbeat.
vi.mock('@/lib/mail/outbox', () => ({
  pickAndProcessBatch: vi.fn(),
}));

import { emailSettings } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { resetEmailFactories } from '@/test/factories';
import { pickAndProcessBatch } from '@/lib/mail/outbox';
import { POST } from '@/app/api/cron/email-outbox/route';
import {
  OUTBOX_CRON_NAME,
  cronHeartbeatKey,
  readCronHeartbeat,
  type CronTickPayload,
} from '@/lib/admin/emails/cron-heartbeat';
import { eq } from 'drizzle-orm';

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cron/email-outbox', { method: 'POST', headers });
}
const authedReq = () => makeReq({ authorization: `Bearer ${CRON_SECRET}` });

const EMPTY_BATCH = { picked: 0, succeeded: 0, failed: 0, dlq: 0, reaped: 0, durationMs: 5 };

async function heartbeatRowCount(db: any): Promise<number> {
  const rows = await db
    .select({ key: emailSettings.key })
    .from(emailSettings)
    .where(eq(emailSettings.key, cronHeartbeatKey(OUTBOX_CRON_NAME)));
  return rows.length;
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as unknown as DrizzleDb);
});

beforeEach(async () => {
  await truncateEmailTables();
  resetEmailFactories();
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('POST /api/cron/email-outbox — heartbeat (HLT-HB)', () => {
  // HLT-HB-001 — un tick réussi sur file VIDE écrit quand même un heartbeat.
  it('écrit un heartbeat même sur file vide (picked=0)', async () => {
    const db = emailsTestDb();
    vi.mocked(pickAndProcessBatch).mockResolvedValue(EMPTY_BATCH);

    const before = new Date();
    const res = await POST(authedReq());
    expect(res.status).toBe(200);

    const tick = await readCronHeartbeat(db, OUTBOX_CRON_NAME);
    expect(tick.present).toBe(true);
    expect(tick.lastTickAt).not.toBeNull();
    // Le tick est postérieur (à la seconde près) au début de la requête.
    expect(tick.lastTickAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  // HLT-HB-002 — le payload du heartbeat reflète les compteurs du drain.
  it('persiste les compteurs du batch dans le payload du heartbeat', async () => {
    const db = emailsTestDb();
    vi.mocked(pickAndProcessBatch).mockResolvedValue({
      picked: 7,
      succeeded: 6,
      failed: 1,
      dlq: 0,
      reaped: 0,
      durationMs: 42,
    });

    await POST(authedReq());

    const [row] = await db
      .select({ json: emailSettings.json })
      .from(emailSettings)
      .where(eq(emailSettings.key, cronHeartbeatKey(OUTBOX_CRON_NAME)));
    const json = row!.json as CronTickPayload;
    expect(json.processed).toBe(7);
    expect(json.succeeded).toBe(6);
    expect(json.failed).toBe(1);
  });

  // HLT-HB-003 — IDEMPOTENCE : deux ticks successifs ⇒ UNE seule ligne (upsert),
  // pas d'accumulation, le dernier tick gagne.
  it('double tick → une seule ligne heartbeat (idempotent / upsert)', async () => {
    const db = emailsTestDb();
    vi.mocked(pickAndProcessBatch).mockResolvedValue(EMPTY_BATCH);

    await POST(authedReq());
    const firstTick = (await readCronHeartbeat(db, OUTBOX_CRON_NAME)).lastTickAt!;
    expect(await heartbeatRowCount(db)).toBe(1);

    vi.mocked(pickAndProcessBatch).mockResolvedValue({ ...EMPTY_BATCH, picked: 2, succeeded: 2 });
    await POST(authedReq());

    expect(await heartbeatRowCount(db)).toBe(1); // toujours une seule ligne
    const secondTick = (await readCronHeartbeat(db, OUTBOX_CRON_NAME)).lastTickAt!;
    expect(secondTick.getTime()).toBeGreaterThanOrEqual(firstTick.getTime());
  });

  // HLT-HB-004 — auth : sans bearer, AUCUN heartbeat n'est écrit (401 avant drain).
  it('401 sans bearer → aucun heartbeat écrit', async () => {
    const db = emailsTestDb();
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(pickAndProcessBatch).not.toHaveBeenCalled();
    expect(await heartbeatRowCount(db)).toBe(0);
  });

  // HLT-HB-005 — le drain qui PLANTE ne pose PAS de heartbeat (le cron n'a pas
  // réussi son tick → on ne ment pas sur sa vivacité).
  it('drain en échec (500) → pas de heartbeat (tick non réussi)', async () => {
    const db = emailsTestDb();
    vi.mocked(pickAndProcessBatch).mockRejectedValue(new Error('boom'));
    const res = await POST(authedReq());
    expect(res.status).toBe(500);
    expect(await heartbeatRowCount(db)).toBe(0);
  });
});
