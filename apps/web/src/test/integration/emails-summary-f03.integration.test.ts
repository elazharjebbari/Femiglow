// @vitest-environment node
/**
 * F03 — contrat summary étendu (étape 1 du plan F03-dashboard) : batterie
 * F03-I-001..011, suite VRAIE-DB.
 *
 * Oracles :
 *  - bornes SQL des fenêtres 24h/7d/30d (lignes posées à cheval, gte inclusif) ;
 *  - conformité Zod de la réponse réelle (SummaryResponseWire, gate G9) ;
 *  - enum window : 30d accepté, invalide → 422, 1h non régressé (cockpit) ;
 *  - webhookLastSuccessAt = max(ts) des events delivered (null si aucun) ;
 *  - auth : non-admin → 401 JSON (pattern F02 nav-counters) ;
 *  - comparaison 30d vs fenêtre 30j précédente.
 *
 * Lancement (DB dédiée — deux suites vraie-DB ne partagent jamais une base) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_f03sum#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/test/integration/emails-summary-f03.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

// Auth shuntée par défaut (pas de cookie Next en contexte node). F03-I-010
// bascule le mock sur null pour l'oracle 401.
const sessionMock: AdminSession = {
  adminId: 'adm_test_f03',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3_600_000,
};
let currentSession: AdminSession | null = sessionMock;
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(currentSession),
  requireAdmin: () => Promise.resolve(currentSession),
}));

import { emailOutbox, emailEvent } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, resetEmailFactories } from '@/test/factories';
import { summarizeOutbox } from '@/lib/mail/transactional/summary';
import { SummaryResponseWire } from '@/lib/mail/wire-schemas';
import { GET } from '@/app/api/admin/emails/transactional/summary/route';

/** Référence stable : les bornes se testent par rapport à CE now. */
const NOW = new Date('2026-06-10T12:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function at(msBeforeNow: number): Date {
  return new Date(NOW.getTime() - msBeforeNow);
}

async function seedDelivered(createdAt: Date, n = 1): Promise<void> {
  const db = emailsTestDb();
  for (let i = 0; i < n; i += 1) {
    await db.insert(emailOutbox).values(makeOutboxRow({ status: 'delivered', createdAt }));
  }
}

async function callRoute(qs: string): Promise<Response> {
  return GET(new Request(`http://test.local/api/admin/emails/transactional/summary${qs}`));
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
});

describeEmailsDb('F03 — fenêtres summary (bornes SQL)', () => {
  it('F03-I-001 — window=24h ne compte que [now-24h, now]', async () => {
    await seedDelivered(at(23 * HOUR)); // dans la fenêtre
    await seedDelivered(at(25 * HOUR)); // hors fenêtre
    const res = await summarizeOutbox('24h', NOW);
    expect(res.delivered).toBe(1);
    expect(res.window).toBe('24h');
  });

  it('F03-I-002 — window=7d ne compte que [now-7j, now]', async () => {
    await seedDelivered(at(6 * DAY));
    await seedDelivered(at(8 * DAY)); // hors fenêtre
    const res = await summarizeOutbox('7d', NOW);
    expect(res.delivered).toBe(1);
  });

  it('F03-I-003 — window=30d ne compte que [now-30j, now]', async () => {
    await seedDelivered(at(29 * DAY));
    await seedDelivered(at(31 * DAY)); // hors fenêtre
    const res = await summarizeOutbox('30d', NOW);
    expect(res.delivered).toBe(1);
  });

  it('F03-I-004 — borne inférieure : created_at=start INCLUS, start-1ms EXCLU', async () => {
    const start = at(24 * HOUR);
    await seedDelivered(start); // pile sur la borne → gte inclusif
    await seedDelivered(new Date(start.getTime() - 1)); // 1 ms avant → exclu
    const res = await summarizeOutbox('24h', NOW);
    expect(res.delivered).toBe(1);
  });
});

describeEmailsDb('F03 — contrat de la route summary', () => {
  it('F03-I-005 — la réponse réelle parse avec SummaryResponseWire (G9)', async () => {
    await seedDelivered(at(HOUR), 3);
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(makeOutboxRow({ status: 'failed', createdAt: at(HOUR) }));
    await db
      .insert(emailEvent)
      .values({ outboxId: null, type: 'delivered', ts: at(2 * HOUR), source: 'stalwart' });

    const res = await callRoute('?window=7d');
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = SummaryResponseWire.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(body.sent).toBe(3);
    expect(body.comparison).toBeDefined();
  });

  it('F03-I-006 — ?window=30d → 200 (enum étendu)', async () => {
    const res = await callRoute('?window=30d');
    expect(res.status).toBe(200);
    expect((await res.json()).window).toBe('30d');
  });

  it('F03-I-007 — ?window=bogus → 422 avec détail', async () => {
    const res = await callRoute('?window=bogus');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/validation/i);
    expect(body.issues).toBeDefined();
  });

  it('F03-I-008 — ?window=1h garde son contrat cockpit (200, comparison ABSENT)', async () => {
    await seedDelivered(at(30 * 60_000));
    const res = await callRoute('?window=1h');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.window).toBe('1h');
    expect(body.comparison).toBeUndefined();
    expect(SummaryResponseWire.safeParse(body).success).toBe(true);
  });

  it('F03-I-010 — non-admin → 401 JSON (pas une redirection HTML)', async () => {
    currentSession = null;
    const res = await callRoute('?window=7d');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBeDefined();
  });
});

describeEmailsDb('F03 — webhookLastSuccessAt & comparaison 30d', () => {
  it('F03-I-009 — webhookLastSuccessAt = max(ts) des events delivered ; null si aucun', async () => {
    const db = emailsTestDb();
    const older = at(5 * DAY);
    const newest = at(2 * HOUR);
    await db.insert(emailEvent).values([
      { outboxId: null, type: 'delivered', ts: older, source: 'stalwart' },
      { outboxId: null, type: 'delivered', ts: newest, source: 'stalwart' },
      // Un event non-delivered plus récent ne doit PAS gagner.
      { outboxId: null, type: 'bounced_soft', ts: at(HOUR), source: 'stalwart' },
    ]);
    const res = await summarizeOutbox('7d', NOW);
    expect(res.webhookLastSuccessAt).toBe(newest.toISOString());

    await truncateEmailTables();
    const empty = await summarizeOutbox('7d', NOW);
    expect(empty.webhookLastSuccessAt).toBeNull();
  });

  it('F03-I-011 — comparison 30d : deliveredPct vs la fenêtre 30j PRÉCÉDENTE', async () => {
    // Fenêtre courante [now-30j, now] : 4 delivered.
    await seedDelivered(at(10 * DAY), 4);
    // Fenêtre précédente [now-60j, now-30j[ : 2 delivered → +100 %.
    await seedDelivered(at(45 * DAY), 2);
    const res = await summarizeOutbox('30d', NOW);
    expect(res.comparison).toBeDefined();
    expect(res.comparison!.deliveredPct).toBe(100);
  });
});
