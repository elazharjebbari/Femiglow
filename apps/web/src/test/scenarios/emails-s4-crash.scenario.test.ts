// @vitest-environment node
/**
 * CHANTIER C — PHASE 7, SCÉNARIO MÉTIER S4 : REPRISE APRÈS CRASH.
 *
 * Module 08 (outbox + reaper) + moteur automation (orphan-sweep), contre la
 * VRAIE DB (femiglow_test_scenarios). C'est la répétition générale d'un
 * redéploiement / SIGTERM / OOM en plein traitement :
 *
 *   - 10 lignes outbox figées `sending` (process mort entre le claim et le statut
 *     terminal), avec des `attempts` variés ;
 *   - 2 runs d'automation ZOMBIES (`running` + next_action_at NULL, jamais
 *     re-sélectionnables sans sweep).
 *
 * Reprise : `reapStuckSending` + `sweepOrphanRuns` + drain (`pickAndProcessBatch`
 * réintègre le reaper ; `tickAutomation` réintègre le sweep).
 *
 * ORACLES DURS :
 *   (a) AUCUNE PERTE — chaque ligne outbox finit dans un état terminal cohérent
 *       (sent, OU dlq quand le budget de retry est épuisé) ; AUCUNE résiduelle
 *       en `sending`.
 *   (b) AUCUN DOUBLON — le SMTP mock compte les envois PAR outboxId : exactement
 *       1 pour chaque ligne livrée, 0 pour une ligne déjà `sent` ou partie en dlq.
 *   (c) RUNS REQUALIFIÉS — les zombies reconstructibles sont ré-armés puis avancés.
 *
 * Le scénario complet est REJOUÉ 3 FOIS (boucle) dans la même suite pour
 * l'anti-flake concurrence (chaque itération truncate + reseed + assert).
 *
 * AUCUNE modification de `src`. Pas de sleep : on simule le « figé » via des
 * `updatedAt`/`triggeredAt` au-delà des seuils, et on draine via waitFor.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_scenarios#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/test/scenarios/emails-s4-crash.scenario.test.ts
 *
 * IDs scénario : S4-01 (no-loss + no-dup + runs requalifiés, ×3 itérations),
 *   S4-02 (idempotence d'un 2e tick : aucun nouvel envoi).
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-s4-crash-secret-0123456789abcdef';
});

// SMTP mock : compte les envois PAR outboxId. C'est l'oracle anti-doublon — une
// ligne livrée ne doit apparaître qu'UNE FOIS dans `sendCountById`.
// eslint-disable-next-line no-var
var sendCountById: Map<string, number>;
sendCountById = new Map();
vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: { headers?: Record<string, string> }) => {
      const id = opts.headers?.['X-FG-Outbox-Id'] ?? 'unknown';
      sendCountById.set(id, (sendCountById.get(id) ?? 0) + 1);
      return { messageId: `<msg-${id}@test>`, response: '250 OK' };
    },
  }),
}));

import { createId } from '@/lib/ids';
import { emailOutbox, emailEvent, emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, makeEmailAutomation, makeAutomationRun } from '@/test/factories/emails.factory';
import { pickAndProcessBatch, reapStuckSending, REAP_THRESHOLD_MS } from '@/lib/mail/outbox';
import { tickAutomation } from '@/lib/mail/automation/runner';
import { sweepOrphanRuns } from '@/lib/mail/automation/orphan-sweep';
import { MAX_ATTEMPTS } from '@/lib/mail/backoff';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, p) => (emailsTestDb() as never)[p],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, p) => (emailsTestSql() as never)[p],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

/** Une ligne outbox figée `sending` (process crashé après le claim). */
function stuckSending(over: Parameters<typeof makeOutboxRow>[0] = {}) {
  const longAgo = new Date(Date.now() - REAP_THRESHOLD_MS - 5 * 60_000);
  return makeOutboxRow({
    status: 'sending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    nextRetry: null,
    scheduledFor: null,
    updatedAt: longAgo,
    createdAt: longAgo,
    ...over,
  });
}

async function rowById(id: string) {
  const [r] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
  return r!;
}
async function sentEventsFor(id: string) {
  const evts = await db.select().from(emailEvent).where(eq(emailEvent.outboxId, id));
  return evts.filter((e) => e.type === 'sent');
}

async function cleanup(): Promise<void> {
  await truncateEmailTables();
  await pg`DELETE FROM user_event`;
  await pg`DELETE FROM leads`;
}

