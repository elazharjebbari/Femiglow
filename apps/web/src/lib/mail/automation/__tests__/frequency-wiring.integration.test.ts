// @vitest-environment node
/**
 * FRQ-INT-0xx — câblage de frequency.ts dans le chemin d'exécution des steps
 * d'envoi du moteur (chantier 1.8). Suite vraie-DB.
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────
 * `frequency.ts` (quiet hours / cooldown / daily cap) était 100 % code mort :
 * jamais importé par `runner.ts`. La promesse UI (« pas d'envoi nocturne »,
 * « cooldown », « cap quotidien ») était donc fausse — un step `send` partait
 * quelle que soit l'heure. Ce chantier câble les trois contrôles dans la branche
 * `send` de `processRun` et prouve l'effet OBSERVABLE en DB :
 *   - quiet hours  → le run est DIFFÉRÉ (`next_action_at` repoussé au prochain
 *                    `start` local), PAS envoyé, PAS perdu, PAS avancé ;
 *   - cooldown     → le step `send` est SKIPPÉ (pas d'envoi) avec raison persistée ;
 *   - daily cap    → idem.
 * + idempotence : deux ticks pendant la nuit ne décalent pas 2× (`next_action_at`
 *   reste posé sur le MÊME instant cible).
 *
 * ── DB dédiée (pas de collision parallèle) ───────────────────────────────
 * Cette suite tourne sur `femiglow_test_frequency` (≠ femiglow_test_automation
 * de la suite du chantier précédent) → aucun truncate croisé en pool forks.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_frequency#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/automation/__tests__/frequency-wiring.integration.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeAutomationRun, makeEmailAutomation } from '@/test/factories/emails.factory';
import { tickAutomation } from '../runner';

// Capture des envois réels : on n'envoie pas, on COMPTE les appels pour l'oracle
// « quiet hours / cooldown / cap → AUCUN send ».
const sendMock = vi.fn().mockResolvedValue({ status: 'queued', outboxId: 'ob_test' });
vi.mock('@/lib/mail/send', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mail/send')>('@/lib/mail/send');
  return { ...actual, sendTransactional: (...args: unknown[]) => sendMock(...args) };
});

// Init PARESSEUSE : emailsTestDb() throw sans URL femiglow_test — l'appel
// module-level casserait le run global (le skip describeEmailsDb arrive après
// l'import). Proxies lazy : résolution au premier accès, dans un test actif.
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, prop) => (emailsTestSql() as never)[prop],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

const CASA = 'Africa/Casablanca';
// Un step `send` simple (mocké) — template réel du registre pour passer isKnownTemplate.
const SEND_STEP = [{ kind: 'send', template: 'cart-abandoned' }];

async function cleanup(): Promise<void> {
  await truncateEmailTables();
  await pg`DELETE FROM user_event`;
  await pg`DELETE FROM leads`;
}

async function insertAutomation(over: Parameters<typeof makeEmailAutomation>[0] = {}) {
  const row = makeEmailAutomation({
    steps: SEND_STEP as unknown as object[],
    active: true,
    ...over,
  });
  await db.insert(emailAutomation).values(row);
  return row;
}

async function insertRun(over: Parameters<typeof makeAutomationRun>[0] = {}) {
  const row = makeAutomationRun(over);
  await db.insert(emailAutomationRun).values(row);
  return row;
}

async function getRun(id: string) {
  const [r] = await db
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.id, id))
    .limit(1);
  return r!;
}

beforeEach(async () => {
  await cleanup();
  sendMock.mockClear();
});
afterAll(closeTestDb);

// ───────────────────────────────────────────────────────────────────────────
// QUIET HOURS — le step d'envoi en pleine nuit est DIFFÉRÉ, pas envoyé.
// ───────────────────────────────────────────────────────────────────────────
describeEmailsDb('FRQ-INT — quiet hours : un send en pleine nuit est différé (pas envoyé, pas perdu)', () => {
  // FRQ-INT-053 — câblage régression : applyQuietHours influence nextActionAt du run.
  // (AUT-UNIT-045 / S4) Un run dont le step `send` tombe à 23:00 Casablanca est
  // repoussé à 08:00 local le lendemain, SANS envoi et SANS avancer le path.
  it('FRQ-INT-053 : send à 23:00 Casablanca → run différé à 08:00 local, aucun envoi', async () => {
    const auto = await insertAutomation({
      quietHoursEnabled: true,
      quietHoursStart: '08:00',
      quietHoursEnd: '22:00',
      quietHoursTz: CASA,
    });
    // nextActionAt dans le passé (Postgres now()) → le run sera CLAIMÉ ce tick.
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(Date.now() - 30 * 60_000),
      recipientEmail: 'nuit@exemple.test',
      contextJson: { recipientEmail: 'nuit@exemple.test', _path: [0] },
    });

    // On traite le run à un instant qui est 23:00 Casablanca (été UTC+1 → 22:00 UTC).
    const nightNow = new Date('2026-06-15T22:00:00Z');
    const res = await tickAutomation(nightNow);

    // Le run est claimé puis DIFFÉRÉ (compté comme advanced=0, ni completed).
    expect(res.picked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled(); // ORACLE : aucun envoi nocturne.

    const after = await getRun(run.id);
    // Pas perdu : toujours running, et re-programmé.
    expect(after.status).toBe('running');
    expect(after.nextActionAt).toBeInstanceOf(Date);
    // ORACLE : reprogrammé à 08:00 wall-clock Casablanca (= 07:00 UTC en été).
    const localH = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: CASA,
        hour12: false,
        hour: '2-digit',
      }).formatToParts(after.nextActionAt!).find((p) => p.type === 'hour')!.value,
    );
    expect(localH === 24 ? 0 : localH).toBe(8);
    expect(after.nextActionAt!.getTime()).toBeGreaterThan(nightNow.getTime());
    // Pas avancé : toujours sur le step 0.
    expect((after.contextJson as { _path?: unknown })._path).toEqual([0]);
  });

  // FRQ-INT-054 — idempotence du différé : deux ticks nocturnes ne décalent pas 2×.
  it('FRQ-INT-054 : deux ticks en pleine nuit reprogramment le run au MÊME instant (pas de double-décalage)', async () => {
    const auto = await insertAutomation({ quietHoursTz: CASA, quietHoursStart: '08:00', quietHoursEnd: '22:00' });
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(Date.now() - 30 * 60_000),
      recipientEmail: 'double@exemple.test',
      contextJson: { recipientEmail: 'double@exemple.test', _path: [0] },
    });

    // 1er tick à 23:00 Casa → différé à 08:00.
    await tickAutomation(new Date('2026-06-15T22:00:00Z'));
    const firstTarget = (await getRun(run.id)).nextActionAt!.getTime();

    // Pour re-claim au 2e tick, on remet nextActionAt dans le passé (simule un
    // runner qui re-passe pendant la nuit avant la réouverture de fenêtre).
    await db
      .update(emailAutomationRun)
      .set({ nextActionAt: new Date(Date.now() - 60_000) })
      .where(eq(emailAutomationRun.id, run.id));

    // 2e tick à 23:30 Casa (= 22:30 UTC) — toujours la nuit, même fenêtre cible.
    await tickAutomation(new Date('2026-06-15T22:30:00Z'));
    const secondTarget = (await getRun(run.id)).nextActionAt!.getTime();

    // ORACLE : la cible 08:00 du lendemain est IDENTIQUE → pas de glissement.
    expect(secondTarget).toBe(firstTarget);
    expect(sendMock).not.toHaveBeenCalled();
  });

  // FRQ-INT-055 — fenêtre ouverte : un send à 10:00 Casablanca PART (contrôle positif).
  it('FRQ-INT-055 : send à 10:00 Casablanca (dans la fenêtre) est envoyé et avance', async () => {
    const auto = await insertAutomation({ quietHoursTz: CASA, quietHoursStart: '08:00', quietHoursEnd: '22:00' });
    const run = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(Date.now() - 30 * 60_000),
      recipientEmail: 'jour@exemple.test',
      contextJson: { recipientEmail: 'jour@exemple.test', _path: [0] },
    });

    // 10:00 Casablanca (été UTC+1) = 09:00 UTC.
    const res = await tickAutomation(new Date('2026-06-15T09:00:00Z'));

    expect(sendMock).toHaveBeenCalledTimes(1); // ORACLE : envoyé dans la fenêtre.
    expect(res.completed).toBe(1); // 1 seul step `send` → run terminé.
    const after = await getRun(run.id);
    expect(after.status).toBe('completed');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// COOLDOWN — un envoi antérieur récent au même destinataire SKIPPE le send.
// ───────────────────────────────────────────────────────────────────────────
describeEmailsDb('FRQ-INT — cooldown : send skippé si un run antérieur récent au même destinataire', () => {
  // FRQ-INT-056 — cooldown actif → step `send` skippé, raison persistée, pas d'envoi.
  it('FRQ-INT-056 : cooldown actif → send skippé (raison persistée), run avance sans envoyer', async () => {
    const auto = await insertAutomation({
      cooldownSeconds: 3600, // 1h
      // Fenêtre quiet hours large pour ne pas interférer (toujours autorisé).
      quietHoursEnabled: false,
    });
    // Un run ANTÉRIEUR pour le même destinataire, triggé il y a 10 min (< 1h).
    await insertRun({
      automationId: auto.id,
      status: 'completed',
      currentStep: 0,
      nextActionAt: null,
      triggeredAt: new Date(Date.now() - 10 * 60_000),
      recipientEmail: 'cooldown@exemple.test',
      contextJson: { recipientEmail: 'cooldown@exemple.test', _path: [0] },
    });
    // Le run COURANT (le 2e), à traiter maintenant.
    const current = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(Date.now() - 1000),
      recipientEmail: 'cooldown@exemple.test',
      contextJson: { recipientEmail: 'cooldown@exemple.test', _path: [0] },
    });

    const res = await tickAutomation(new Date());

    expect(res.picked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled(); // ORACLE : pas d'envoi (cooldown).
    const after = await getRun(current.id);
    // Skip = avance sans envoyer ; 1 seul step → run completed, mais raison persistée.
    expect(after.status).toBe('completed');
    const ctx = after.contextJson as Record<string, unknown>;
    expect(String(ctx._skippedReason)).toContain('cooldown');
    expect(ctx._skippedStep).toBe('0');
  });

  // FRQ-INT-057 — pas de run antérieur → le send PART (cooldown ne s'auto-bloque pas).
  it('FRQ-INT-057 : sans run antérieur, le cooldown ne bloque PAS le premier envoi', async () => {
    const auto = await insertAutomation({ cooldownSeconds: 3600, quietHoursEnabled: false });
    const current = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(Date.now() - 1000),
      recipientEmail: 'premier@exemple.test',
      contextJson: { recipientEmail: 'premier@exemple.test', _path: [0] },
    });

    const res = await tickAutomation(new Date());

    // ORACLE : le run lui-même ne doit PAS s'auto-bloquer (exclusion du run courant).
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(res.completed).toBe(1);
    expect((await getRun(current.id)).status).toBe('completed');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DAILY CAP — le (N+1)-ième run du jour SKIPPE le send.
// ───────────────────────────────────────────────────────────────────────────
describeEmailsDb('FRQ-INT — daily cap : (N+1)-ième run du jour skippe le send', () => {
  // FRQ-INT-058 — cap=1 + un autre run déjà triggé aujourd'hui → 2e run skippé.
  it('FRQ-INT-058 : cap atteint → send skippé avec raison persistée, pas d’envoi', async () => {
    const auto = await insertAutomation({ dailyCap: 1, quietHoursEnabled: false, cooldownSeconds: 0 });
    // Un 1er run déjà triggé AUJOURD'HUI (Casablanca) → consomme le cap.
    await insertRun({
      automationId: auto.id,
      status: 'completed',
      currentStep: 0,
      nextActionAt: null,
      triggeredAt: new Date(), // aujourd'hui
      recipientEmail: 'autre@exemple.test',
      contextJson: { recipientEmail: 'autre@exemple.test', _path: [0] },
    });
    // Le 2e run (N+1) → doit être bloqué (count today=2 >= cap=1).
    const current = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(),
      recipientEmail: 'capped@exemple.test',
      contextJson: { recipientEmail: 'capped@exemple.test', _path: [0] },
    });

    const res = await tickAutomation(new Date());

    expect(res.picked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled(); // ORACLE : cap atteint → pas d'envoi.
    const after = await getRun(current.id);
    expect(after.status).toBe('completed');
    expect(String((after.contextJson as Record<string, unknown>)._skippedReason)).toContain('daily_cap');
  });

  // FRQ-INT-059 — cap large non atteint → le send PART.
  it('FRQ-INT-059 : cap non atteint → le send part normalement', async () => {
    const auto = await insertAutomation({ dailyCap: 100, quietHoursEnabled: false, cooldownSeconds: 0 });
    const current = await insertRun({
      automationId: auto.id,
      status: 'running',
      currentStep: 0,
      nextActionAt: new Date(Date.now() - 60_000),
      triggeredAt: new Date(),
      recipientEmail: 'souscap@exemple.test',
      contextJson: { recipientEmail: 'souscap@exemple.test', _path: [0] },
    });

    await tickAutomation(new Date());

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect((await getRun(current.id)).status).toBe('completed');
  });
});
