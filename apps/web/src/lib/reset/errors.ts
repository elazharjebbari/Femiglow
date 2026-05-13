/**
 * Taxonomie d'erreurs Reset — cf. docs/reset-feature/10-error-taxonomy.md
 */
import type { ClassifiedError, PhaseName, JsonValue } from './types';

export type ResetErrorCode =
  // Preflight
  | 'AUTH_REQUIRED' | 'AUTH_INSUFFICIENT' | 'LOCK_HELD' | 'RATE_LIMIT_EXCEEDED'
  | 'CONFIRM_TEXT_MISMATCH' | 'CONFIG_INVALID'
  | 'DB_UNREACHABLE' | 'DB_LOCKS_HELD' | 'DISK_LOW' | 'BOOTSTRAP_ENV_MISSING'
  | 'MEDIA_DIR_NOT_WRITABLE' | 'GIT_DIRTY'
  // Backup
  | 'BACKUP_PG_DUMP_FAILED' | 'BACKUP_TAR_FAILED'
  | 'BACKUP_TOO_SMALL' | 'BACKUP_SHA256_FAILED'
  // Destructive
  | 'WIPE_DB_TRANSACTION_FAILED' | 'WIPE_MEDIA_FAILED'
  | 'MIGRATE_FAILED' | 'MIGRATE_TIMEOUT'
  | 'SEED_FAILED' | 'SEED_CONTRACT_BROKEN'
  | 'VERIFY_FAILED'
  // Rollback
  | 'ROLLBACK_DB_FAILED' | 'ROLLBACK_MEDIA_FAILED'
  | 'ROLLBACK_BACKUP_MISSING' | 'ROLLBACK_SHA256_MISMATCH'
  // Misc
  | 'CANCELLED' | 'UNKNOWN';

const CRITICAL_BY_CODE: Record<ResetErrorCode, boolean> = {
  AUTH_REQUIRED: true, AUTH_INSUFFICIENT: true, LOCK_HELD: true,
  RATE_LIMIT_EXCEEDED: true, CONFIRM_TEXT_MISMATCH: true, CONFIG_INVALID: true,
  DB_UNREACHABLE: true, DB_LOCKS_HELD: false, DISK_LOW: true,
  BOOTSTRAP_ENV_MISSING: true, MEDIA_DIR_NOT_WRITABLE: true, GIT_DIRTY: false,
  BACKUP_PG_DUMP_FAILED: true, BACKUP_TAR_FAILED: true,
  BACKUP_TOO_SMALL: true, BACKUP_SHA256_FAILED: true,
  WIPE_DB_TRANSACTION_FAILED: true, WIPE_MEDIA_FAILED: false,
  MIGRATE_FAILED: true, MIGRATE_TIMEOUT: true,
  SEED_FAILED: false, SEED_CONTRACT_BROKEN: true,
  VERIFY_FAILED: false,
  ROLLBACK_DB_FAILED: true, ROLLBACK_MEDIA_FAILED: true,
  ROLLBACK_BACKUP_MISSING: true, ROLLBACK_SHA256_MISMATCH: true,
  CANCELLED: true, UNKNOWN: true,
};

export class ResetError extends Error {
  constructor(
    public readonly code: ResetErrorCode,
    public readonly phase: PhaseName | 'pre',
    message: string,
    public override readonly cause?: unknown,
    public readonly meta?: Record<string, JsonValue>,
  ) {
    super(message);
    this.name = 'ResetError';
  }
}

export function isResetError(e: unknown): e is ResetError {
  return e instanceof ResetError;
}

export function classifyError(err: unknown, phase: PhaseName | 'pre'): ClassifiedError {
  if (isResetError(err)) {
    return {
      code: err.code,
      message: err.message,
      critical: CRITICAL_BY_CODE[err.code] ?? true,
      phase: err.phase,
      cause: err.cause instanceof Error ? err.cause.message : err.cause ? String(err.cause) : undefined,
      meta: err.meta,
    };
  }

  const errObj = err as { code?: string; message?: string; signal?: string } | null;
  const code = errObj?.code;
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    return { code: 'DB_UNREACHABLE', phase, message, critical: true };
  }
  if (code === 'ENOSPC') {
    return { code: 'DISK_LOW', phase, message, critical: true };
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return {
      code: phase.includes('media') ? 'MEDIA_DIR_NOT_WRITABLE' : 'UNKNOWN',
      phase, message, critical: true,
    };
  }
  if (errObj?.signal === 'SIGTERM') {
    return { code: 'CANCELLED', phase, message: 'cancelled', critical: true };
  }

  return {
    code: 'UNKNOWN',
    phase,
    message,
    critical: true,
    cause: err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : undefined,
  };
}
