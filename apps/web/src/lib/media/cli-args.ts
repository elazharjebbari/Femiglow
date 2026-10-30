/**
 * Analyse des arguments des scripts média (`scripts/backfill-media-blur.ts`,
 * `scripts/import-component-media.ts`). Séparée des scripts pour être
 * testée sans charger leur environnement (`_load-env.mjs`, base).
 */
import path from 'node:path';

export class CliArgsError extends Error {}

function takeValue(argv: readonly string[], i: number, flag: string): string {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new CliArgsError(`${flag} attend une valeur`);
  return value;
}

function positiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new CliArgsError(`${flag} attend un entier positif (reçu « ${raw} »)`);
  return n;
}

/** pnpm transmet le `--` séparateur : on l'ignore. */
function clean(argv: readonly string[]): string[] {
  return argv.filter((a) => a !== '--');
}

export interface BackfillBlurArgs {
  dryRun: boolean;
  limit?: number;
  batchSize?: number;
  /** Délai d'un téléchargement HTTP de source (ms). */
  fetchTimeoutMs?: number;
  help: boolean;
}

/** `[--dry-run] [--limit <n>] [--batch <n>] [--fetch-timeout <ms>]` */
export function parseBackfillBlurArgs(argv: readonly string[]): BackfillBlurArgs {
  const args = clean(argv);
  const out: BackfillBlurArgs = { dryRun: false, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    switch (a) {
      case '--dry-run':
        out.dryRun = true;
        break;
      case '--limit':
        out.limit = positiveInt(takeValue(args, i, a), a);
        i += 1;
        break;
      case '--batch':
        out.batchSize = positiveInt(takeValue(args, i, a), a);
        i += 1;
        break;
      case '--fetch-timeout':
        out.fetchTimeoutMs = positiveInt(takeValue(args, i, a), a);
        i += 1;
        break;
      case '-h':
      case '--help':
        out.help = true;
        break;
      default:
        throw new CliArgsError(`Argument inconnu : ${a}`);
    }
  }
  return out;
}

export interface ImportComponentMediaArgs {
  root: string;
  componentKey?: string;
  dryRun: boolean;
  publish: boolean;
  force: boolean;
  report?: string;
  actorId?: string;
  help: boolean;
}

/**
 * `--root <dir> [--component <key>] [--dry-run] [--publish] [--force]
 * [--report <file>] [--actor <adminId>]`. Les chemins relatifs sont
 * résolus depuis `baseDir` (dossier d'où la commande a été lancée :
 * `INIT_CWD` sous pnpm).
 */
export function parseImportComponentMediaArgs(
  argv: readonly string[],
  baseDir: string,
): ImportComponentMediaArgs {
  const args = clean(argv);
  const out: Partial<ImportComponentMediaArgs> & { dryRun: boolean; publish: boolean; force: boolean; help: boolean } = {
    dryRun: false,
    publish: false,
    force: false,
    help: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    switch (a) {
      case '--root':
        out.root = path.resolve(baseDir, takeValue(args, i, a));
        i += 1;
        break;
      case '--component':
        out.componentKey = takeValue(args, i, a);
        i += 1;
        break;
      case '--report':
        out.report = path.resolve(baseDir, takeValue(args, i, a));
        i += 1;
        break;
      case '--actor':
        out.actorId = takeValue(args, i, a);
        i += 1;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '--publish':
        out.publish = true;
        break;
      case '--force':
        out.force = true;
        break;
      case '-h':
      case '--help':
        out.help = true;
        break;
      default:
        throw new CliArgsError(`Argument inconnu : ${a}`);
    }
  }
  if (out.help) return { ...out, root: out.root ?? '' };
  if (!out.root) throw new CliArgsError('--root <dossier> est obligatoire');
  return out as ImportComponentMediaArgs;
}
