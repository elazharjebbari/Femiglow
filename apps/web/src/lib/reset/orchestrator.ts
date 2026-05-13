/**
 * Orchestrator — exécute les phases dans l'ordre, gère cancel + rollback + audit.
 * Cf. docs/reset-feature/03-design-backend.md § Orchestrator
 */
import type {
  ResetConfig, ResetReport, ResetPlan, PhaseContext, PhaseName,
  PhaseResult, ResetEvent, RowCountsSnapshot, ResetSummary,
  ClassifiedError,
} from './types';
import { makePlan } from './planner';
import { getResetJobStore } from './job-store';
import { acquireLock, releaseLock } from './lock';
import { classifyError, ResetError } from './errors';
import { logAuditEvent } from '@/lib/audit/log-event';

import { runPreflight } from './phases/preflight';
import { runBackup } from './phases/backup';
import { runAuditCounts } from './phases/audit-counts';
import { runWipeDb } from './phases/wipe-db';
import { runWipeMedia } from './phases/wipe-media';
import { runWipeCache } from './phases/wipe-cache';
import { runMigrate } from './phases/migrate';
import { runSeed } from './phases/seed';
import { runEnsureAdmin } from './phases/ensure-admin';
import { runPublishComponents } from './phases/publish-components';
import { runVerify } from './phases/verify';
import { runCleanupBackups } from './phases/cleanup-backups';
import { restoreFromBackup } from './restore';

const PHASE_FN: Record<PhaseName, (ctx: PhaseContext) => Promise<PhaseResult>> = {
  preflight: runPreflight,
  backup: runBackup,
  'audit-counts': runAuditCounts,
  'wipe-db': runWipeDb,
  'wipe-media': runWipeMedia,
  'wipe-cache': runWipeCache,
  migrate: runMigrate,
  'ensure-admin': runEnsureAdmin,
  seed: runSeed,
  'publish-components': runPublishComponents,
  verify: runVerify,
  'cleanup-backups': runCleanupBackups,
};

export interface StartResetInput {
  config: ResetConfig;
  /** plan precomputed to allow preflight in caller before running */
  plan?: ResetPlan;
}

export interface StartedReset {
  jobId: string;
  plan: ResetPlan;
}

/**
 * Crée un job, acquière le lock, démarre l'orchestration en arrière-plan,
 * retourne immédiatement le jobId.
 */
export function startReset(input: StartResetInput): StartedReset {
  const plan = input.plan ?? makePlan(input.config);
  const store = getResetJobStore();
  const job = store.create(input.config, plan, input.config.actorId);
  if (!acquireLock(job.id)) {
    throw new ResetError('LOCK_HELD', 'pre', 'Un reset est déjà en cours');
  }
  // Fire-and-forget
  runReset(job.id).catch((err) => {
    console.error('[reset] orchestrator unexpected throw', err);
  });
  return { jobId: job.id, plan };
}

