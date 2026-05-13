#!/usr/bin/env tsx
// IMPORTANT: charger .env AVANT tout autre import — sinon `@/lib/env` parse les
// defaults Zod (notamment MEDIA_LOCAL_DIR='./.media-storage' relatif) au lieu
// des valeurs réelles, et les seeders écrivent dans le mauvais répertoire.
import './_load-env.mjs';
/**
 * FemiGlow Reset CLI — entry point.
 *
 * Subcommands:
 *   run            — exécute un reset
 *   restore        — restore depuis un backup
 *   list-backups   — liste les backups disponibles
 *
 * Run modes:
 *   --mode=soft|medium|hard|custom
 *   --domains=commerce,content,... (custom)
 *   --preserve=table1,table2,...
 *   --wipe-media / --no-wipe-media
 *   --wipe-cache / --no-wipe-cache
 *   --backup / --no-backup
 *   --keep-backups=N
 *   --dry-run
 *   --confirm=RESET|"HARD RESET"
 *   --non-interactive
 *
 * Exit codes:
 *   0   success
 *   1   generic
 *   2   bad usage
 *   3   auth/preflight failed
 *   4   confirm missing/wrong
 *   5   lock held
 *   10..19 phase failures
 *   90  rollback succeeded after failure
 *   91  rollback failed — manual intervention required
 */
import path from 'node:path';

import {
  startReset, runReset, safeParseResetConfig, makePlan,
  getResetJobStore, restoreFromBackup, ResetError,
  type ResetEvent, type ResetMode, type ResetConfig,
} from '../src/lib/reset';

interface Args {
  cmd: 'run' | 'restore' | 'list-backups' | 'help' | 'unknown';
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const [cmd0, ...rest] = argv;
  let cmd: Args['cmd'] = 'help';
  if (cmd0 === 'run' || cmd0 === 'restore' || cmd0 === 'list-backups') {
    cmd = cmd0;
  } else if (cmd0 === 'help' || cmd0 === '--help' || cmd0 === '-h' || !cmd0) {
    cmd = 'help';
  } else {
    cmd = 'unknown';
  }
  const flags: Record<string, string | boolean> = {};
  for (const tok of rest) {
    if (!tok.startsWith('--')) continue;
    const eq = tok.indexOf('=');
    if (eq >= 0) flags[tok.slice(2, eq)] = tok.slice(eq + 1);
    else if (tok.startsWith('--no-')) flags[tok.slice(5)] = false;
    else flags[tok.slice(2)] = true;
  }
  return { cmd, flags };
}

function printHelp(): void {
  process.stdout.write(`FemiGlow Reset CLI

Usage:
  pnpm --filter @femiglow/web reset run --mode=hard --confirm='HARD RESET' --non-interactive
  pnpm --filter @femiglow/web reset run --mode=soft --dry-run
  pnpm --filter @femiglow/web reset restore --backup-id=bkp_…
  pnpm --filter @femiglow/web reset list-backups

Run flags:
  --mode=soft|medium|hard|custom     (required)
  --domains=commerce,content,chat,tracking,system  (custom only)
  --preserve=admin_users,audit_events,…
  --wipe-media / --no-wipe-media
  --wipe-cache / --no-wipe-cache
  --backup / --no-backup
  --keep-backups=N    (default 5)
  --dry-run
  --confirm=RESET|"HARD RESET"
  --non-interactive

Restore flags:
  --backup-id=bkp_…   (required)
  --non-interactive   (skip confirmation prompt)
`);
}

