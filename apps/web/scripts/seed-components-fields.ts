/**
 * CLI : seed des champs éditoriaux (Components-CMS).
 *
 * Pour chaque composant du registre TS, garantit qu'un binding `published`
 * existe en DB (ou memory store) pour chaque field doté d'un `defaultValue`.
 * Idempotent : 2 runs successifs ⇒ 0 changement (cf. invariant I0 + D2 :
 * l'admin a la priorité, la valeur d'un binding existant n'est jamais
 * sur-écrite par le seed).
 *
 * Usage :
 *   pnpm --filter @femiglow/web seed:components-fields
 *   pnpm --filter @femiglow/web seed:components-fields -- --filter home
 *   pnpm --filter @femiglow/web seed:components-fields -- --component home-hero
 *   pnpm --filter @femiglow/web seed:components-fields -- --reconcile
 *
 * Le mode `--reconcile` archive en plus les bindings dont le fieldKey
 * n'existe plus dans le registre (EC1) — sécurité : non activé par défaut.
 *
 * Cf. docs/components-cms/architecture/03-seed-pipeline.md
 */
import './_load-env.mjs';
import { seedComponentFields } from '@/lib/components/seed-pipeline';

interface CliOpts {
  filterPageGroup?: string;
  filterComponentKey?: string;
  reconcile?: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--filter':
        opts.filterPageGroup = argv[++i];
        break;
      case '--component':
        opts.filterComponentKey = argv[++i];
        break;
      case '--reconcile':
        opts.reconcile = true;
        break;
    }
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const report = await seedComponentFields({
    ...(opts.filterPageGroup ? { filterPageGroup: opts.filterPageGroup } : {}),
    ...(opts.filterComponentKey ? { filterComponentKey: opts.filterComponentKey } : {}),
    reconcile: opts.reconcile ?? false,
  });

  console.log(JSON.stringify(report, null, 2));
  if (report.warnings.length > 0) {
    for (const w of report.warnings) console.warn(`⚠︎  ${w}`);
  }
}

main().catch((err) => {
  console.error('seed:components-fields failed', err);
  process.exit(1);
});
