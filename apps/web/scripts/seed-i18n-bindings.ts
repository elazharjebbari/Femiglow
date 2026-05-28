/**
 * CLI : seed des traductions i18n (AR + EN) dans `component_field_bindings`.
 *
 * Ingère les CSV produits par la préparation contenu hors-sprint
 * (`docs/i18n-content-2026-05/03-seed-data/component-bindings-{ar,en}.csv`)
 * et les upserte en DB Postgres (ou memoryStore en dev/tests).
 *
 * Invariants respectés :
 *   - **I0 — Admin priorité** : un binding `draft` ou `published` existant pour
 *     le triplet `(component_id, field_key, locale)` n'est JAMAIS sur-écrit
 *     sauf `--force-update` explicite.
 *   - **D2 — Idempotence** : 2 runs successifs ⇒ 0 changement
 *     (vérifiable via diff du JSON report).
 *   - **Status** : tout binding seedé est `draft` (le founder publie via admin
 *     après revue voix éditoriale).
 *
 * Usage :
 *   pnpm --filter @femiglow/web seed:i18n-bindings           # AR + EN
 *   pnpm --filter @femiglow/web seed:i18n-bindings -- --locale ar
 *   pnpm --filter @femiglow/web seed:i18n-bindings -- --dry  # no DB writes
 *   pnpm --filter @femiglow/web seed:i18n-bindings -- --force-update
 *   pnpm --filter @femiglow/web seed:i18n-bindings -- --csv-dir <path>
 *
 * Exit codes :
 *   0  → succès (insertions OK)
 *   1  → erreurs runtime (au moins une row a échoué)
 *   2  → pré-flight échoué (CSV manquant, DB unreachable, etc.)
 *
 * Cf. `docs/i18n-strategy-2026-05/PHASE-6-SEED-RUNBOOK.md` pour la procédure
 * complète (dry-run → apply → vérification SQL → preview admin → Playwright).
 */
import './_load-env.mjs';
import {
  runI18nBindingsSeed,
  type SeedI18nReport,
} from '@/lib/i18n/seed-bindings';
import { logger } from '@/lib/logging/logger';
import { LOCALES, type Locale } from '@/i18n.config';

/* ────────────────────────────────────────────────────────────────
 * Argv parsing
 * ────────────────────────────────────────────────────────────── */

interface CliOpts {
  locales: Locale[];
  dry: boolean;
  forceUpdate: boolean;
  csvDir?: string;
  reportPath?: string;
}

const SEEDABLE_LOCALES: readonly Locale[] = LOCALES.filter((l) => l !== 'fr');

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {
    locales: [...SEEDABLE_LOCALES],
    dry: false,
    forceUpdate: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    // Phase 7D — Skip `--` séparateur pnpm/npm. Sans ce skip, le script
    // exit 2 avec `Unknown flag: --` quand on lance via
    // `pnpm seed:i18n-bindings:dry` (qui inclut `-- --dry` dans son script).
    // cf. docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A5.
    if (a === '--') continue;
    switch (a) {
      case '--locale': {
        const next = argv[++i];
        if (next == null) throw new Error('--locale requires a value (ar|en)');
        if (!(LOCALES as readonly string[]).includes(next)) {
          throw new Error(
            `--locale invalid: '${next}' (allowed: ${LOCALES.join('|')})`,
          );
        }
        if (next === 'fr') {
          throw new Error(
            '--locale=fr non supporté (FR seedé par seed:components-fields).',
          );
        }
        opts.locales = [next as Locale];
        break;
      }
      case '--dry':
      case '--dry-run':
        opts.dry = true;
        break;
      case '--force-update':
        opts.forceUpdate = true;
        break;
      case '--csv-dir':
        opts.csvDir = argv[++i];
        break;
      case '--report':
        opts.reportPath = argv[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (a !== undefined && a.startsWith('--')) {
          throw new Error(`Unknown flag: ${a}`);
        }
    }
  }
  return opts;
}

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage : seed-i18n-bindings [options]

Options :
  --locale <ar|en>      Seed une seule locale (défaut : AR + EN).
  --dry, --dry-run      Pas d'écriture DB, juste un rapport.
  --force-update        Override les bindings existants (invariant I0 levé).
  --csv-dir <path>      Override du dossier CSV (défaut : docs/i18n-content-2026-05/03-seed-data).
  --report <path>       Écrit le rapport JSON dans ce fichier (défaut : .seed-reports/seed-i18n-bindings-<ts>.json).
  -h, --help            Affiche cette aide.

Exit codes : 0 OK, 1 erreurs runtime, 2 pré-flight échoué.`);
}

/* ────────────────────────────────────────────────────────────────
 * Reporting helpers
 * ────────────────────────────────────────────────────────────── */

function summarise(report: SeedI18nReport): string {
  const lines: string[] = [];
  lines.push(`seed-i18n-bindings — ${report.locales.length} locale(s)`);
  for (const r of report.perLocale) {
    lines.push(
      `  ${r.locale} : parsed=${r.parsed} inserted=${r.inserted} skipped=${r.skipped} errors=${r.errors.length} orphans=${r.orphans.length} (${r.durationMs}ms)`,
    );
  }
  lines.push(
    `total : parsed=${report.totals.parsed} inserted=${report.totals.inserted} skipped=${report.totals.skipped} errors=${report.totals.errors} orphans=${report.totals.orphans}`,
  );
  return lines.join('\n');
}

/* ────────────────────────────────────────────────────────────────
 * Main
 * ────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  let opts: CliOpts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    logger.error('seed.i18n-bindings.argv', {
      message: err instanceof Error ? err.message : String(err),
    });
    printUsage();
    process.exit(2);
    return;
  }

  logger.info('seed.i18n-bindings.start', {
    locales: opts.locales,
    dry: opts.dry,
    forceUpdate: opts.forceUpdate,
  });

  let report: SeedI18nReport;
  try {
    report = await runI18nBindingsSeed({
      locales: opts.locales,
      dryRun: opts.dry,
      forceUpdate: opts.forceUpdate,
      ...(opts.csvDir !== undefined && { csvDir: opts.csvDir }),
      ...(opts.reportPath !== undefined && { reportPath: opts.reportPath }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'PreflightError') {
      logger.error('seed.i18n-bindings.preflight', { message: err.message });
      // eslint-disable-next-line no-console
      console.error(`Pré-flight échoué : ${err.message}`);
      process.exit(2);
      return;
    }
    logger.error('seed.i18n-bindings.unhandled', {
      message: err instanceof Error ? err.message : String(err),
    });
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(summarise(report));
  if (report.reportPath) {
    logger.info('seed.i18n-bindings.report', { path: report.reportPath });
    // eslint-disable-next-line no-console
    console.log(`Rapport JSON : ${report.reportPath}`);
  }

  if (report.totals.errors > 0) {
    logger.warn('seed.i18n-bindings.has-errors', {
      errors: report.totals.errors,
    });
    process.exit(1);
    return;
  }
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed:i18n-bindings failed', err);
  process.exit(1);
});
