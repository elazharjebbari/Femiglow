/**
 * Job store in-memory — un Singleton qui maintient l'état des jobs Seeders
 * Runner. Pas de persistance disque : un restart serveur perd les jobs
 * passés, ce qui est acceptable (les seeders sont idempotents, on peut
 * relancer).
 *
 * Pourquoi pas Redis/queue ? Le besoin est limité à un seul host Next.js,
 * exécution séquentielle, audience admin uniquement. Garder simple.
 */
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import type { JobSnapshot, JobStatus, SeederEvent } from './types';

const MAX_BUFFERED_EVENTS = 500;
const JOB_TTL_MS = 60 * 60 * 1000; // 1 h

interface JobInternal {
  id: string;
  status: JobStatus;
  selected: string[];
  startedAt: number;
  finishedAt?: number;
  events: SeederEvent[];
  emitter: EventEmitter;
  abort: AbortController;
  actorId: string;
}

class JobStore {
  private jobs = new Map<string, JobInternal>();

  create(selected: string[], actorId: string): JobInternal {
    this.gc();
    const id = `job_${randomBytes(8).toString('hex')}`;
    const job: JobInternal = {
      id,
      status: 'pending',
      selected,
      startedAt: Date.now(),
      events: [],
      emitter: new EventEmitter(),
      // 32 listeners par défaut suffisent (1 par client SSE).
      abort: new AbortController(),
      actorId,
    };
    job.emitter.setMaxListeners(64);
    this.jobs.set(id, job);
    return job;
  }

  get(id: string): JobInternal | null {
    return this.jobs.get(id) ?? null;
  }

  snapshot(id: string): JobSnapshot | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      selected: job.selected,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      events: [...job.events],
      actorId: job.actorId,
    };
  }

  emit(id: string, ev: SeederEvent): void {
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
    if (
      status === 'completed' ||
      status === 'failed' ||
      status === 'cancelled'
    ) {
      job.finishedAt = Date.now();
    }
  }

  /** Subscribe an SSE consumer; returns an unsubscribe fn. */
  subscribe(id: string, listener: (ev: SeederEvent) => void): () => void {
    const job = this.jobs.get(id);
    if (!job) return () => {};
    job.emitter.on('event', listener);
    return () => {
      job.emitter.off('event', listener);
    };
  }

  /** Garbage-collect old jobs to keep memory bounded. */
  private gc(): void {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs) {
      const finished = job.finishedAt ?? job.startedAt;
      if (finished < cutoff) {
        job.emitter.removeAllListeners();
        this.jobs.delete(id);
      }
    }
  }
}

// Singleton — on attache à `globalThis` pour survivre aux HMR en dev.
declare global {
  // eslint-disable-next-line no-var
  var __femiglowSeederJobStore: JobStore | undefined;
}

export function getJobStore(): JobStore {
  if (!globalThis.__femiglowSeederJobStore) {
    globalThis.__femiglowSeederJobStore = new JobStore();
  }
  return globalThis.__femiglowSeederJobStore;
}