async function readlineYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const onData = (chunk: Buffer) => {
      const s = chunk.toString().trim().toLowerCase();
      process.stdin.off('data', onData);
      try { process.stdin.pause(); } catch { /* ignore */ }
      resolve(s === 'y' || s === 'yes');
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function readlineLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const onData = (chunk: Buffer) => {
      const s = chunk.toString().replace(/\n$/, '');
      process.stdin.off('data', onData);
      try { process.stdin.pause(); } catch { /* ignore */ }
      resolve(s);
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

function csv(v: string | boolean | undefined): string[] {
  if (typeof v !== 'string' || !v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000); const s = ((ms % 60_000) / 1000).toFixed(0);
  return `${m}m${s}s`;
}

function fmtPhaseLine(state: 'pending' | 'running' | 'done' | 'fail' | 'skip', name: string, msg?: string, durationMs?: number): string {
  const icon = state === 'done' ? '✅' : state === 'fail' ? '❌' : state === 'running' ? '▶ ' : state === 'skip' ? '⏭️' : '  ';
  const dur = durationMs !== undefined ? ` (${fmtMs(durationMs)})` : '';
  return `${icon} ${name.padEnd(18)} ${msg ?? ''}${dur}`.trimEnd();
}

async function runCmd(flags: Record<string, string | boolean>): Promise<number> {
  const mode = String(flags.mode ?? '') as ResetMode;
  if (!['soft', 'medium', 'hard', 'custom'].includes(mode)) {
    process.stderr.write('Error: --mode is required (soft|medium|hard|custom)\n');
    return 2;
  }

  const preserveRaw = csv(flags.preserve);
  const defaultPreserve = ['admin_users', 'audit_events', 'orders', 'order_items', 'leads', 'lead_events', 'chat_lead', 'ritual_testimonials'];

  // Confirm gating
  const expectedConfirm: 'RESET' | 'HARD RESET' = mode === 'hard' ? 'HARD RESET' : 'RESET';
  let confirm = String(flags.confirm ?? '');
  const nonInteractive = Boolean(flags['non-interactive']);
  if (!confirm) {
    if (nonInteractive) {
      process.stderr.write(`Error: --confirm is required in non-interactive mode (expected '${expectedConfirm}')\n`);
      return 4;
    }
    confirm = await readlineLine(`Type '${expectedConfirm}' to confirm: `);
  }
  if (confirm !== expectedConfirm) {
    process.stderr.write(`Error: confirm mismatch (expected '${expectedConfirm}', got '${confirm}')\n`);
    return 4;
  }

  const cfgInput: Partial<ResetConfig> & Record<string, unknown> = {
    mode,
    domains: mode === 'custom' ? (csv(flags.domains) as ResetConfig['domains']) : undefined,
    preserve: (preserveRaw.length ? preserveRaw : defaultPreserve) as ResetConfig['preserve'],
    wipeMedia: flags['wipe-media'] !== undefined ? Boolean(flags['wipe-media']) : mode === 'hard',
    wipeNextCache: flags['wipe-cache'] !== undefined ? Boolean(flags['wipe-cache']) : mode === 'hard',
    withBackup: flags.backup !== undefined ? Boolean(flags.backup) : true,
    keepBackups: flags['keep-backups'] ? Number(flags['keep-backups']) : 5,
    dryRun: Boolean(flags['dry-run']),
    confirm: confirm as 'RESET' | 'HARD RESET',
    nonInteractive,
    actorId: null,
  };

  const parsed = safeParseResetConfig(cfgInput);
  if (!parsed.ok) {
    process.stderr.write(`Error: CONFIG_INVALID\n${JSON.stringify(parsed.errors, null, 2)}\n`);
    return 2;
  }
  const cfg = parsed.config;

  const plan = makePlan(cfg);
  process.stdout.write(`Plan: ${plan.mode} · ${plan.phases.length} phases · ETA ~${fmtMs(plan.totalEtaMs)}\n`);
  for (const p of plan.phases) {
    process.stdout.write(`  · ${p.name.padEnd(18)} ~${fmtMs(p.estimatedDurationMs)}${p.critical ? ' (critical)' : ''}\n`);
  }
  if (cfg.dryRun) {
    process.stdout.write('[dry-run] no destructive action will be performed\n');
  }

  let started;
  try {
    started = startReset({ config: cfg, plan });
  } catch (err) {
    if (err instanceof ResetError && err.code === 'LOCK_HELD') {
      process.stderr.write(`Error: ${err.message}\n`);
      return 5;
    }
    throw err;
  }
  const { jobId } = started;
  process.stdout.write(`Job: ${jobId}\n\n`);

  const store = getResetJobStore();

  // Wait until job ends, streaming events to stdout
  return new Promise<number>((resolve) => {
    const phaseStart = new Map<string, number>();
    const phaseStatus = new Map<string, string>();
    let rolledBack = false;
    let lastErrorCode: string | null = null;
    const printer = (ev: ResetEvent) => {
      if (ev.type === 'phase.start') {
        phaseStart.set(ev.phase, Date.now());
        phaseStatus.set(ev.phase, 'running');
        process.stdout.write(fmtPhaseLine('running', ev.phase, '…') + '\n');
      } else if (ev.type === 'phase.complete') {
        phaseStatus.set(ev.phase, 'done');
        process.stdout.write('\x1b[1A\x1b[2K' + fmtPhaseLine('done', ev.phase, ev.summary, ev.durationMs) + '\n');
      } else if (ev.type === 'phase.error') {
        phaseStatus.set(ev.phase, 'fail');
        lastErrorCode = ev.error.code;
        process.stdout.write('\x1b[1A\x1b[2K' + fmtPhaseLine('fail', ev.phase, ev.error.message, ev.durationMs) + '\n');
      } else if (ev.type === 'rollback.start') {
        process.stdout.write(`\n🔄 Rollback depuis ${ev.backupId} (raison: ${ev.reason})\n`);
      } else if (ev.type === 'rollback.complete') {
        rolledBack = true;
        process.stdout.write(`✅ Rollback OK (${fmtMs(ev.durationMs)})\n`);
      } else if (ev.type === 'rollback.failed') {
        process.stdout.write(`❌ ROLLBACK FAILED ${ev.errorCode}: ${ev.message}\n`);
      } else if (ev.type === 'job.complete') {
        process.stdout.write(`\n✅ Reset terminé en ${fmtMs(ev.durationMs)}\n`);
        if (ev.summary.backupId) {
          process.stdout.write(`   Backup: ${ev.summary.backupId}\n`);
        }
        if (ev.summary.verify) {
          process.stdout.write(`   Verify: ${ev.summary.verify.passed} ok · ${ev.summary.verify.warnings} warn · ${ev.summary.verify.failed} fail\n`);
        }
        unsub();
        resolve(0);
      } else if (ev.type === 'job.failed') {
        process.stdout.write(`\n❌ Reset échoué · phase ${ev.phaseFailed} · ${ev.errorCode} · ${ev.message}\n`);
        unsub();
        // map exit codes
        const code = lastErrorCode ?? ev.errorCode;
        let exitCode = 1;
        if (rolledBack) exitCode = 90;
        else if (code === 'ROLLBACK_DB_FAILED' || code === 'ROLLBACK_MEDIA_FAILED' || code === 'ROLLBACK_SHA256_MISMATCH') exitCode = 91;
        else if (code.startsWith('BACKUP_')) exitCode = 11;
        else if (code.startsWith('WIPE_DB_')) exitCode = 12;
        else if (code.startsWith('WIPE_MEDIA_')) exitCode = 13;
        else if (code.startsWith('MIGRATE_')) exitCode = 14;
        else if (code.startsWith('SEED_')) exitCode = 15;
        else if (code.startsWith('VERIFY_')) exitCode = 16;
        else if (code === 'LOCK_HELD') exitCode = 5;
        else if (code === 'CONFIRM_TEXT_MISMATCH' || code === 'CONFIG_INVALID') exitCode = 4;
        resolve(exitCode);
      } else if (ev.type === 'job.cancelled') {
        process.stdout.write(`\n⛔ Reset cancelled\n`);
        unsub();
        resolve(1);
      }
    };
    const unsub = store.subscribe(jobId, printer);
    // Trigger any already-buffered (job.start should already have fired)
    const snap = store.snapshot(jobId);
    if (snap) {
      for (const ev of snap.events) printer(ev);
    }
    // Safety: also await orchestrator's runReset return via polling status
    const poll = setInterval(() => {
      const s = store.snapshot(jobId);
      if (!s) { clearInterval(poll); return; }
      if (s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled') {
        clearInterval(poll);
      }
    }, 500);
  });
}

async function restoreCmd(flags: Record<string, string | boolean>): Promise<number> {
  const backupId = String(flags['backup-id'] ?? '');
  if (!backupId.startsWith('bkp_')) {
    process.stderr.write('Error: --backup-id=bkp_… required\n');
    return 2;
  }
  const nonInteractive = Boolean(flags['non-interactive']);
  if (!nonInteractive) {
    const ok = await readlineYesNo(`Restore from ${backupId} ? Type 'y' to confirm: `);
    if (!ok) {
      process.stdout.write('Cancelled.\n');
      return 1;
    }
  }
  try {
    const t0 = Date.now();
    const result = await restoreFromBackup(backupId, {
      onProgress: (label, fraction) => {
        process.stdout.write(`\r[${(fraction * 100).toFixed(0)}%] ${label}`.padEnd(60) + '\n');
      },
    });
    process.stdout.write(`\n✅ Restore terminé en ${fmtMs(Date.now() - t0)} · db=${result.db} media=${result.media}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`\n❌ Restore failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return 91;
  }
}

async function listBackupsCmd(): Promise<number> {
  const root = process.env.RESET_BACKUP_ROOT || '/var/backups/femiglow';
  const { readdir, stat, readFile } = await import('node:fs/promises');
  let entries: string[] = [];
  try { entries = await readdir(root); }
  catch { process.stdout.write(`(no backups in ${root})\n`); return 0; }
  const rows: Array<{ id: string; ts: string; mode: string; db: number; media: number }> = [];
  for (const name of entries) {
    if (!name.startsWith('bkp_')) continue;
    try {
      const m = JSON.parse(await readFile(path.join(root, name, 'manifest.json'), 'utf8'));
      rows.push({
        id: name, ts: m.takenAt ?? '', mode: m.mode ?? '?',
        db: m.db?.size ?? 0, media: m.media?.size ?? 0,
      });
    } catch {
      const s = await stat(path.join(root, name));
      rows.push({ id: name, ts: new Date(s.mtimeMs).toISOString(), mode: '?', db: 0, media: 0 });
    }
  }
  rows.sort((a, b) => b.ts.localeCompare(a.ts));
  if (rows.length === 0) { process.stdout.write('(no backups)\n'); return 0; }
  process.stdout.write('backupId'.padEnd(36) + 'takenAt'.padEnd(28) + 'mode'.padEnd(10) + 'size\n');
  process.stdout.write('-'.repeat(85) + '\n');
  for (const r of rows) {
    const size = (r.db + r.media) / 1e6;
    process.stdout.write(`${r.id.padEnd(36)}${r.ts.padEnd(28)}${r.mode.padEnd(10)}${size.toFixed(1)} MB\n`);
  }
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.cmd === 'help') { printHelp(); return 0; }
  if (args.cmd === 'unknown') { process.stderr.write('Unknown command\n'); printHelp(); return 2; }
  if (args.cmd === 'run') return runCmd(args.flags);
  if (args.cmd === 'restore') return restoreCmd(args.flags);
  if (args.cmd === 'list-backups') return listBackupsCmd();
  return 2;
}

main()
  .then((code) => { process.exit(code); })
  .catch((err) => {
    console.error('UNCAUGHT', err);
    process.exit(1);
  });

// Used to satisfy ESM imports
void runReset;