const WAIT_TWO_STEPS = [
  { kind: 'wait', durationMs: 1_000 },
  { kind: 'wait', durationMs: 1_000 },
];

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await cleanup();
  sendCountById.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('S4 — reprise après crash (outbox reaper + orphan-sweep), rejoué 3×', () => {
  // S4-01 — le scénario complet, REJOUÉ 3 FOIS pour l'anti-flake. Chaque itération :
  // seed (10 sending figées + 2 zombies) → reprise → oracles no-loss / no-dup /
  // runs requalifiés.
  for (let iter = 1; iter <= 3; iter++) {
    it(`S4-01 (itération ${iter}/3) : no-loss + no-dup + runs requalifiés`, async () => {
      // ── 10 lignes outbox figées en `sending`, attempts variés ──────────────
      // 8 lignes « livrables » (attempts 0..2 < MAX-1) → seront reapées→pending
      // puis livrées dans le MÊME tick (pickAndProcessBatch). 2 lignes au plafond
      // (attempts = MAX-1) → reaper les passe directement en `dlq` (budget épuisé),
      // JAMAIS livrées (oracle anti-doublon : 0 envoi pour celles-là).
      const deliverable = Array.from({ length: 8 }, (_n, i) =>
        stuckSending({ attempts: i % 3 }), // 0,1,2,0,1,2,0,1 — tous < MAX-1
      );
      const atCeiling = Array.from({ length: 2 }, () =>
        stuckSending({ attempts: MAX_ATTEMPTS - 1 }),
      );
      await db.insert(emailOutbox).values([...deliverable, ...atCeiling]);
      const deliverableIds = deliverable.map((r) => r.id);
      const ceilingIds = atCeiling.map((r) => r.id);
      const allIds = [...deliverableIds, ...ceilingIds];

      // ── 2 runs d'automation ZOMBIES (running + next_action_at NULL, anciens) ──
      const auto = makeEmailAutomation({
        slug: `s4-auto-${createId()}`,
        steps: WAIT_TWO_STEPS as unknown as object[],
        active: true,
      });
      await db.insert(emailAutomation).values(auto);
      const zombies = Array.from({ length: 2 }, (_n, i) =>
        makeAutomationRun({
          automationId: auto.id,
          status: 'running',
          nextActionAt: null,
          triggeredAt: new Date(Date.now() - 2 * 60 * 60_000), // 2h → > staleAfterMs
          currentStep: 0,
          contextJson: { recipientEmail: `zombie${i}-${createId()}@exemple.test`, _path: [0] },
        }),
      );
      await db.insert(emailAutomationRun).values(zombies);
      const zombieIds = zombies.map((r) => r.id);

      // ── REPRISE OUTBOX : pickAndProcessBatch reape (puis claime/livre) ───────
      const batch = await pickAndProcessBatch();
      // Les 10 sending figées sont toutes reapées en tête de tick.
      expect(batch.reaped).toBe(10);
      // Les 8 livrables ont été livrées dans le même tour.
      expect(batch.succeeded).toBe(8);

      // ── REPRISE AUTOMATION : tickAutomation sweep + ré-arme + avance ─────────
      const tick = await tickAutomation();
      expect(tick.orphansRearmed).toBe(2);
      expect(tick.orphansErrored).toBe(0);
      // Les 2 zombies ré-armés sont claimés et avancent (step wait → step suivant).
      expect(tick.picked).toBe(2);
      expect(tick.advanced).toBe(2);

      // ── ORACLE (a) AUCUNE PERTE : aucune ligne résiduelle en `sending` ───────
      const after = await db.select().from(emailOutbox).where(inArray(emailOutbox.id, allIds));
      expect(after).toHaveLength(10);
      expect(after.some((r) => r.status === 'sending')).toBe(false);
      // Les 8 livrables → sent ; les 2 au plafond → dlq (budget de retry épuisé).
      for (const id of deliverableIds) {
        expect((await rowById(id)).status).toBe('sent');
      }
      for (const id of ceilingIds) {
        const r = await rowById(id);
        expect(r.status).toBe('dlq');
        expect(r.attempts).toBe(MAX_ATTEMPTS);
        expect(r.nextRetry).toBeNull();
      }

      // ── ORACLE (b) AUCUN DOUBLON : exactement 1 envoi par ligne livrée, 0 ─────
      //     pour les lignes parties en dlq.
      for (const id of deliverableIds) {
        expect(sendCountById.get(id) ?? 0).toBe(1);
        // Et un seul event `sent` (pas de double journalisation).
        expect(await sentEventsFor(id)).toHaveLength(1);
      }
      for (const id of ceilingIds) {
        expect(sendCountById.get(id) ?? 0).toBe(0);
        expect(await sentEventsFor(id)).toHaveLength(0);
      }

      // ── ORACLE (c) RUNS REQUALIFIÉS : zombies repris (running, avancés au step 1) ─
      const runsAfter = await db
        .select()
        .from(emailAutomationRun)
        .where(inArray(emailAutomationRun.id, zombieIds));
      expect(runsAfter).toHaveLength(2);
      for (const run of runsAfter) {
        expect(run.status).toBe('running');
        // plus aucun zombie : next_action_at re-posé (step wait → planifié) et path avancé.
        expect(run.nextActionAt).toBeInstanceOf(Date);
        expect((run.contextJson as { _path?: unknown })._path).toEqual([1]);
      }
    });
  }

  // S4-02 — IDEMPOTENCE de la reprise : un 2e tick APRÈS reprise complète ne
  // réémet RIEN (les lignes sont terminales, les runs avancés ne sont plus dûs).
  it('S4-02 : un 2e cycle après reprise n’émet aucun nouvel envoi (idempotence)', async () => {
    const deliverable = Array.from({ length: 5 }, () => stuckSending({ attempts: 0 }));
    await db.insert(emailOutbox).values(deliverable);
    const ids = deliverable.map((r) => r.id);

    // Premier cycle : reprise + livraison.
    const first = await pickAndProcessBatch();
    expect(first.reaped).toBe(5);
    expect(first.succeeded).toBe(5);
    for (const id of ids) expect(sendCountById.get(id)).toBe(1);

    // Deuxième cycle : plus rien à reaper ni à claimer (toutes `sent`).
    const second = await pickAndProcessBatch();
    expect(second.reaped).toBe(0);
    expect(second.picked).toBe(0);
    expect(second.succeeded).toBe(0);

    // Oracle anti-doublon dur : aucun outboxId n'a 2 envois.
    for (const id of ids) {
      expect(sendCountById.get(id)).toBe(1);
      expect(await sentEventsFor(id)).toHaveLength(1);
      expect((await rowById(id)).status).toBe('sent');
    }
  });

  // S4-03 — le reaper SEUL (sans drain) requalifie correctement : les figées
  // < plafond → pending (next_retry posé), les figées au plafond → dlq. Prouve
  // la frontière reaper/drain (un crash où seul le reaper tourne avant le claim).
  it('S4-03 : reapStuckSending seul → pending sous plafond, dlq au plafond', async () => {
    const under = stuckSending({ attempts: 1 });
    const ceiling = stuckSending({ attempts: MAX_ATTEMPTS - 1 });
    await db.insert(emailOutbox).values([under, ceiling]);

    const reaped = await reapStuckSending();
    expect(reaped).toBe(2);

    const u = await rowById(under.id);
    expect(u.status).toBe('pending');
    expect(u.attempts).toBe(2); // +1 brûlé
    expect(u.nextRetry).toBeInstanceOf(Date);

    const c = await rowById(ceiling.id);
    expect(c.status).toBe('dlq');
    expect(c.nextRetry).toBeNull();

    // Aucun envoi : le reaper ne livre pas (il ne fait que requalifier).
    expect(sendCountById.size).toBe(0);
  });

  // S4-04 — orphan-sweep d'un zombie NON reconstructible (path hors-borne après un
  // crash où les steps ont été réordonnés/supprimés) : errored EXPLICITE, jamais
  // une reprise en boucle. Filet du « crash + steps disparus ». (L'automation
  // existe — FK oblige — mais son étape courante n'est plus résoluble.)
  it('S4-04 : zombie dont l’étape courante est hors-borne → errored (pas de reprise infinie)', async () => {
    // Automation à UNE seule étape (index 0). Le run pointe sur l'index 5.
    const auto = makeEmailAutomation({
      slug: `s4-broken-${createId()}`,
      steps: [{ kind: 'wait', durationMs: 1_000 }] as unknown as object[],
      active: true,
    });
    await db.insert(emailAutomation).values(auto);
    const run = makeAutomationRun({
      automationId: auto.id,
      status: 'running',
      nextActionAt: null,
      triggeredAt: new Date(Date.now() - 2 * 60 * 60_000),
      currentStep: 5, // hors-borne : aucune étape à l'index 5
      contextJson: { recipientEmail: 'orphan-oob@exemple.test', _path: [5] },
    });
    await db.insert(emailAutomationRun).values(run);

    const res = await sweepOrphanRuns();
    expect(res.scanned).toBe(1);
    expect(res.rearmed).toBe(0);
    expect(res.errored).toBe(1);

    const [after] = await db
      .select()
      .from(emailAutomationRun)
      .where(eq(emailAutomationRun.id, run.id));
    expect(after!.status).toBe('errored');
    expect(after!.nextActionAt).toBeNull();
    expect(after!.erroredReason!.toLowerCase()).toContain('introuvable');
  });
});
