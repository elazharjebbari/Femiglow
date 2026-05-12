/**
 * Orchestrateur séquentiel — exécute les seeders sélectionnés dans l'ordre du
 * registry, émet les events sur le job-store, log audit, gère cancel.
 */
import { logAuditEvent } from '@/lib/audit/log-event';
import type { SeederDescriptor, SeederEvent, SeederContext } from './types';
import { getJobStore } from './job-store';

interface RunJobInput {
  jobId: string;
  selected: SeederDescriptor[];
  actorId: string;
}

export async function runJob({
  jobId,
  selected,
  actorId,
}: RunJobInput): Promise<void> {
  const store = getJobStore();
  const job = store.get(jobId);
  if (!job) return;

  const totalEtaMs = selected.reduce(
    (sum, s) => sum + s.estimatedDurationMs,
    0,
  );
  const startedAt = Date.now();

  store.setStatus(jobId, 'running');
  emit(jobId, {
    type: 'job.start',
    jobId,
    ts: startedAt,
    ids: selected.map((s) => s.id),
    total: selected.length,
    etaMs: totalEtaMs,
  });

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < selected.length; i += 1) {
    const seeder = selected[i]!;

    if (job.abort.signal.aborted) {
      emit(jobId, {
        type: 'seeder.skipped',
        jobId,
        ts: Date.now(),
        id: seeder.id,
        reason: 'job_cancelled',
      });
      skipped += 1;
      continue;
    }

    const seederStartedAt = Date.now();
    emit(jobId, {
      type: 'seeder.start',
      jobId,
      ts: seederStartedAt,
      id: seeder.id,
      index: i,
      etaMs: seeder.estimatedDurationMs,
    });

    const ctx: SeederContext = {
      actorId,
      signal: job.abort.signal,
      onProgress: (label, fraction) => {
        emit(jobId, {
          type: 'seeder.progress',
          jobId,
          ts: Date.now(),
          id: seeder.id,
          stepLabel: label,
          fraction,
        });
      },
    };

    try {
      const result = await seeder.run(ctx);
      const durationMs = Date.now() - seederStartedAt;
      emit(jobId, {
        type: 'seeder.complete',
        jobId,
        ts: Date.now(),
        id: seeder.id,
        durationMs,
        result,
      });
      succeeded += 1;

      // Audit — un event par seeder réussi.
      try {
        await logAuditEvent({
          action: 'seeders.run',
          actorId,
          resourceType: 'seeder',
          resourceId: seeder.id,
          meta: {
            jobId,
            durationMs,
            stats: result.stats,
            summary: result.summary,
          },
        });
      } catch (auditErr) {
        // On ne fait pas exploser le job si l'audit échoue.
        console.warn('[seeders] audit log failed for', seeder.id, auditErr);
      }
    } catch (err) {
      const durationMs = Date.now() - seederStartedAt;
      const message = err instanceof Error ? err.message : String(err);
      emit(jobId, {
        type: 'seeder.error',
        jobId,
        ts: Date.now(),
        id: seeder.id,
        durationMs,
        message,
      });
      failed += 1;
    }
  }

  const totalDurationMs = Date.now() - startedAt;

  if (job.abort.signal.aborted) {
    store.setStatus(jobId, 'cancelled');
    emit(jobId, {
      type: 'job.cancelled',
      jobId,
      ts: Date.now(),
      cancelledAt: Date.now(),
    });
    return;
  }

  store.setStatus(jobId, failed > 0 ? 'failed' : 'completed');
  emit(jobId, {
    type: 'job.complete',
    jobId,
    ts: Date.now(),
    durationMs: totalDurationMs,
    succeeded,
    failed,
    skipped,
  });
}

function emit(jobId: string, ev: SeederEvent): void {
  getJobStore().emit(jobId, ev);
}
