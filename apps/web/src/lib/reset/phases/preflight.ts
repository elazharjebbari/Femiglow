/**
 * Phase preflight — vérifs lecture seule avant tout impact.
 * Cf. docs/reset-feature/10-error-taxonomy.md classes A
 */
import { statfs } from 'node:fs/promises';
import { existsSync, accessSync, constants as fsConstants } from 'node:fs';
import type { PhaseContext, PhaseResult } from '../types';
import { ResetError } from '../errors';
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

const MIN_DISK_HEADROOM = 2;          // facteur sécurité disque
const MIN_FREE_BYTES = 500 * 1024 * 1024; // 500 MB plancher absolu

export async function runPreflight(ctx: PhaseContext): Promise<PhaseResult> {
  const warnings: string[] = [];

  ctx.onProgress?.('DB connectivity', 0.1);
  try {
    const conn = db();
    if (!conn) throw new ResetError('DB_UNREACHABLE', 'preflight', 'Pas de DB configurée (mode mémoire)');
    await conn.execute(sql`SELECT 1`);
  } catch (err) {
    throw new ResetError('DB_UNREACHABLE', 'preflight', 'PostgreSQL injoignable', err);
  }

  ctx.onProgress?.('Disk space', 0.4);
  const mediaDir = process.env.MEDIA_LOCAL_DIR || '/var/www/femiglow/.media-storage';
  const backupRoot = process.env.RESET_BACKUP_ROOT || '/var/backups/femiglow';
  let freeBytes = 0;
  try {
    const stats = await statfs(existsSync(backupRoot) ? backupRoot : '/var');
    freeBytes = stats.bfree * stats.bsize;
    // Heuristique : on veut au moins 2x la taille DB+media estimée
    const estimatedDbBytes = 100 * 1024 * 1024; // 100 MB heuristique
    const required = Math.max(MIN_FREE_BYTES, estimatedDbBytes * MIN_DISK_HEADROOM);
    if (freeBytes < required) {
      throw new ResetError(
        'DISK_LOW', 'preflight',
        `Espace disque insuffisant : ${formatBytes(freeBytes)} < ${formatBytes(required)} requis`,
      );
    }
  } catch (err) {
    if (err instanceof ResetError) throw err;
    warnings.push(`statfs failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  ctx.onProgress?.('Bootstrap env', 0.6);
  if (!process.env.ADMIN_BOOTSTRAP_EMAIL || !process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    if (ctx.config.mode === 'hard' || ctx.config.preserve.indexOf('admin_users') === -1) {
      throw new ResetError(
        'BOOTSTRAP_ENV_MISSING', 'preflight',
        'ADMIN_BOOTSTRAP_EMAIL/PASSWORD requis pour recréer l\'admin après reset',
      );
    }
    warnings.push('ADMIN_BOOTSTRAP_* manquant (mais admin_users préservé)');
  }

  ctx.onProgress?.('Media dir', 0.8);
  if (ctx.config.wipeMedia) {
    if (!existsSync(mediaDir)) {
      warnings.push(`MEDIA_LOCAL_DIR n'existe pas encore: ${mediaDir} (sera créé par le seed)`);
    } else {
      try {
        accessSync(mediaDir, fsConstants.W_OK);
      } catch {
        throw new ResetError(
          'MEDIA_DIR_NOT_WRITABLE', 'preflight',
          `Media dir non writable: ${mediaDir}`,
        );
      }
    }
  }

  return {
    stats: {
      diskFreeBytes: freeBytes,
      mediaDir,
      backupRoot,
      mode: ctx.config.mode,
      dryRun: ctx.config.dryRun,
    },
    summary: `Preflight OK · disque libre ${formatBytes(freeBytes)}`,
    warnings,
  };
}

function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} kB`;
  return `${n} B`;
}
