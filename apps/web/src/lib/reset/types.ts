/**
 * Types — Reset feature
 *
 * Cf. docs/reset-feature/03-design-backend.md
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type ResetMode = 'soft' | 'medium' | 'hard' | 'custom';

export type ResetDomain =
  | 'commerce'
  | 'content'
  | 'tracking'
  | 'chat'
  | 'system';

export type PreservableTable =
  | 'admin_users'
  | 'audit_events'
  | 'orders'
  | 'order_items'
  | 'leads'
  | 'lead_events'
  | 'chat_lead'
  | 'ritual_testimonials'
  | 'ritual_testimonial_photos'
  | 'ritual_audit_log';

export interface ResetConfig {
  mode: ResetMode;
  domains?: ResetDomain[];
  preserve: PreservableTable[];
  wipeMedia: boolean;
  wipeNextCache: boolean;
  withBackup: boolean;
  keepBackups: number;
  dryRun: boolean;
  confirm: 'RESET' | 'HARD RESET';
  nonInteractive?: boolean;
  actorId: string | null;
}

export type PhaseName =
  | 'preflight'
  | 'backup'
  | 'audit-counts'
  | 'wipe-db'
  | 'wipe-media'
  | 'wipe-cache'
  | 'migrate'
  | 'ensure-admin'
  | 'seed'
  | 'publish-components'
  | 'verify'
  | 'cleanup-backups';

export interface PhaseDescriptor {
  name: PhaseName;
  label: string;
  /** if true, failure triggers rollback (when applicable) and stops the run */
  critical: boolean;
  /** if true, this phase performs destructive action (used to gate rollback) */
  destructive: boolean;
  estimatedDurationMs: number;
}

export type DbStrategy = 'none' | 'truncate' | 'drop-schema';

export interface ResetPlan {
  mode: ResetMode;
  phases: PhaseDescriptor[];
  dbStrategy: DbStrategy;
  truncateTables: string[];
  preserveTables: PreservableTable[];
  seederIds: string[];
  totalEtaMs: number;
}

export interface RowCountsSnapshot {
  takenAt: number;
  counts: Record<string, number>;
}

export interface BackupResult {
  backupId: string;
  dir: string;
  dbSize: number;
  mediaSize: number;
  takenAt: string;
  manifest: BackupManifest;
}

export interface BackupManifest {
  backupId: string;
  version: '1.0.0';
  takenAt: string;
  mode: ResetMode;
  actorId: string | null;
  actorEmail?: string | null;
  gitCommit?: string;
  gitBranch?: string;
  db: {
    size: number;
    sha256: string;
    path: string;
    dumpedFrom: string;
  };
  media: {
    size: number;
    sha256: string;
    path: string;
    dirCount: number;
    fileCount: number;
  } | null;
  preReset: {
    tables: number;
    rows: Record<string, number>;
  } | null;
  envSnapshot: {
    NODE_ENV: string;
    DATABASE_URL_hash: string;
    MEDIA_LOCAL_DIR: string;
  };
}

export interface PhaseContext {
  config: ResetConfig;
  plan: ResetPlan;
  backupId?: string;
  before?: RowCountsSnapshot;
  signal: AbortSignal;
  onProgress?: (label: string, fraction?: number) => void;
  onLog?: (entry: LogEntry) => void;
}

export interface PhaseResult {
  stats: Record<string, JsonValue>;
  summary: string;
  warnings?: string[];
}

export interface LogEntry {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  meta?: Record<string, JsonValue>;
}

// ─── Events ───────────────────────────────────────────────────────────────

interface BaseEvent {
  ts: number;
  jobId: string;
}

export type ResetEvent =
  | (BaseEvent & {
      type: 'job.start';
      mode: ResetMode;
      plan: ResetPlan;
      etaMs: number;
    })
  | (BaseEvent & {
      type: 'phase.start';
      phase: PhaseName;
      label: string;
      index: number;
      total: number;
      estimatedMs: number;
    })
  | (BaseEvent & {
      type: 'phase.progress';
      phase: PhaseName;
      label: string;
      fraction?: number;
    })
  | (BaseEvent & {
      type: 'phase.complete';
      phase: PhaseName;
      durationMs: number;
      summary: string;
      stats: Record<string, JsonValue>;
      warnings?: string[];
    })
  | (BaseEvent & {
      type: 'phase.error';
      phase: PhaseName;
      durationMs: number;
      error: ClassifiedError;
    })
  | (BaseEvent & {
      type: 'rollback.start';
      backupId: string;
      reason: string;
    })
  | (BaseEvent & {
      type: 'rollback.progress';
      fraction: number;
      label: string;
    })
  | (BaseEvent & {
      type: 'rollback.complete';
      backupId: string;
      durationMs: number;
      restored: { db: boolean; media: boolean };
    })
  | (BaseEvent & {
      type: 'rollback.failed';
      errorCode: string;
      message: string;
    })
  | (BaseEvent & {
      type: 'job.complete';
      durationMs: number;
      summary: ResetSummary;
    })
  | (BaseEvent & {
      type: 'job.failed';
      durationMs: number;
      errorCode: string;
      phaseFailed: PhaseName;
      rolledBack: boolean;
      message: string;
    })
  | (BaseEvent & {
      type: 'job.cancelled';
      cancelledAt: number;
    })
  | (BaseEvent & {
      type: 'keepalive';
    });

export type ResetEventType = ResetEvent['type'];

export interface ClassifiedError {
  code: string;
  message: string;
  critical: boolean;
  phase?: PhaseName | 'pre';
  cause?: string;
  meta?: Record<string, JsonValue>;
}

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  config: ResetConfig;
  plan: ResetPlan;
  backupId?: string;
  startedAt: number;
  finishedAt?: number;
  events: ResetEvent[];
  actorId: string | null;
}

export interface ResetSummary {
  mode: ResetMode;
  durationMs: number;
  backupId?: string;
  phasesCompleted: PhaseName[];
  phasesFailed: PhaseName[];
  rowCountsBefore?: Record<string, number>;
  rowCountsAfter?: Record<string, number>;
  seedersReport?: {
    completed: number;
    failed: number;
    skipped: number;
  };
  verify?: {
    passed: number;
    failed: number;
    warnings: number;
    checks: VerificationCheck[];
  };
  warnings: string[];
}

export interface VerificationCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  critical: boolean;
  message?: string;
}

export interface ResetReport {
  status: 'completed' | 'failed' | 'cancelled';
  summary: ResetSummary;
  error?: ClassifiedError;
  rolledBack?: boolean;
}

// ─── Constants — preserved tables ALWAYS ──────────────────────────────────

export const ALWAYS_PRESERVED: PreservableTable[] = [
  'admin_users',
  'audit_events',
];
