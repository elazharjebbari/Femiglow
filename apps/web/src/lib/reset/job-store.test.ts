import { describe, it, expect, beforeEach } from 'vitest';
import { getResetJobStore, _resetJobStoreForTests } from './job-store';
import { makePlan } from './planner';
import type { ResetConfig } from './types';

const cfg: ResetConfig = {
  mode: 'soft',
  preserve: ['admin_users', 'audit_events'],
  wipeMedia: false, wipeNextCache: false,
  withBackup: false, keepBackups: 5, dryRun: false,
  confirm: 'RESET', actorId: null,
};

describe('reset/job-store', () => {
  beforeEach(() => { _resetJobStoreForTests(); });

  it('creates a job with id', () => {
    const store = getResetJobStore();
    const job = store.create(cfg, makePlan(cfg), null);
    expect(job.id).toMatch(/^rst_/);
    expect(job.status).toBe('pending');
  });

  it('snapshot returns shape', () => {
    const store = getResetJobStore();
    const job = store.create(cfg, makePlan(cfg), null);
    const snap = store.snapshot(job.id);
    expect(snap?.id).toBe(job.id);
    expect(snap?.events).toEqual([]);
  });

  it('emit appends events', () => {
    const store = getResetJobStore();
    const job = store.create(cfg, makePlan(cfg), null);
    store.emit(job.id, {
      type: 'job.start', jobId: job.id, ts: Date.now(),
      mode: 'soft', plan: makePlan(cfg), etaMs: 1000,
    });
    expect(store.snapshot(job.id)?.events.length).toBe(1);
  });

  it('subscribe is notified', () => {
    const store = getResetJobStore();
    const job = store.create(cfg, makePlan(cfg), null);
    const seen: string[] = [];
    const unsub = store.subscribe(job.id, (ev) => seen.push(ev.type));
    store.emit(job.id, {
      type: 'keepalive', jobId: job.id, ts: Date.now(),
    });
    expect(seen).toEqual(['keepalive']);
    unsub();
  });

  it('event buffer capped at 500', () => {
    const store = getResetJobStore();
    const job = store.create(cfg, makePlan(cfg), null);
    for (let i = 0; i < 600; i += 1) {
      store.emit(job.id, { type: 'keepalive', jobId: job.id, ts: i });
    }
    expect(store.snapshot(job.id)?.events.length).toBe(500);
  });

  it('active() returns null after completed', () => {
    const store = getResetJobStore();
    const job = store.create(cfg, makePlan(cfg), null);
    expect(store.active()?.id).toBe(job.id);
    store.setStatus(job.id, 'completed');
    expect(store.active()).toBeNull();
  });
});
