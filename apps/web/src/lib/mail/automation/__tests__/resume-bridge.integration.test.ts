// @vitest-environment node
/**
 * CHANTIER E — PHASE 8 DURCISSEMENT — couverture trou automation/resume.ts
 * (0 % → cible). C'est le pont `wait_for_event` : un run en pause est RÉVEILLÉ
 * par l'arrivée de l'événement attendu (resumeRunsForEvent), ou par l'expiration
 * du timeout (sweepWaitForEventTimeouts). Sans couverture, une régression ici
 * fige des automations en attente pour toujours.
 *
 * Oracle métier (vraie DB) :
 *   resumeRunsForEvent :
 *     - réveille UNIQUEMENT les runs waiting_for_event dont le nom d'event ET
 *       l'email matchent ET dont awaiting_until > now (pas encore expiré) ;
 *     - le run réveillé repasse running, awaiting_* remis à NULL, next_action_at
 *       = now, et le path AVANCE au-delà du step wait_for_event ;
 *     - n'effleure PAS un run dont l'email diffère, dont l'event diffère, ou
 *       déjà expiré ; renvoie le nombre exact réveillé.
 *   sweepWaitForEventTimeouts :
 *     - réveille les runs dont awaiting_until <= now (onTimeout par défaut =
 *       continue → status running + next_action_at=now) ;
 *     - ne touche pas un run pas encore expiré ; renvoie le compte balayé.
 *
 * IDs : AUT-RESUME-001..008 (module 05-automations, surface wait_for_event).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_phase8#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/automation/__tests__/resume-bridge.integration.test.ts
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
import { resumeRunsForEvent, sweepWaitForEventTimeouts } from '../resume';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

const NOW = new Date('2026-06-12T09:00:00.000Z');
const future = (ms: number) => new Date(NOW.getTime() + ms);
const past = (ms: number) => new Date(NOW.getTime() - ms);

// Steps V2 : [wait_for_event @0, wait @1]. Le resume doit faire AVANCER le path
// de [0] vers [1] (il y a une étape suivante).
const STEPS = [
  { kind: 'wait_for_event', eventName: 'order.placed', timeoutMs: 3_600_000 },
  { kind: 'wait', durationMs: 60_000 },
];

async function insertAutomation(over: Partial<typeof emailAutomation.$inferInsert> = {}) {
  const id = createId('auto');
  await db.insert(emailAutomation).values({
    id,
    slug: `wfe-${id}`,
    name: 'WFE',
    triggerType: 'event',
    triggerConfig: { eventName: 'lead.created' },
    steps: STEPS as unknown as object[],
    active: true,
    ...over,
  });
  return id;
}

async function insertWaitingRun(input: {
  automationId: string;
  email: string;
  eventName: string;
  awaitingUntil: Date;
  currentStep?: number;
}) {
  const id = createId('run');
  await db.insert(emailAutomationRun).values({
    id,
    automationId: input.automationId,
    recipientEmail: input.email.toLowerCase(),
    currentStep: input.currentStep ?? 0,
    status: 'waiting_for_event',
    awaitingEventName: input.eventName,
    awaitingUntil: input.awaitingUntil,
    nextActionAt: input.awaitingUntil,
    contextJson: { _path: [0], recipientEmail: input.email.toLowerCase() },
  });
  return id;
}

async function getRun(id: string) {
  const [row] = await db
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.id, id))
    .limit(1);
  if (!row) throw new Error(`getRun: run ${id} introuvable`);
  return row;
}

describeEmailsDb('automation/resume — pont wait_for_event (vraie DB)', () => {
  beforeEach(truncateEmailTables);
  afterAll(closeTestDb);

  // AUT-RESUME-001 — l'event attendu réveille le run et avance le path.
  it('resumeRunsForEvent réveille le run, avance le path et remet awaiting_* à NULL', async () => {
    const autoId = await insertAutomation();
    const runId = await insertWaitingRun({
      automationId: autoId,
      email: 'cliente@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: future(3_600_000),
    });

    const resumed = await resumeRunsForEvent('order.placed', 'cliente@exemple.test', NOW);
    expect(resumed).toBe(1);

    const run = await getRun(runId);
    expect(run.status).toBe('running');
    expect(run.awaitingEventName).toBeNull();
    expect(run.awaitingUntil).toBeNull();
    expect(run.nextActionAt?.getTime()).toBe(NOW.getTime());
    // path avancé [0] → [1] (étape wait suivante).
    expect((run.contextJson as { _path?: unknown })._path).toEqual([1]);
    expect(run.currentStep).toBe(1);
  });

  // AUT-RESUME-002 — email différent : pas réveillé.
  it('ne réveille pas un run dont l email diffère', async () => {
    const autoId = await insertAutomation();
    const runId = await insertWaitingRun({
      automationId: autoId,
      email: 'autre@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: future(3_600_000),
    });

    const resumed = await resumeRunsForEvent('order.placed', 'cliente@exemple.test', NOW);
    expect(resumed).toBe(0);
    expect((await getRun(runId)).status).toBe('waiting_for_event');
  });

  // AUT-RESUME-003 — nom d'event différent : pas réveillé.
  it('ne réveille pas un run qui attend un autre event', async () => {
    const autoId = await insertAutomation();
    const runId = await insertWaitingRun({
      automationId: autoId,
      email: 'cliente@exemple.test',
      eventName: 'cart.abandoned',
      awaitingUntil: future(3_600_000),
    });

    const resumed = await resumeRunsForEvent('order.placed', 'cliente@exemple.test', NOW);
    expect(resumed).toBe(0);
    expect((await getRun(runId)).status).toBe('waiting_for_event');
  });

  // AUT-RESUME-004 — run déjà expiré (awaiting_until <= now) : pas réveillé par l'event.
  it('ne réveille pas par event un run déjà expiré (awaiting_until passé)', async () => {
    const autoId = await insertAutomation();
    const runId = await insertWaitingRun({
      automationId: autoId,
      email: 'cliente@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: past(1_000),
    });

    const resumed = await resumeRunsForEvent('order.placed', 'cliente@exemple.test', NOW);
    expect(resumed).toBe(0);
    expect((await getRun(runId)).status).toBe('waiting_for_event');
  });

  // AUT-RESUME-005 — email entrant normalisé (casse/espaces).
  it('normalise l email entrant pour matcher le run', async () => {
    const autoId = await insertAutomation();
    const runId = await insertWaitingRun({
      automationId: autoId,
      email: 'cliente@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: future(3_600_000),
    });

    const resumed = await resumeRunsForEvent('order.placed', '  CLIENTE@EXEMPLE.TEST ', NOW);
    expect(resumed).toBe(1);
    expect((await getRun(runId)).status).toBe('running');
  });

  // AUT-RESUME-006 — aucun candidat : renvoie 0 sans effet de bord.
  it('resumeRunsForEvent renvoie 0 quand aucun run n attend', async () => {
    expect(await resumeRunsForEvent('order.placed', 'personne@exemple.test', NOW)).toBe(0);
  });

  // AUT-RESUME-007 — GARDE-FOU (bug corrigé 2026-06-05, ex-pin du crash) :
  // sweepWaitForEventTimeouts bindait une Date JS crue dans son template `sql`
  // postgres-js → ERR_INVALID_ARG_TYPE à la phase ParameterDescription, le cron
  // /api/cron/email-automation 500 à chaque tick (son test de route MOCKE la
  // sweep, le bug n'avait jamais été observé). Corrigé : bind ISO + ::timestamptz
  // (cf. 05-conventions §8). Ce test épingle l'absence de régression : la sweep
  // ne doit JAMAIS rejeter sur le driver postgres-js réel.
  it('sweepWaitForEventTimeouts ne rejette plus sur postgres-js (garde-fou Date→ISO)', async () => {
    const autoId = await insertAutomation();
    await insertWaitingRun({
      automationId: autoId,
      email: 'expiree@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: past(1_000),
    });

    await expect(sweepWaitForEventTimeouts(NOW)).resolves.toBe(1);
  });

  // AUT-RESUME-008 — oracle cible ACTIVÉ (fix resume.ts 2026-06-05) :
  // la sweep réveille UNIQUEMENT les runs expirés (status running + awaiting_*
  // NULL + next_action_at=now), laisse les runs non expirés en attente, et
  // renvoie le compte exact.
  it('sweepWaitForEventTimeouts réveille les runs expirés (oracle cible post-fix)', async () => {
    const autoId = await insertAutomation();
    const expiredId = await insertWaitingRun({
      automationId: autoId,
      email: 'expiree@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: past(1_000),
    });
    const liveId = await insertWaitingRun({
      automationId: autoId,
      email: 'vivante@exemple.test',
      eventName: 'order.placed',
      awaitingUntil: future(3_600_000),
    });

    const swept = await sweepWaitForEventTimeouts(NOW);
    expect(swept).toBe(1);

    const expired = await getRun(expiredId);
    expect(expired.status).toBe('running');
    expect(expired.awaitingEventName).toBeNull();
    expect(expired.awaitingUntil).toBeNull();
    expect(expired.nextActionAt?.getTime()).toBe(NOW.getTime());
    expect((await getRun(liveId)).status).toBe('waiting_for_event');
  });
});
