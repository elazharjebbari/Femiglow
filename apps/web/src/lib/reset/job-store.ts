/**
 * Job store in-memory — singleton qui maintient l'état des jobs Reset.
 * Pattern identique à lib/seeders/job-store.ts.
 */
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import type {
  JobSnapshot,
  JobStatus,
  ResetEvent,
  ResetConfig,
  ResetPlan,
} from './types';

const MAX_BUFFERED_EVENTS = 500;
const JOB_TTL_MS = 60 * 60 * 1000;

export interface JobInternal {
  id: string;
  status: JobStatus;
  config: ResetConfig;
  plan: ResetPlan;
  backupId?: string;
  startedAt: number;
  finishedAt?: number;
  events: ResetEvent[];
  emitter: EventEmitter;
  abort: AbortController;
  actorId: string | null;
}

class ResetJobStore {
  private jobs = new Map<string, JobInternal>();
  private activeId: string | null = null;

  create(config: ResetConfig, plan: ResetPlan, actorId: string | null): JobInternal {
    this.gc();
    const id = `rst_${randomBytes(8).toString('hex')}`;
    const job: JobInternal = {
      id,
      status: 'pending',
      config,
      plan,
      startedAt: Date.now(),
      events: [],
      emitter: new EventEmitter(),
      abort: new AbortController(),
      actorId,
    };
    job.emitter.setMaxListeners(64);
    this.jobs.set(id, job);
    this.activeId = id;
    return job;
  }

  get(id: string): JobInternal | null {
    return this.jobs.get(id) ?? null;
  }

  active(): JobInternal | null {
    if (!this.activeId) return null;
    const j = this.jobs.get(this.activeId);
    if (!j) return null;
    if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
      return null;
    }
    return j;
  }

  snapshot(id: string): JobSnapshot | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      config: job.config,
      plan: job.plan,
      backupId: job.backupId,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      events: [...job.events],
      actorId: job.actorId,
    };
  }

  emit(id: string, ev: ResetEvent): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.events.push(ev);
    if (job.events.length > MAX_BUFFERED_EVENTS) {
      job.events.splice(0, job.events.length - MAX_BUFFERED_EVENTS);
    }
    job.emitter.emit('event', ev);
  }

  setStatus(id: string, status: JobStatus): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      job.finishedAt = Date.now();
      if (this.activeId === id) this.activeId = null;
    }
  }

  setBackupId(id: string, backupId: string): void {
    const job = this.jobs.get(id);
    if (job) job.backupId = backupId;
  }

  subscribe(id: string, listener: (ev: ResetEvent) => void): () => void {
    const job = this.jobs.get(id);
    if (!job) return () => {};
    job.emitter.on('event', listener);
    return () => job.emitter.off('event', listener);
  }

  private gc(): void {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs) {
      const finished = job.finishedAt ?? job.startedAt;
      if (finished < cutoff) {
        job.emitter.removeAllListeners();
        this.jobs.delete(id);
        if (this.activeId === id) this.activeId = null;
      }
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __femiglowResetJobStore: ResetJobStore | undefined;
}

export function getResetJobStore(): ResetJobStore {
  if (!globalThis.__femiglowResetJobStore) {
    globalThis.__femiglowResetJobStore = new ResetJobStore();
  }
  return globalThis.__femiglowResetJobStore;
}

// For tests
export function _resetJobStoreForTests(): void {
  globalThis.__femiglowResetJobStore = undefined;
}
