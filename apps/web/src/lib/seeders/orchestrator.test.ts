/**
 * Tests de l'orchestrateur — exécute des seeders factices pour vérifier la
 * séquentialité, la gestion d'erreur, et l'annulation.
 *
 * On mock `logAuditEvent` pour ne pas toucher la DB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runJob } from './orchestrator';
import { getJobStore } from './job-store';
import type { SeederDescriptor, SeederEvent } from './types';

vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeSeeder(
  id: string,
  opts: {
    delayMs?: number;
    fail?: boolean;
    estimatedDurationMs?: number;
    onRun?: () => void;
  } = {},
): SeederDescriptor {
  return {
    id,
    group: 'core',
    label: `Seeder ${id}`,
    description: 'test',
    estimatedDurationMs: opts.estimatedDurationMs ?? 100,
    idempotent: true,
    async run() {
      opts.onRun?.();
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail) throw new Error(`${id} boom`);
      return { stats: { ok: 1 }, summary: `${id} done` };
    },
  };
}

describe('seeders/orchestrator', () => {
  beforeEach(() => {
    delete (globalThis as { __femiglowSeederJobStore?: unknown })
      .__femiglowSeederJobStore;
  });

  it('exécute séquentiellement et émet la séquence d’events attendue', async () => {
    const store = getJobStore();
    const job = store.create(['a', 'b'], 'admin-1');
    const seeders = [makeSeeder('a'), makeSeeder('b')];

    await runJob({ jobId: job.id, selected: seeders, actorId: 'admin-1' });

    const snap = store.snapshot(job.id)!;
    expect(snap.status).toBe('completed');
    const types = snap.events.map((e) => e.type);
    // job.start, seeder.start, seeder.complete, seeder.start, seeder.complete, job.complete
    expect(types).toEqual([
      'job.start',
      'seeder.start',
      'seeder.complete',
      'seeder.start',
      'seeder.complete',
      'job.complete',
    ]);
  });

  it('un seeder qui throw produit seeder.error + status=failed', async () => {
    const store = getJobStore();
    const job = store.create(['a'], 'admin-1');
    const seeders = [makeSeeder('a', { fail: true })];

    await runJob({ jobId: job.id, selected: seeders, actorId: 'admin-1' });

    const snap = store.snapshot(job.id)!;
    expect(snap.status).toBe('failed');
    const errorEvent = snap.events.find(
      (e): e is Extract<SeederEvent, { type: 'seeder.error' }> =>
        e.type === 'seeder.error',
    );
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.message).toBe('a boom');
    expect(snap.events.find((e) => e.type === 'job.complete')).toBeDefined();
  });

  it('continue sur le suivant après une erreur', async () => {
    const store = getJobStore();
    const job = store.create(['a', 'b'], 'admin-1');
    const seedB = vi.fn(() => {});
    const seeders = [
      makeSeeder('a', { fail: true }),
      makeSeeder('b', { onRun: seedB }),
    ];

    await runJob({ jobId: job.id, selected: seeders, actorId: 'admin-1' });

    expect(seedB).toHaveBeenCalled();
    const snap = store.snapshot(job.id)!;
    const completeEvent = snap.events.find(
      (e): e is Extract<SeederEvent, { type: 'job.complete' }> =>
        e.type === 'job.complete',
    );
    expect(completeEvent!.succeeded).toBe(1);
    expect(completeEvent!.failed).toBe(1);
  });

  it('annulation : skip les seeders restants avec seeder.skipped + status=cancelled', async () => {
    const store = getJobStore();
    const job = store.create(['a', 'b', 'c'], 'admin-1');
    // a démarre immédiatement, on l'annule avant b.
    const seedB = vi.fn(() => {});
    const seedC = vi.fn(() => {});
    const seeders = [
      makeSeeder('a', {
        delayMs: 10,
        onRun: () => {
          // annule pendant l'exécution de a → b et c seront skipped
          setTimeout(() => job.abort.abort(), 1);
        },
      }),
      makeSeeder('b', { onRun: seedB }),
      makeSeeder('c', { onRun: seedC }),
    ];

    await runJob({ jobId: job.id, selected: seeders, actorId: 'admin-1' });

    expect(seedB).not.toHaveBeenCalled();
    expect(seedC).not.toHaveBeenCalled();
    const snap = store.snapshot(job.id)!;
    expect(snap.status).toBe('cancelled');
    const skipped = snap.events.filter((e) => e.type === 'seeder.skipped');
    expect(skipped.length).toBe(2);
  });

  it('job.start.etaMs == somme des estimatedDurationMs', async () => {
    const store = getJobStore();
    const job = store.create(['a', 'b'], 'admin-1');
    const seeders = [
      makeSeeder('a', { estimatedDurationMs: 500 }),
      makeSeeder('b', { estimatedDurationMs: 250 }),
    ];

    await runJob({ jobId: job.id, selected: seeders, actorId: 'admin-1' });

    const snap = store.snapshot(job.id)!;
    const startEvent = snap.events.find(
      (e): e is Extract<SeederEvent, { type: 'job.start' }> =>
        e.type === 'job.start',
    );
    expect(startEvent!.etaMs).toBe(750);
  });

  it('propage les events de progression intra-seeder via ctx.onProgress', async () => {
    const store = getJobStore();
    const job = store.create(['a'], 'admin-1');
    const seeder: SeederDescriptor = {
      id: 'a',
      group: 'core',
      label: 'a',
      description: 'x',
      estimatedDurationMs: 50,
      idempotent: true,
      async run(ctx) {
        ctx.onProgress?.('étape 1', 0.3);
        ctx.onProgress?.('étape 2', 0.7);
        return { stats: {}, summary: 'ok' };
      },
    };

    await runJob({ jobId: job.id, selected: [seeder], actorId: 'admin-1' });

    const snap = store.snapshot(job.id)!;
    const progress = snap.events.filter(
      (e): e is Extract<SeederEvent, { type: 'seeder.progress' }> =>
        e.type === 'seeder.progress',
    );
    expect(progress.length).toBe(2);
    expect(progress[0]!.stepLabel).toBe('étape 1');
    expect(progress[0]!.fraction).toBe(0.3);
    expect(progress[1]!.fraction).toBe(0.7);
  });
});
