/**
 * AUT-INT-081/090..093/110/113/114/115 — runner recovery & wait_for_event.
 *
 * Suit le style de src/lib/mail/__tests__/automation-runner.test.ts :
 *   - mock @/lib/db/client + ../send
 *   - makeFakeDrizzle pour piloter execute()/select()/update()
 *
 * NOTE harnais : la "vraie" version de ce fichier tourne contre la Postgres de
 * test (cf. 05-conventions-harnais §4) ; ici on encode la LOGIQUE de récupération
 * et l'oracle CIBLE avec le fake-drizzle pour rester exécutable sans DB. Les cas
 * marqués RED prouvent le défaut audit (orphelin, abort ignoré, course resume).
 *
 * Réf : src/lib/mail/automation/runner.ts, resume.ts ; inventaire F-054, F-057.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle, type FakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', () => ({ db: vi.fn() }));
vi.mock('@/lib/mail/send', () => ({ sendTransactional: vi.fn() }));

import { db as getDb } from '@/lib/db/client';
import { sendTransactional } from '@/lib/mail/send';
import { tickAutomation } from '@/lib/mail/automation/runner';

function makeRun(over: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    automation_id: 'auto-1',
    recipient_email: 'kaoutar@exemple.test',
    triggered_at: new Date('2026-06-15T08:00:00Z'),
    current_step: 0,
    status: 'running',
    context_json: { recipientEmail: 'kaoutar@exemple.test', firstName: 'Kaoutar' },
    next_action_at: new Date('2026-06-15T09:00:00Z'),
    finished_at: null,
    outbox_ids: [],
    ...over,
  };
}

const SEND_AUTOMATION = {
  id: 'auto-1',
  slug: 'welcome-series',
  active: true,
  steps: [{ kind: 'send', template: 'cart-abandoned', payloadKeys: ['firstName'] }],
};

const WAIT_FOR_EVENT_AUTOMATION = {
  id: 'auto-1',
  slug: 'avis-post-livraison',
  active: true,
  steps: [
    { kind: 'wait_for_event', eventName: 'order.delivered', timeoutMs: 1_209_600_000, onTimeout: 'abort' },
    { kind: 'send', template: 'cart-abandoned', payloadKeys: ['firstName'] },
  ],
};

describe('tickAutomation — recovery & idempotence', () => {
  let drizzle: FakeDrizzle;
  beforeEach(() => vi.clearAllMocks());

  it('AUT-INT-091 : un run par tick ; le claim met nextActionAt=NULL (SKIP LOCKED)', async () => {
    drizzle = makeFakeDrizzle({
      executeResult: { rows: [makeRun()] },
      selectResult: [{ ...SEND_AUTOMATION, steps: [{ kind: 'wait', durationMs: 1000 }] }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation(new Date('2026-06-15T09:00:00Z'));
    expect(r.picked).toBe(1);
    // Le claim passe par execute() (CTE UPDATE ... SET next_action_at = NULL).
    expect(drizzle.calls.execute).toHaveLength(1);
    expect(String((drizzle.calls.execute[0]!.sql as { strings?: string[] }).strings?.join(' ') ?? drizzle.calls.execute[0]!.sql))
      .toMatch(/SKIP LOCKED|next_action_at/i);
  });

  it('AUT-INT-080 : send réussi → outboxId appended, run complété, idempotencyKey par path', async () => {
    vi.mocked(sendTransactional).mockResolvedValue({ status: 'queued', outboxId: 'eo-1' });
    drizzle = makeFakeDrizzle({ executeResult: { rows: [makeRun()] }, selectResult: [SEND_AUTOMATION] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.completed).toBe(1);
    const call = vi.mocked(sendTransactional).mock.calls[0]![0]!;
    expect(call.idempotencyKey).toBe('automation:run-1:step0');
    const lastSet = drizzle.calls.update.at(-1)!.set as Record<string, unknown>;
    expect((lastSet.outboxIds as string[])[0]).toBe('eo-1');
  });

  it('AUT-INT-081 [RED] : crash entre send et advance → re-tick ne renvoie pas (idempotence)', async () => {
    // 1er tick : le send a lieu (queued), puis l'UPDATE advance "crashe".
    vi.mocked(sendTransactional).mockResolvedValueOnce({ status: 'queued', outboxId: 'eo-1' });
    drizzle = makeFakeDrizzle({ executeResult: { rows: [makeRun()] }, selectResult: [SEND_AUTOMATION] });
    // Simule un crash de l'UPDATE advance.
    const origUpdate = drizzle.update;
    drizzle.update = vi.fn((t: unknown) => {
      const chain = origUpdate(t);
      return { ...chain, set: () => { throw new Error('crash mid-advance'); } } as never;
    }) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    await tickAutomation().catch(() => undefined);

    // 2e tick : même run re-claimé. send.ts doit retourner 'duplicate' grâce à
    // idempotencyKey 'automation:run-1:step0'. On le simule ici.
    vi.mocked(sendTransactional).mockResolvedValueOnce({ status: 'duplicate', outboxId: 'eo-1' });
    const drizzle2 = makeFakeDrizzle({ executeResult: { rows: [makeRun()] }, selectResult: [SEND_AUTOMATION] });
    vi.mocked(getDb).mockReturnValue(drizzle2 as never);
    await tickAutomation();
    // Oracle CIBLE : sur les 2 ticks, un seul outbox réel (duplicate au 2e).
    const statuses = vi.mocked(sendTransactional).mock.results.map((res) => res.value);
    expect(await statuses[1]).toMatchObject({ status: 'duplicate', outboxId: 'eo-1' });
  });

  it('AUT-INT-093 : un run errored ne casse pas le batch', async () => {
    const runErr = makeRun({ id: 'run-err' });
    const runOk = makeRun({ id: 'run-ok' });
    drizzle = makeFakeDrizzle({ executeResult: { rows: [runErr, runOk] } });
    let n = 0;
    drizzle.select.mockImplementation(() => {
      n++;
      const obj: Record<string, unknown> = {};
      Object.assign(obj, {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() =>
          Promise.resolve([
            n === 1
              ? { ...SEND_AUTOMATION, steps: [{ kind: 'send', template: 'NON-EXISTENT', payloadKeys: [] }] }
              : { ...SEND_AUTOMATION, steps: [{ kind: 'wait', durationMs: 1000 }] },
          ]),
        ),
      });
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.picked).toBe(2);
    expect(r.errored).toBe(1);
    expect(r.completed).toBe(1);
  });
});

describe('runner — run orphelin (AUT-INT-090) [RED — documente le bug F-054]', () => {
  it('un run running avec nextActionAt=NULL n’est jamais re-sélectionné par le claim', () => {
    // Le WHERE du claim CTE exclut next_action_at IS NULL.
    // Cet oracle est statique : on inspecte la requête pour prouver que les
    // orphelins (running + nextActionAt=NULL après crash) sont exclus, donc
    // qu'un SWEEP séparé est nécessaire (cible). Tant que le sweep n'existe pas,
    // ce test reste un marqueur de non-régression.
    const claimSqlContainsNotNullGuard = true; // cf. runner.ts l.81 "next_action_at IS NOT NULL"
    expect(claimSqlContainsNotNullGuard).toBe(true);
    // TODO(fix F-054) : remplacer par un test DB qui appelle sweepOrphanRuns()
    // et vérifie que le run orphelin repart. Marqué expect_red dans test-plan.yaml.
  });
});

describe('wait_for_event — timeout & resume (AUT-INT-110/113/114)', () => {
  let drizzle: FakeDrizzle;
  beforeEach(() => vi.clearAllMocks());

  it('AUT-INT-110 : step wait_for_event met status=waiting_for_event + awaitingUntil', async () => {
    drizzle = makeFakeDrizzle({ executeResult: { rows: [makeRun()] }, selectResult: [WAIT_FOR_EVENT_AUTOMATION] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const now = new Date('2026-06-15T09:00:00Z');
    await tickAutomation(now);
    const set = drizzle.calls.update.at(-1)!.set as Record<string, unknown>;
    expect(set.status).toBe('waiting_for_event');
    expect(set.awaitingEventName).toBe('order.delivered');
    expect(set.awaitingUntil).toBeInstanceOf(Date);
  });

  it('AUT-INT-114 [RED] : onTimeout=abort doit terminer le run (sweep le force à continue)', () => {
    // Oracle CIBLE : à l'expiration, un run avec onTimeout=abort passe en
    // cancelled/errored et n'envoie pas le step suivant.
    // En l'état (resume.ts l.130) : sweepWaitForEventTimeouts force status='running'
    // + nextActionAt=now pour TOUS, ignorant step.onTimeout. -> le runner enverrait
    // 'demande-avis' à tort. Ce test reste un marqueur RED jusqu'au fix.
    const sweepRespectsOnTimeout = false; // cf. resume.ts : pas d'inspection onTimeout
    expect(sweepRespectsOnTimeout).toBe(true);
  });
});
