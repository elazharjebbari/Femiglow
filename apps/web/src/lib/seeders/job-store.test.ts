/**
 * Tests du JobStore — in-memory, pas d'I/O.
 *
 * Vérifie : création, snapshot, emit, subscribe, abort, status transitions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getJobStore } from './job-store';
import type { SeederEvent } from './types';

describe('seeders/job-store', () => {
  beforeEach(() => {
    // Reset le singleton pour isolation entre tests.
    delete (globalThis as { __femiglowSeederJobStore?: unknown })
      .__femiglowSeederJobStore;
  });

  it('crée un job avec id unique préfixé', () => {
    const store = getJobStore();
    const a = store.create(['seo'], 'admin-1');
    const b = store.create(['products'], 'admin-1');
    expect(a.id).toMatch(/^job_[a-f0-9]+$/);
    expect(b.id).toMatch(/^job_[a-f0-9]+$/);
    expect(a.id).not.toBe(b.id);
    expect(a.status).toBe('pending');
    expect(a.actorId).toBe('admin-1');
    expect(a.selected).toEqual(['seo']);
  });

  it('snapshot retourne une vue immutable', () => {
    const store = getJobStore();
    const job = store.create(['seo'], 'admin-1');
    const snap = store.snapshot(job.id);
    expect(snap).not.toBeNull();
    expect(snap!.id).toBe(job.id);
    expect(snap!.events).toHaveLength(0);

    // Une mutation post-snapshot ne doit pas affecter le snap.
    store.emit(job.id, {
      type: 'job.start',
      jobId: job.id,
      ts: Date.now(),
      ids: ['seo'],
      total: 1,
      etaMs: 1000,
    });
    expect(snap!.events).toHaveLength(0);
    const snap2 = store.snapshot(job.id);
    expect(snap2!.events).toHaveLength(1);
  });

  it('snapshot null si job inconnu', () => {
    const store = getJobStore();
    expect(store.snapshot('job_unknown')).toBeNull();
  });

  it('emit notifie les abonnés', () => {
    const store = getJobStore();
    const job = store.create(['seo'], 'admin-1');
    const received: SeederEvent[] = [];
    const unsub = store.subscribe(job.id, (ev) => received.push(ev));

    const ev: SeederEvent = {
      type: 'seeder.start',
      jobId: job.id,
      ts: 0,
      id: 'seo',
      index: 0,
      etaMs: 100,
    };
    store.emit(job.id, ev);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(ev);

    unsub();
    store.emit(job.id, ev);
    expect(received).toHaveLength(1);
  });

  it('plusieurs abonnés reçoivent en parallèle', () => {
    const store = getJobStore();
    const job = store.create(['seo'], 'admin-1');
    const a: SeederEvent[] = [];
    const b: SeederEvent[] = [];
    store.subscribe(job.id, (ev) => a.push(ev));
    store.subscribe(job.id, (ev) => b.push(ev));

    store.emit(job.id, {
      type: 'job.start',
      jobId: job.id,
      ts: 0,
      ids: ['seo'],
      total: 1,
      etaMs: 1,
    });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('setStatus → completed/failed/cancelled définit finishedAt', () => {
    const store = getJobStore();
    const job = store.create(['seo'], 'admin-1');
    store.setStatus(job.id, 'running');
    expect(store.snapshot(job.id)!.finishedAt).toBeUndefined();

    store.setStatus(job.id, 'completed');
    expect(store.snapshot(job.id)!.finishedAt).toBeDefined();
  });

  it('abort.signal est aborted après abort()', () => {
    const store = getJobStore();
    const job = store.create(['seo'], 'admin-1');
    expect(job.abort.signal.aborted).toBe(false);
    job.abort.abort();
    expect(job.abort.signal.aborted).toBe(true);
  });

  it('buffer events bornés (≤500)', () => {
    const store = getJobStore();
    const job = store.create(['seo'], 'admin-1');
    for (let i = 0; i < 600; i++) {
      store.emit(job.id, {
        type: 'seeder.progress',
        jobId: job.id,
        ts: i,
        id: 'seo',
        stepLabel: `step ${i}`,
      });
    }
    const snap = store.snapshot(job.id);
    expect(snap!.events.length).toBeLessThanOrEqual(500);
  });
});
