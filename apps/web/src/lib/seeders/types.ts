/**
 * Types du Seeders Runner.
 *
 * Cf. `.claude/RUNBOOK-seeders-runner.md` — un seul orchestrateur exécute
 * séquentiellement N seeders sélectionnés par l'admin et émet une suite
 * d'événements consommés en SSE par l'UI.
 */

export type SeederGroup = 'core' | 'commerce' | 'content' | 'chat' | 'tracking';

export interface SeederContext {
  /** Identifiant admin (audit) — peut être null si seed via boot. */
  actorId: string | null;
  /** Callback de progression intra-seeder (optionnel). */
  onProgress?: (label: string, fraction?: number) => void;
  /** Signal d'annulation. Les seeders longue durée doivent le respecter. */
  signal: AbortSignal;
}

export interface SeederResult {
  /** Petite carte de stats à afficher : ex `{ inserted: 12, updated: 3 }`. */
  stats: Record<string, number | string>;
  /** Message court humain — ex `« 13 overrides upserted »`. */
  summary: string;
}

export interface SeederDescriptor {
  /** ID stable, sera affiché dans l'URL ?ids=. */
  id: string;
  group: SeederGroup;
  label: string;
  description: string;
  /** Estimation milliseconds — sert au calcul ETA. */
  estimatedDurationMs: number;
  /** Si false, prévenir l'admin (modale de confirmation côté UI). */
  idempotent: boolean;
  run: (ctx: SeederContext) => Promise<SeederResult>;
}

// ───────────────────────────────────────────────────────────────────────────
// Events stream — typés discriminés pour faciliter le consumer SSE côté UI.
// ───────────────────────────────────────────────────────────────────────────

interface BaseEvent {
  ts: number;
  jobId: string;
}

export type SeederEvent =
  | (BaseEvent & {
      type: 'job.start';
      ids: string[];
      total: number;
      etaMs: number;
    })
  | (BaseEvent & {
      type: 'seeder.start';
      id: string;
      index: number; // 0-based
      etaMs: number;
    })
  | (BaseEvent & {
      type: 'seeder.progress';
      id: string;
      stepLabel: string;
      fraction?: number;
    })
  | (BaseEvent & {
      type: 'seeder.complete';
      id: string;
      durationMs: number;
      result: SeederResult;
    })
  | (BaseEvent & {
      type: 'seeder.error';
      id: string;
      durationMs: number;
      message: string;
    })
  | (BaseEvent & {
      type: 'seeder.skipped';
      id: string;
      reason: string;
    })
  | (BaseEvent & {
      type: 'job.complete';
      durationMs: number;
      succeeded: number;
      failed: number;
      skipped: number;
    })
  | (BaseEvent & {
      type: 'job.cancelled';
      cancelledAt: number;
    });

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  selected: string[];
  startedAt: number;
  finishedAt?: number;
  events: SeederEvent[];
  actorId: string;
}