export async function runReset(jobId: string): Promise<ResetReport> {
  const store = getResetJobStore();
  const job = store.get(jobId);
  if (!job) {
    return {
      status: 'failed',
      summary: emptySummary(),
      error: { code: 'UNKNOWN', message: 'job not found', critical: true },
    };
  }

  const { config, plan } = job;
  const startedAt = Date.now();
  store.setStatus(jobId, 'running');
  emit(jobId, {
    type: 'job.start', jobId, ts: startedAt,
    mode: config.mode, plan, etaMs: plan.totalEtaMs,
  });

  let backupId: string | undefined;
  let before: RowCountsSnapshot | undefined;
  const phasesCompleted: PhaseName[] = [];
  const phasesFailed: PhaseName[] = [];
  let hasReachedDestructive = false;
  const warnings: string[] = [];
  let lastError: ClassifiedError | null = null;
  let seedersReport: ResetSummary['seedersReport'];
  let verifyReport: ResetSummary['verify'];
  let rowCountsAfter: Record<string, number> | undefined;

  for (let i = 0; i < plan.phases.length; i += 1) {
    if (job.abort.signal.aborted) {
      store.setStatus(jobId, 'cancelled');
      emit(jobId, { type: 'job.cancelled', jobId, ts: Date.now(), cancelledAt: Date.now() });
      releaseLock(jobId);
      return { status: 'cancelled', summary: makeSummary({ config, plan, startedAt, phasesCompleted, phasesFailed, backupId, before, warnings, seedersReport, verifyReport, rowCountsAfter }) };
    }

    const phase = plan.phases[i]!;
    if (phase.destructive) hasReachedDestructive = true;

    const phaseStarted = Date.now();
    emit(jobId, {
      type: 'phase.start', jobId, ts: phaseStarted,
      phase: phase.name, label: phase.label, index: i,
      total: plan.phases.length, estimatedMs: phase.estimatedDurationMs,
    });

    const ctx: PhaseContext = {
      config, plan,
      backupId,
      before,
      signal: job.abort.signal,
      onProgress: (label, fraction) => {
        emit(jobId, {
          type: 'phase.progress', jobId, ts: Date.now(),
          phase: phase.name, label, fraction,
        });
      },
    };

    try {
      const result = await PHASE_FN[phase.name](ctx);
      const durationMs = Date.now() - phaseStarted;

      // capture des résultats inter-phase
      if (phase.name === 'backup') {
        backupId = result.stats?.backupId as string | undefined;
        if (backupId) store.setBackupId(jobId, backupId);
      }
      if (phase.name === 'audit-counts') {
        const counts = result.stats?.counts as Record<string, number> | undefined;
        before = counts ? { takenAt: Date.now(), counts } : before;
      }
      if (phase.name === 'seed') {
        seedersReport = {
          completed: Number(result.stats?.completed ?? 0),
          failed: Number(result.stats?.failed ?? 0),
          skipped: 0,
        };
      }
      if (phase.name === 'verify') {
        const checks = (result.stats?.checks as unknown as Array<{ status: string }> | undefined) ?? [];
        verifyReport = {
          passed: Number(result.stats?.passed ?? 0),
          failed: Number(result.stats?.failed ?? 0),
          warnings: Number(result.stats?.warnings ?? 0),
          checks: checks as unknown as NonNullable<ResetSummary['verify']>['checks'],
        };
      }
      if (result.warnings?.length) warnings.push(...result.warnings);

      emit(jobId, {
        type: 'phase.complete', jobId, ts: Date.now(),
        phase: phase.name, durationMs,
        summary: result.summary, stats: result.stats, warnings: result.warnings,
      });
      phasesCompleted.push(phase.name);

      // Audit (best-effort)
      logAuditEvent({
        action: `reset.${phase.name}`,
        actorId: config.actorId ?? null,
        resourceType: 'reset',
        resourceId: jobId,
        meta: {
          jobId, durationMs, summary: result.summary, mode: config.mode,
          stats: result.stats as Record<string, unknown>,
        },
      }).catch(() => { /* swallow */ });

    } catch (err) {
      const durationMs = Date.now() - phaseStarted;
      const classified = classifyError(err, phase.name);
      lastError = classified;
      phasesFailed.push(phase.name);

      emit(jobId, {
        type: 'phase.error', jobId, ts: Date.now(),
        phase: phase.name, durationMs, error: classified,
      });

      // Audit le fail aussi
      logAuditEvent({
        action: `reset.${phase.name}.failed`,
        actorId: config.actorId ?? null,
        resourceType: 'reset',
        resourceId: jobId,
        meta: { jobId, durationMs, errorCode: classified.code, message: classified.message },
      }).catch(() => { /* swallow */ });

      if (phase.critical && classified.critical) {
        let rolledBack = false;
        if (backupId && hasReachedDestructive && phase.name !== 'backup') {
          emit(jobId, {
            type: 'rollback.start', jobId, ts: Date.now(),
            backupId, reason: `phase ${phase.name} failed: ${classified.message}`,
          });
          try {
            const t0 = Date.now();
            const restored = await restoreFromBackup(backupId, {
              restoreDb: phasesCompleted.includes('wipe-db'),
              restoreMedia: phasesCompleted.includes('wipe-media'),
              onProgress: (label, fraction) => {
                emit(jobId, {
                  type: 'rollback.progress', jobId, ts: Date.now(),
                  fraction, label,
                });
              },
            });
            rolledBack = true;
            emit(jobId, {
              type: 'rollback.complete', jobId, ts: Date.now(),
              backupId, durationMs: Date.now() - t0,
              restored,
            });
          } catch (rbErr) {
            const rbClassified = classifyError(rbErr, phase.name);
            emit(jobId, {
              type: 'rollback.failed', jobId, ts: Date.now(),
              errorCode: rbClassified.code, message: rbClassified.message,
            });
          }
        }

        store.setStatus(jobId, 'failed');
        emit(jobId, {
          type: 'job.failed', jobId, ts: Date.now(),
          durationMs: Date.now() - startedAt,
          errorCode: classified.code, phaseFailed: phase.name,
          rolledBack, message: classified.message,
        });

        releaseLock(jobId);
        return {
          status: 'failed',
          summary: makeSummary({ config, plan, startedAt, phasesCompleted, phasesFailed, backupId, before, warnings, seedersReport, verifyReport, rowCountsAfter }),
          error: classified,
          rolledBack,
        };
      }
      // non-critique: continue
    }
  }

  const finalSummary = makeSummary({
    config, plan, startedAt, phasesCompleted, phasesFailed,
    backupId, before, warnings, seedersReport, verifyReport, rowCountsAfter,
  });

  store.setStatus(jobId, 'completed');
  emit(jobId, {
    type: 'job.complete', jobId, ts: Date.now(),
    durationMs: Date.now() - startedAt, summary: finalSummary,
  });

  logAuditEvent({
    action: 'reset.run.complete',
    actorId: config.actorId ?? null,
    resourceType: 'reset',
    resourceId: jobId,
    meta: {
      jobId, mode: config.mode,
      durationMs: Date.now() - startedAt,
      summary: finalSummary as unknown as Record<string, unknown>,
    },
  }).catch(() => { /* swallow */ });

  releaseLock(jobId);
  void lastError; // currently unused in success path
  return { status: 'completed', summary: finalSummary };
}

function emit(jobId: string, ev: ResetEvent): void {
  getResetJobStore().emit(jobId, ev);
}

function makeSummary(args: {
  config: ResetConfig;
  plan: ResetPlan;
  startedAt: number;
  phasesCompleted: PhaseName[];
  phasesFailed: PhaseName[];
  backupId?: string;
  before?: RowCountsSnapshot;
  warnings: string[];
  seedersReport?: ResetSummary['seedersReport'];
  verifyReport?: ResetSummary['verify'];
  rowCountsAfter?: Record<string, number>;
}): ResetSummary {
  return {
    mode: args.config.mode,
    durationMs: Date.now() - args.startedAt,
    backupId: args.backupId,
    phasesCompleted: args.phasesCompleted,
    phasesFailed: args.phasesFailed,
    rowCountsBefore: args.before?.counts,
    rowCountsAfter: args.rowCountsAfter,
    seedersReport: args.seedersReport,
    verify: args.verifyReport,
    warnings: args.warnings,
  };
}

function emptySummary(): ResetSummary {
  return {
    mode: 'soft',
    durationMs: 0,
    phasesCompleted: [],
    phasesFailed: [],
    warnings: [],
  };
}
