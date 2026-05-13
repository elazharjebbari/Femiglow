/**
 * Phase migrate — exécute drizzle-kit migrate.
 */
import { spawn } from 'node:child_process';
import type { PhaseContext, PhaseResult } from '../types';
import { ResetError } from '../errors';

const TIMEOUT_MS = 120_000;

export async function runMigrate(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run: migrate non lancé' };
  }
  // skip si soft (rien à migrer puisque rien n'a été drop)
  if (ctx.config.mode === 'soft') {
    return { stats: { skipped: true, reason: 'soft mode' }, summary: 'soft: migrate non requis' };
  }

  ctx.onProgress?.('drizzle-kit migrate', 0.1);
  const t0 = Date.now();
  try {
    const out = await runDrizzleMigrate(ctx.signal);
    return {
      stats: { durationMs: Date.now() - t0, output: tail(out, 1000) },
      summary: 'Migrations appliquées',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('timeout')) {
      throw new ResetError('MIGRATE_TIMEOUT', 'migrate', `migrate timeout ${TIMEOUT_MS}ms`, err);
    }
    throw new ResetError('MIGRATE_FAILED', 'migrate', `drizzle-kit migrate failed: ${msg}`, err);
  }
}

function runDrizzleMigrate(signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = '/var/www/femiglow/apps/web';
    const child = spawn(
      'pnpm',
      ['--filter', '@femiglow/web', 'db:migrate'],
      {
        cwd: '/var/www/femiglow',
        stdio: ['ignore', 'pipe', 'pipe'],
        signal,
        env: { ...process.env },
      },
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      reject(new Error('migrate timeout'));
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`exit ${code} · ${err.slice(-500)}`));
    });
    void cwd;
  });
}

function tail(s: string, n: number): string {
  return s.length > n ? '…' + s.slice(-n) : s;
}
