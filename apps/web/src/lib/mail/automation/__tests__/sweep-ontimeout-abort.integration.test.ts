// @vitest-environment node
/**
 * UX-AUT-008 / UX4-AUTOMATIONS-006 — sweepWaitForEventTimeouts honore onTimeout.
 *
 * Le défaut corrigé : le sweep forçait TOUJOURS status='running' (= continue),
 * ignorant le step.onTimeout='abort' proposé par l'UI → un run censé être
 * abandonné après timeout poursuivait et envoyait le step suivant.
 *
 * Comportement câblé (vague 4) :
 *   - step.onTimeout absent / 'continue' → run re-armé en 'running' (inchangé,
 *     garde-fou AUT-RESUME-008) ;
 *   - step.onTimeout='abort' → run passe à 'cancelled' (PAS re-armé), raison
 *     _cancelledReason='wait_for_event_timeout_abort'.
 *
 * IDs : UX4-AUTOMATIONS-006 (+ AUT-ABORT-001..003).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_automation#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/automation/__tests__/sweep-ontimeout-abort.integration.test.ts
 */
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { sweepWaitForEventTimeouts } from '../resume';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

const NOW = new Date('2026-06-12T09:00:00.000Z');
const past = (ms: number) => new Date(NOW.getTime() - ms);

async function insertAutomation(steps: object[]) {
  const id = createId('auto');
  await db.insert(emailAutomation).values({
    id,
    slug: `abort-${id}`,
    name: 'WFE abort',
    triggerType: 'event',
    triggerConfig: { eventName: 'lead.created' },
    steps: steps as unknown as object[],
    active: true,
  });
  return id;
}

async function insertExpiredWaitingRun(automationId: string, email: string) {
  const id = createId('run');
  await db.insert(emailAutomationRun).values({
    id,
    automationId,
    recipientEmail: email.toLowerCase(),
    currentStep: 0,
    status: 'waiting_for_event',
    awaitingEventName: 'order.placed',
    awaitingUntil: past(1_000),
    nextActionAt: past(1_000),
    contextJson: { _path: [0], recipientEmail: email.toLowerCase() },
  });
  return id;
}

async function getRun(id: string) {
  const [row] = await db
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.id, id))
    .limit(1);
  if (!row) throw new Error(`getRun: ${id} introuvable`);
  return row;
}

describeEmailsDb('sweepWaitForEventTimeouts — onTimeout abort (vraie DB)', () => {
  beforeEach(truncateEmailTables);
  afterAll(closeTestDb);

  // UX4-AUTOMATIONS-006 — abort : le run expiré est CANCELLED, pas re-armé.
  it('UX4-AUTOMATIONS-006 : onTimeout=abort → run cancelled (pas running)', async () => {
    const autoId = await insertAutomation([
      { kind: 'wait_for_event', eventName: 'order.placed', timeoutMs: 3_600_000, onTimeout: 'abort' },
      { kind: 'wait', durationMs: 60_000 },
    ]);
    const runId = await insertExpiredWaitingRun(autoId, 'abort@exemple.test');

    const swept = await sweepWaitForEventTimeouts(NOW);
    expect(swept).toBe(1);

    const run = await getRun(runId);
    expect(run.status).toBe('cancelled');
    expect(run.awaitingEventName).toBeNull();
    expect(run.awaitingUntil).toBeNull();
    expect(run.nextActionAt).toBeNull();
    expect((run.contextJson as Record<string, unknown>)._cancelledReason).toBe(
      'wait_for_event_timeout_abort',
    );
  });

  // AUT-ABORT-002 — continue explicite : comportement inchangé (running).
  it('AUT-ABORT-002 : onTimeout=continue → run re-armé running', async () => {
    const autoId = await insertAutomation([
      { kind: 'wait_for_event', eventName: 'order.placed', timeoutMs: 3_600_000, onTimeout: 'continue' },
      { kind: 'wait', durationMs: 60_000 },
    ]);
    const runId = await insertExpiredWaitingRun(autoId, 'continue@exemple.test');

    expect(await sweepWaitForEventTimeouts(NOW)).toBe(1);
    const run = await getRun(runId);
    expect(run.status).toBe('running');
    expect(run.nextActionAt?.getTime()).toBe(NOW.getTime());
  });

  // AUT-ABORT-003 — mix abort + continue dans un même sweep, comptes séparés.
  it('AUT-ABORT-003 : sweep mixte → abort cancelled, continue running', async () => {
    const abortAuto = await insertAutomation([
      { kind: 'wait_for_event', eventName: 'order.placed', timeoutMs: 3_600_000, onTimeout: 'abort' },
    ]);
    const continueAuto = await insertAutomation([
      { kind: 'wait_for_event', eventName: 'order.placed', timeoutMs: 3_600_000 },
      { kind: 'wait', durationMs: 60_000 },
    ]);
    const abortRun = await insertExpiredWaitingRun(abortAuto, 'a@exemple.test');
    const contRun = await insertExpiredWaitingRun(continueAuto, 'c@exemple.test');

    expect(await sweepWaitForEventTimeouts(NOW)).toBe(2);
    expect((await getRun(abortRun)).status).toBe('cancelled');
    expect((await getRun(contRun)).status).toBe('running');
  });
});
