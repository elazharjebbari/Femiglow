/**
 * Phase wipe-db — DROP SCHEMA (hard) ou TRUNCATE (medium/custom).
 */
import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import type { PhaseContext, PhaseResult } from '../types';
import { ResetError } from '../errors';
import { db } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { sql } from 'drizzle-orm';

export async function runWipeDb(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run: pas de wipe' };
  }

  const strategy = ctx.plan.dbStrategy;

  if (strategy === 'none') {
    return { stats: { strategy: 'none' }, summary: 'Aucun wipe DB (mode soft)' };
  }

  if (strategy === 'drop-schema') {
    ctx.onProgress?.('DROP SCHEMA public CASCADE', 0.1);
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) throw new ResetError('WIPE_DB_TRANSACTION_FAILED', 'wipe-db', 'DATABASE_URL non défini');
    // On utilise psql plutôt que drizzle pour DROP SCHEMA (drizzle peut tenir une connexion sur public).
    try {
      await runPsql(
        dbUrl,
        `DROP SCHEMA IF EXISTS public CASCADE;
         CREATE SCHEMA public;
         DROP SCHEMA IF EXISTS drizzle CASCADE;`,
        ctx.signal,
      );
    } catch (err) {
      throw new ResetError('WIPE_DB_TRANSACTION_FAILED', 'wipe-db', errMsg(err), err);
    }
    return {
      stats: { strategy: 'drop-schema', dropped: 'public+drizzle' },
      summary: 'DROP SCHEMA public + drizzle',
    };
  }

  // truncate
  const tables = ctx.plan.truncateTables;
  if (tables.length === 0) {
    return { stats: { strategy: 'truncate', truncated: 0 }, summary: 'Aucune table à truncate' };
  }

  ctx.onProgress?.(`TRUNCATE ${tables.length} tables`, 0.5);
  const conn = db();
  if (!conn) throw new ResetError('WIPE_DB_TRANSACTION_FAILED', 'wipe-db', 'Pas de DB');
  // On filtre les tables qui existent réellement pour éviter d'échouer sur des relations absentes.
  const existing = await listExistingTables(tables);
  if (existing.length === 0) {
    return { stats: { strategy: 'truncate', truncated: 0, skipped: tables }, summary: 'Aucune des tables ciblées n\'existe' };
  }

  try {
    const list = existing.map((t) => `"${t}"`).join(', ');
    await conn.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`));
  } catch (err) {
    throw new ResetError('WIPE_DB_TRANSACTION_FAILED', 'wipe-db', errMsg(err), err);
  }
  return {
    stats: { strategy: 'truncate', truncated: existing.length, tables: existing },
    summary: `TRUNCATE ${existing.length} tables`,
  };
}

async function listExistingTables(candidates: string[]): Promise<string[]> {
  const conn = db();
  if (!conn) return [];
  const out: string[] = [];
  for (const t of candidates) {
    try {
      const res = await conn.execute<{ exists: number }>(sql`
        SELECT 1 AS exists FROM information_schema.tables
        WHERE table_schema='public' AND table_name=${t} LIMIT 1
      `);
      if (rowsOf(res).length > 0) out.push(t);
    } catch {
      // ignore
    }
  }
  return out;
}

function runPsql(dbUrl: string, command: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', command], {
      stdio: ['ignore', 'pipe', 'pipe'], signal,
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Garder pour usage éventuel
export { execSync as _execSyncPlaceholder };
