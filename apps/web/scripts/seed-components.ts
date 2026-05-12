/**
 * CLI : seed du système Component-Media depuis `docs/images/values/`.
 *
 * Usage :
 *   pnpm --filter @femiglow/web tsx scripts/seed-components.ts
 *   pnpm --filter @femiglow/web tsx scripts/seed-components.ts -- --auto-activate
 *   pnpm --filter @femiglow/web tsx scripts/seed-components.ts -- --force --auto-activate
 *   pnpm --filter @femiglow/web tsx scripts/seed-components.ts -- --dry-run
 *   pnpm --filter @femiglow/web tsx scripts/seed-components.ts -- --filter home
 *
 * Exporte aussi `runComponentsSeed(opts)` pour réutilisation côté Seeders
 * Runner.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFromDocs } from '@/lib/components/seed-pipeline';
import type { SeedOptions, SeedReport } from '@/lib/components/seed-pipeline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]): SeedOptions {
  const opts: SeedOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--auto-activate':
        opts.autoActivate = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--force-alt':
        opts.forceAlt = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--no-animations':
        opts.syncAnimations = false;
        break;
      case '--no-registry':
        opts.syncRegistry = false;
        break;
      case '--filter':
        opts.filterPageGroup = argv[++i];
        break;
      case '--root':
        opts.rootDir = argv[++i];
        break;
    }
  }
  return opts;
}

export async function runComponentsSeed(
  opts: SeedOptions = {},
): Promise<SeedReport> {
  const projectRoot = path.resolve(__dirname, '..');
  const root = opts.rootDir ?? path.resolve(projectRoot, '../../docs/images/values');
  return seedFromDocs({ ...opts, rootDir: root });
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const report = await runComponentsSeed(opts);

  console.log(JSON.stringify(report, null, 2));
  if (report.images.errors.length > 0) {
    console.error(`seed:components — ${report.images.errors.length} error(s).`);
    process.exit(1);
  }
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('seed:components failed', err);
    process.exit(1);
  });
}
