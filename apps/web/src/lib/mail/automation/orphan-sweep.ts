/**
 * Orphan / zombie run sweep (chantier 1.4 — runs `running` jamais repris).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────
 * Le claim du runner (`tickAutomation`) fait `UPDATE … SET next_action_at = NULL`
 * AVANT de traiter le run. Si le process crashe entre le claim et l'UPDATE final
 * de `processRun`, la ligne reste :
 *     status = 'running'  AND  next_action_at IS NULL
 * Or le claim ne sélectionne QUE `next_action_at IS NOT NULL`. Un tel run n'est
 * donc PLUS JAMAIS re-sélectionné : zombie permanent, aucun sweep.
 *
 * Cas jumeau : un run `running` avec `next_action_at` très ancien (dépassé depuis
 * longtemps) parce que le runner était mort (pas de timer systemd) — celui-là est
 * repris naturellement par le claim dès que le runner revit, mais on le compte ici
 * pour l'observabilité.
 *
 * ── Politique de reprise ─────────────────────────────────────────────────
 * Pour chaque run zombie (`running` + `next_action_at IS NULL`, plus vieux que
 * `staleAfterMs`) :
 *   - si l'étape courante est RECONSTRUCTIBLE (automation active + step résoluble
 *     au path courant) → REPRISE PROPRE : on ré-arme `next_action_at = now` pour
 *     que le tick courant le re-claim et le fasse avancer.
 *   - sinon (automation absente/inactive, steps invalides, path hors-borne) →
 *     ERREUR EXPLICITE : `status='errored'` + `erroredReason` parlant. JAMAIS un
 *     silence ni une reprise qui boucle.
 *
 * Le sweep est appelé AU DÉBUT de `tickAutomation`, avant le claim, pour que les
 * runs ré-armés soient traités dans le même tick.
 */
import 'server-only';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import { AutomationStepSchema } from './step-types-v2';
import { getStepAtPath, isValidPath, type StepPath } from './step-handlers/step-path';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const automationStepsSchema = z.array(AutomationStepSchema);

/** Au-delà de cet âge sans next_action_at, un run `running` est réputé zombie. */
const DEFAULT_STALE_AFTER_MS = 5 * 60_000; // 5 min (>> durée d'un tick sain)

export type OrphanSweepResult = {
  scanned: number;
  rearmed: number;
  errored: number;
};

type ZombieRow = {
  id: string;
  automationId: string;
  recipientEmail: string;
  currentStep: number;
  contextJson: Record<string, unknown> | null;
  nextActionAt: Date | null;
  triggeredAt: Date;
};

/**
 * Balaye les runs `running` orphelins (`next_action_at IS NULL`) plus vieux que
 * `staleAfterMs`. Ré-arme ceux qui sont reconstructibles, erreure les autres.
 */
