// @vitest-environment node
/**
 * UX-AUT-003 / UX4-AUTOMATIONS-004 — retryAutomationRun relance un run errored.
 *
 * Le défaut corrigé : un run demoté en 'errored' (template momentanément inconnu,
 * webhook down, …) était définitivement perdu côté opérateur — aucune remédiation
 * sans SQL manuel. La nouvelle server action `retryAutomationRun(runId)` remet le
 * run en 'running', nextActionAt=now, et efface erroredReason/erroredAt.
 *
 * IDs : UX4-AUTOMATIONS-004 (+ AUT-RETRY-001..003).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_automation#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/admin/emails/__tests__/automation-actions.retry.integration.test.ts
 */
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// requireAdmin + audit + revalidatePath mockés : on teste la mutation DB pure.
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ email: 'admin@test', id: 'admin' })),
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn(async () => {}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createId } from '@/lib/ids';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { makeEmailAutomation, makeAutomationRun } from '@/test/factories/emails.factory';
import { retryAutomationRun } from '@/lib/admin/emails/automation-actions';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, p) => (emailsTestDb() as never)[p],
});

const NOW = new Date('2026-06-12T09:00:00.000Z');

async function seedErroredRun(over: Parameters<typeof makeAutomationRun>[0] = {}) {
  const auto = makeEmailAutomation({ slug: `retry-${createId()}`, active: true });
  await db.insert(emailAutomation).values(auto);
  const run = makeAutomationRun({
    automationId: auto.id,
    status: 'errored',
    erroredReason: 'Template inconnu : ghost',
    erroredAt: NOW,
    finishedAt: NOW,
    nextActionAt: null,
    currentStep: 1,
    ...over,
  });
  await db.insert(emailAutomationRun).values(run);
  return { auto, run };
}

async function getRun(id: string) {
  const [row] = await db.select().from(emailAutomationRun).where(eq(emailAutomationRun.id, id)).limit(1);
  if (!row) throw new Error(`getRun ${id}`);
  return row;
}

function fd(runId: string): FormData {
  const f = new FormData();
  f.set('id', runId);
  return f;
}

beforeEach(() => {
  __setTestDb(emailsTestDb() as never);
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('retryAutomationRun — relance d un run errored (vraie DB)', () => {
  beforeEach(truncateEmailTables);

  // UX4-AUTOMATIONS-004 — cœur : errored → running, nextActionAt≈now, erroredReason effacé.
  it('UX4-AUTOMATIONS-004 : run errored → running, nextActionAt posé, erroredReason effacé', async () => {
    const { run } = await seedErroredRun();
    const before = Date.now();
    const res = await retryAutomationRun(fd(run.id));
    expect(res.ok).toBe(true);

    const after = await getRun(run.id);
    expect(after.status).toBe('running');
    expect(after.erroredReason).toBeNull();
    expect(after.erroredAt).toBeNull();
    expect(after.finishedAt).toBeNull();
    expect(after.nextActionAt).toBeInstanceOf(Date);
    expect(after.nextActionAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    // currentStep conservé (reprise au step courant, pas remise à zéro forcée).
    expect(after.currentStep).toBe(1);
  });

  // AUT-RETRY-002 — un run NON errored (completed) n'est PAS relancé.
  it('AUT-RETRY-002 : run completed → refus, statut inchangé', async () => {
    const { run } = await seedErroredRun({ status: 'completed', erroredReason: null, erroredAt: null });
    const res = await retryAutomationRun(fd(run.id));
    expect(res.ok).toBe(false);
    expect((await getRun(run.id)).status).toBe('completed');
  });

  // AUT-RETRY-003 — id inconnu → échec propre (pas de throw).
  it('AUT-RETRY-003 : id inexistant → ok=false sans throw', async () => {
    const res = await retryAutomationRun(fd('run_does_not_exist'));
    expect(res.ok).toBe(false);
  });
});
