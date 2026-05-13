/**
 * Phase backup — pg_dump + tar média + manifest.json + sha256.
 * Cf. docs/reset-feature/03-design-backend.md § Backup
 */
import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { PhaseContext, PhaseResult, BackupManifest, BackupResult, ResetConfig } from '../types';
import { ResetError } from '../errors';

const BACKUP_ROOT_DEFAULT = '/var/backups/femiglow';
const MIN_DB_SIZE_BYTES = 1024; // 1 kB — détection d'un dump vide/cassé

export async function runBackup(ctx: PhaseContext): Promise<PhaseResult> {
  if (!ctx.config.withBackup) {
    return { stats: { skipped: true }, summary: 'Backup désactivé' };
  }
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run: backup non créé' };
  }

  const root = process.env.RESET_BACKUP_ROOT || BACKUP_ROOT_DEFAULT;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `bkp_${ts}`;
  const dir = path.join(root, backupId);
  await mkdir(dir, { recursive: true, mode: 0o700 });

  // 1. pg_dump
  ctx.onProgress?.('pg_dump', 0.1);
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new ResetError('BACKUP_PG_DUMP_FAILED', 'backup', 'DATABASE_URL non défini');
  }
  const sqlPath = path.join(dir, 'db.sql');
  try {
    await runPgDump(dbUrl, sqlPath, ctx.signal);
  } catch (err) {
    throw new ResetError('BACKUP_PG_DUMP_FAILED', 'backup', `pg_dump failed: ${errMsg(err)}`, err);
  }
  ctx.onProgress?.('gzip db.sql', 0.4);
  try {
    await runShell(`gzip -9 ${shellQuote(sqlPath)}`, ctx.signal);
  } catch (err) {
    throw new ResetError('BACKUP_PG_DUMP_FAILED', 'backup', `gzip failed: ${errMsg(err)}`, err);
  }

  const sqlGzPath = `${sqlPath}.gz`;
  const dbStats = await stat(sqlGzPath);
  if (dbStats.size < MIN_DB_SIZE_BYTES) {
    throw new ResetError(
      'BACKUP_TOO_SMALL', 'backup',
      `db.sql.gz trop petit (${dbStats.size} < ${MIN_DB_SIZE_BYTES})`,
    );
  }
  ctx.onProgress?.('sha256 db', 0.5);
  const dbSha = await sha256File(sqlGzPath);

  // 2. tar média (seulement si wipeMedia)
  let mediaPart: BackupManifest['media'] = null;
  if (ctx.config.wipeMedia) {
    ctx.onProgress?.('tar média', 0.6);
    const mediaDir = process.env.MEDIA_LOCAL_DIR || '/var/www/femiglow/.media-storage';
    const tarPath = path.join(dir, 'media.tar.gz');
    try {
      const exists = await pathExists(mediaDir);
      if (exists) {
        await runShell(
          `tar -czf ${shellQuote(tarPath)} -C ${shellQuote(path.dirname(mediaDir))} ${shellQuote(path.basename(mediaDir))}`,
          ctx.signal,
        );
        const mediaStats = await stat(tarPath);
        ctx.onProgress?.('sha256 media', 0.85);
        const mediaSha = await sha256File(tarPath);
        const { dirCount, fileCount } = await countMediaContents(mediaDir);
        mediaPart = {
          size: mediaStats.size,
          sha256: mediaSha,
          path: 'media.tar.gz',
          dirCount,
          fileCount,
        };
      } else {
        // Pas de media à backup — ce n'est pas une erreur.
      }
    } catch (err) {
      throw new ResetError('BACKUP_TAR_FAILED', 'backup', `tar failed: ${errMsg(err)}`, err);
    }
  }

  ctx.onProgress?.('manifest', 0.95);
  const manifest = makeManifest({
    backupId, mode: ctx.config.mode, actorId: ctx.config.actorId,
    dbSize: dbStats.size, dbSha, mediaPart, rowCounts: ctx.before?.counts,
  });

  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const result: BackupResult = {
    backupId, dir, dbSize: dbStats.size, mediaSize: mediaPart?.size ?? 0,
    takenAt: manifest.takenAt, manifest,
  };

  return {
    stats: {
      backupId,
      dbSize: result.dbSize,
      mediaSize: result.mediaSize,
      path: dir,
    },
    summary: `Backup ${backupId} · ${formatBytes(result.dbSize + result.mediaSize)}`,
  };
}