export async function sweepOrphanRuns(
  now: Date = new Date(),
  opts: { staleAfterMs?: number } = {},
): Promise<OrphanSweepResult> {
  const drizzle = requireDb();
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const staleBefore = new Date(now.getTime() - staleAfterMs);

  const result: OrphanSweepResult = { scanned: 0, rearmed: 0, errored: 0 };

  // Candidats : running + next_action_at NULL + plus vieux que le seuil.
  // On borne par `triggered_at` (un run fraîchement enqueué a next_action_at non
  // NULL ; un run claimé puis crashé a un triggered_at déjà ancien).
  const selected = (await drizzle
    .select({
      id: emailAutomationRun.id,
      automationId: emailAutomationRun.automationId,
      recipientEmail: emailAutomationRun.recipientEmail,
      currentStep: emailAutomationRun.currentStep,
      contextJson: emailAutomationRun.contextJson,
      nextActionAt: emailAutomationRun.nextActionAt,
      triggeredAt: emailAutomationRun.triggeredAt,
    })
    .from(emailAutomationRun)
    .where(
      // status='running' AND next_action_at IS NULL AND triggered_at <= staleBefore
      and(
        eq(emailAutomationRun.status, 'running'),
        isNull(emailAutomationRun.nextActionAt),
        lte(emailAutomationRun.triggeredAt, staleBefore),
      ),
    )) as unknown;

  // drizzle.select() résout TOUJOURS un tableau de lignes bien formées en prod.
  // Les gardes (Array + ligne valide) ne se déclenchent que sous des mocks
  // partiels (fake-drizzle des tests unitaires du runner qui ne modélisent pas
  // CETTE query précise et renvoient leur `selectResult` générique) — on no-op
  // proprement plutôt que crasher / mal classer une ligne non-zombie.
  const zombies: ZombieRow[] = (Array.isArray(selected) ? selected : []).filter(
    isZombieRow,
  );

  result.scanned = zombies.length;

  for (const run of zombies) {
    const verdict = await classifyZombie(run);
    if (verdict.reconstructible) {
      // REPRISE PROPRE — ré-arme pour re-claim dans le tick courant.
      await drizzle
        .update(emailAutomationRun)
        .set({ nextActionAt: now })
        .where(eq(emailAutomationRun.id, run.id));
      result.rearmed++;
      logger.warn('automation.orphan.rearmed', {
        runId: run.id,
        automationId: run.automationId,
        ageMs: now.getTime() - run.triggeredAt.getTime(),
      });
    } else {
      // ERREUR EXPLICITE — lastError parlant, pas de silence.
      await drizzle
        .update(emailAutomationRun)
        .set({
          status: 'errored',
          finishedAt: now,
          nextActionAt: null,
          erroredAt: now,
          erroredReason: verdict.reason.slice(0, 500),
        })
        .where(eq(emailAutomationRun.id, run.id));
      result.errored++;
      logger.error('automation.orphan.errored', {
        runId: run.id,
        automationId: run.automationId,
        reason: verdict.reason,
      });
    }
  }

  if (result.scanned > 0) {
    logger.info('automation.orphan.swept', { ...result });
  }
  return result;
}

/**
 * Garde de forme : une ligne « zombie » a un id texte, un automationId, et un
 * `triggeredAt` Date. Sous mocks partiels, les lignes renvoyées peuvent être des
 * automations ou des runs incomplets — on les ignore proprement.
 */
function isZombieRow(row: unknown): row is ZombieRow {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.automationId === 'string' &&
    r.triggeredAt instanceof Date
  );
}

/**
 * Détermine si un run zombie est reconstructible (son étape courante est
 * résoluble) ou doit être erreuré, avec une raison parlante.
 */
async function classifyZombie(
  run: ZombieRow,
): Promise<{ reconstructible: true } | { reconstructible: false; reason: string }> {
  const drizzle = requireDb();

  const [auto] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.id, run.automationId))
    .limit(1);

  if (!auto) {
    return {
      reconstructible: false,
      reason: `orphan: automation ${run.automationId} introuvable (supprimée ?)`,
    };
  }
  if (!auto.active) {
    // Une automation désactivée : on laisse le runner l'annuler proprement au
    // prochain claim (processRun met 'cancelled' si !active). Donc reprise.
    return { reconstructible: true };
  }

  const parsed = automationStepsSchema.safeParse(auto.steps);
  if (!parsed.success) {
    return {
      reconstructible: false,
      reason: `orphan: steps JSON invalide pour automation ${auto.slug} : ${parsed.error.message.slice(0, 200)}`,
    };
  }
  const steps = parsed.data;

  const ctx = run.contextJson ?? {};
  const ctxPath = (ctx as Record<string, unknown>)._path;
  const path: StepPath = isValidPath(ctxPath) ? ctxPath : [run.currentStep];

  const step = getStepAtPath(steps, path);
  if (step === null) {
    // Path hors-borne : le run ne complèterait PAS proprement via reprise (il
    // serait marqué completed par erreur). On préfère une erreur explicite.
    return {
      reconstructible: false,
      reason: `orphan: étape introuvable au path [${path.join(',')}] (steps réordonnés/supprimés ?) pour ${auto.slug}`,
    };
  }

  // branch reste reconstructible : descendToExecutable le résoudra au re-claim.
  return { reconstructible: true };
}
