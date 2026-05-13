/**
 * Restore depuis un backup — gunzip + psql + tar.
 * Utilisé par l'auto-rollback de l'orchestrator ET par la commande CLI/UI restore.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readBackupManifest, verifyBackupSha } from './phases/backup';
import { ResetError } from './errors';

const BACKUP_ROOT = process.env.RESET_BACKUP_ROOT || '/var/backups/femiglow';

export interface RestoreOpts {
  restoreDb?: boolean;
  restoreMedia?: boolean;
  onProgress?: (label: string, fraction: number) => void;
  signal?: AbortSignal;
}

export interface RestoreResult {
  db: boolean;
  media: boolean;
}

export async function restoreFromBackup(
  backupId: string,
  opts: RestoreOpts = {},
): Promise<RestoreResult> {
  const dir = path.join(BACKUP_ROOT, backupId);
  if (!existsSync(dir)) {
    throw new ResetError('ROLLBACK_BACKUP_MISSING', 'pre', `Backup absent: ${dir}`);
  }
  const manifest = await readBackupManifest(backupId);
  opts.onProgress?.('verify sha256', 0.05);
  const shaOk = await verifyBackupSha(backupId);
  if (!shaOk) {
    throw new ResetError('ROLLBACK_SHA256_MISMATCH', 'pre', 'sha256 mismatch sur le backup');
  }

  let restoredDb = false;
  let restoredMedia = false;

  if (opts.restoreDb ?? true) {
    opts.onProgress?.('drop schema public', 0.1);
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) throw new ResetError('ROLLBACK_DB_FAILED', 'pre', 'DATABASE_URL non défini');
    try {
      await runPsqlCmd(dbUrl, `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`, opts.signal);
      opts.onProgress?.('restore db', 0.3);
      await runPsqlFromGz(dbUrl, path.join(dir, manifest.db.path), opts.signal);
      restoredDb = true;
    } catch (err) {
      throw new ResetError('ROLLBACK_DB_FAILED', 'pre', errMsg(err), err);
    }
  }

  if ((opts.restoreMedia ?? true) && manifest.media) {
    opts.onProgress?.('restore media', 0.7);
    const mediaDir = process.env.MEDIA_LOCAL_DIR || '/var/www/femiglow/.media-storage';
    try {
      await runShell(`rm -rf ${shellQuote(mediaDir)}/*`, opts.signal);
      await runShell(
        `tar -xzf ${shellQuote(path.join(dir, manifest.media.path))} -C ${shellQuote(path.dirname(mediaDir))}`,
        opts.signal,
      );
      restoredMedia = true;
    } catch (err) {
      throw new ResetError('ROLLBACK_MEDIA_FAILED', 'pre', errMsg(err), err);
    }
  }

  opts.onProgress?.('done', 1);
  return { db: restoredDb, media: restoredMedia };
}

function runPsqlCmd(dbUrl: string, command: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', command], {
      stdio: ['ignore', 'ignore', 'pipe'], signal,
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql exit ${code} · ${stderr.slice(-300)}`));
    });
  });
}

function runPsqlFromGz(dbUrl: string, gzPath: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = `gunzip -c ${shellQuote(gzPath)} | psql -v ON_ERROR_STOP=0 ${shellQuote(dbUrl)}`;
    const child = spawn('bash', ['-c', cmd], { stdio: ['ignore', 'ignore', 'pipe'], signal });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      // psql peut renvoyer != 0 sur warnings ; on tolère si stderr ne contient pas FATAL
      if (code === 0 || !/FATAL|ERROR:.*syntax/i.test(stderr)) resolve();
      else reject(new Error(`psql restore exit ${code} · ${stderr.slice(-500)}`));
    });
  });
}

function runShell(cmd: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', cmd], { stdio: ['ignore', 'ignore', 'pipe'], signal });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`exit ${code} · ${stderr.slice(-300)}`));
    });
  });
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