function makeManifest(args: {
  backupId: string;
  mode: ResetConfig['mode'];
  actorId: string | null;
  dbSize: number;
  dbSha: string;
  mediaPart: BackupManifest['media'];
  rowCounts?: Record<string, number>;
}): BackupManifest {
  const dbUrl = process.env.DATABASE_URL || '';
  return {
    backupId: args.backupId,
    version: '1.0.0',
    takenAt: new Date().toISOString(),
    mode: args.mode,
    actorId: args.actorId,
    gitCommit: safeGit('rev-parse --short HEAD'),
    gitBranch: safeGit('rev-parse --abbrev-ref HEAD'),
    db: {
      size: args.dbSize,
      sha256: args.dbSha,
      path: 'db.sql.gz',
      dumpedFrom: extractDbName(dbUrl) || 'unknown',
    },
    media: args.mediaPart,
    preReset: args.rowCounts
      ? { tables: Object.keys(args.rowCounts).length, rows: args.rowCounts }
      : null,
    envSnapshot: {
      NODE_ENV: process.env.NODE_ENV ?? 'unknown',
      DATABASE_URL_hash: createHash('sha256').update(dbUrl).digest('hex'),
      MEDIA_LOCAL_DIR: process.env.MEDIA_LOCAL_DIR ?? '',
    },
  };
}

async function runPgDump(dbUrl: string, outPath: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pg_dump',
      ['--no-owner', '--no-acl', '--format=plain', '--file', outPath, dbUrl],
      { stdio: ['ignore', 'pipe', 'pipe'], signal },
    );
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => reject(e));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exit ${code} · stderr: ${stderr.slice(-500)}`));
    });
  });
}

async function runShell(cmd: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', cmd], { stdio: ['ignore', 'ignore', 'pipe'], signal });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => reject(e));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`exit ${code} · ${stderr.slice(-300)}`));
    });
  });
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const s = createReadStream(filePath);
    s.on('data', (c) => h.update(c));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function countMediaContents(dir: string): Promise<{ dirCount: number; fileCount: number }> {
  try {
    const out = execSync(`find ${shellQuote(dir)} -mindepth 1 -maxdepth 4 -printf '.\\n' | wc -l`).toString().trim();
    const dirOut = execSync(`find ${shellQuote(dir)} -mindepth 1 -maxdepth 1 -type d | wc -l`).toString().trim();
    return { dirCount: Number(dirOut) || 0, fileCount: Number(out) || 0 };
  } catch {
    return { dirCount: 0, fileCount: 0 };
  }
}

function safeGit(args: string): string | undefined {
  try {
    return execSync(`git ${args}`, { cwd: '/var/www/femiglow' }).toString().trim();
  } catch { return undefined; }
}

function extractDbName(url: string): string | null {
  try {
    const m = /\/([^/?]+)(\?|$)/.exec(url);
    return m ? m[1] ?? null : null;
  } catch { return null; }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} kB`;
  return `${n} B`;
}

// For restore phase
export function getBackupManifestPath(backupId: string): string {
  const root = process.env.RESET_BACKUP_ROOT || BACKUP_ROOT_DEFAULT;
  return path.join(root, backupId, 'manifest.json');
}

export async function readBackupManifest(backupId: string): Promise<BackupManifest> {
  const p = getBackupManifestPath(backupId);
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw) as BackupManifest;
}

export async function verifyBackupSha(backupId: string): Promise<boolean> {
  const manifest = await readBackupManifest(backupId);
  const root = process.env.RESET_BACKUP_ROOT || BACKUP_ROOT_DEFAULT;
  const dir = path.join(root, backupId);
  const dbSha = await sha256File(path.join(dir, manifest.db.path));
  if (dbSha !== manifest.db.sha256) return false;
  if (manifest.media) {
    const mediaSha = await sha256File(path.join(dir, manifest.media.path));
    if (mediaSha !== manifest.media.sha256) return false;
  }
  return true;
}
