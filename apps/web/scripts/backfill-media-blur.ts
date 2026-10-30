/* eslint-disable no-console -- CLI ops : la sortie console est le rapport. */
/**
 * Backfill de `media.blur_data_url` (placeholder flou des images).
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.5 et
 *     docs/hero-media-par-angle/07-import-et-blur.md
 *
 * Usage (depuis apps/web) :
 *   pnpm media:backfill-blur -- --dry-run            # compte, n'écrit rien
 *   pnpm media:backfill-blur -- --limit 20           # premier lot de contrôle
 *   pnpm media:backfill-blur                         # tout le reste
 *   pnpm media:backfill-blur -- --batch 100          # taille des lots de lecture
 *   pnpm media:backfill-blur -- --fetch-timeout 5000 # délai HTTP par source (ms, défaut 15000)
 *
 * Idempotent : seuls les médias image `ready` / `passthrough` dont la colonne
 * est NULL sont traités ; relancer reprend où le passage précédent s'est
 * arrêté. Prérequis : migration 0087 appliquée (colonne `blur_data_url`).
 * Logique : `lib/media/blur-backfill.ts`.
 *
 * Code de sortie : 0 si aucune erreur, 1 sinon (`no_source` n'est pas une
 * erreur : média dont aucun fichier n'est lisible, signalé dans le journal).
 */
import './_load-env.mjs';
import { db } from '@/lib/db/client';
import { backfillMediaBlur } from '@/lib/media/blur-backfill';
import { CliArgsError, parseBackfillBlurArgs } from '@/lib/media/cli-args';
import { getStorage } from '@/lib/media/storage';

const USAGE = 'Usage : pnpm media:backfill-blur -- [--dry-run] [--limit <n>] [--batch <n>] [--fetch-timeout <ms>]';

async function main(): Promise<number> {
  const args = parseBackfillBlurArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (!db()) {
    console.error('[backfill-blur] DATABASE_URL absente : ce script exige la vraie base.');
    return 1;
  }
  const storage = getStorage();
  console.log(
    `[backfill-blur] début dry_run=${args.dryRun} limit=${args.limit ?? 'aucune'} batch=${args.batchSize ?? 50} storage=${storage.driver}`,
  );
  const report = await backfillMediaBlur({
    storage,
    dryRun: args.dryRun,
    ...(args.limit ? { limit: args.limit } : {}),
    ...(args.batchSize ? { batchSize: args.batchSize } : {}),
    ...(args.fetchTimeoutMs ? { fetchTimeoutMs: args.fetchTimeoutMs } : {}),
    log: (line) => console.log(line),
  });
  const { items: _items, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  return report.errors > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof CliArgsError) {
      console.error(`${err.message}\n${USAGE}`);
    } else {
      console.error('[backfill-blur] échec', err);
    }
    process.exit(1);
  });
