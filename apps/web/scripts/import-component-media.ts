/* eslint-disable no-console -- CLI ops : la sortie console est le rapport. */
/**
 * Import des images générées (médias par audience) → médias + ensembles
 * en BROUILLON. cf. docs/hero-media-par-angle/05-architecture-technique.md §4.8
 * et docs/hero-media-par-angle/07-import-et-blur.md (runbook).
 *
 * Usage (depuis apps/web ; chemins relatifs résolus depuis le dossier de lancement) :
 *   pnpm import:component-media -- --root <dir> [--component kit-hero-produit]
 *        [--dry-run] [--publish] [--force] [--report out.json] [--actor <adminId|email>]
 *
 *   --dry-run   n'écrit rien (ni fichiers, ni base) : rapport prévisionnel
 *   --publish   publie les ensembles importés (par défaut : brouillons à relire
 *               puis publier dans l'admin)
 *   --force     ré-optimise les médias existants et remplace un brouillon saisi
 *               dans l'admin ; ne remplace jamais une image par un autre fichier
 *   --report    écrit le rapport JSON complet dans ce fichier
 *   --actor     id ou e-mail de l'admin auteur des médias / ensembles (défaut :
 *               aucun) ; vérifié avant toute écriture
 *
 * Prérequis : migration 0087 appliquée et registre synchronisé
 * (`metadata.mediaVariants` du composant en base).
 * Logique : `lib/media/import/run-component-media-import.ts`.
 *
 * Code de sortie : 0 si aucune erreur, 1 sinon (les avertissements — alt
 * manquant… — ne font pas échouer).
 */
import './_load-env.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db/client';
import { CliArgsError, parseImportComponentMediaArgs } from '@/lib/media/cli-args';
import { ImportActorError, runComponentMediaImport } from '@/lib/media/import/run-component-media-import';

const USAGE =
  'Usage : pnpm import:component-media -- --root <dir> [--component <key>] [--dry-run] [--publish] [--force] [--report <file>] [--actor <adminId|email>]';

async function main(): Promise<number> {
  const baseDir = process.env.INIT_CWD ?? process.cwd();
  const args = parseImportComponentMediaArgs(process.argv.slice(2), baseDir);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (!db()) {
    console.error('[import] DATABASE_URL absente : ce script exige la vraie base.');
    return 1;
  }
  console.log(
    `[import] racine=${args.root} composant=${args.componentKey ?? 'tous'} dry_run=${args.dryRun} publish=${args.publish} force=${args.force}`,
  );
  const report = await runComponentMediaImport({
    root: args.root,
    ...(args.componentKey ? { componentKey: args.componentKey } : {}),
    dryRun: args.dryRun,
    publish: args.publish,
    force: args.force,
    actorId: args.actorId ?? null,
    log: (line) => console.log(line),
  });

  if (args.report) {
    await mkdir(path.dirname(args.report), { recursive: true });
    await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`[import] rapport : ${args.report}`);
  }
  for (const w of report.warnings) console.warn(`[import] avertissement ${w.code} ${w.path} — ${w.message}`);
  for (const e of report.errors) console.error(`[import] ERREUR ${e.code} ${e.path} — ${e.message}`);
  console.log(JSON.stringify(report.summary, null, 2));
  return report.errors.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof CliArgsError) {
      console.error(`${err.message}\n${USAGE}`);
    } else if (err instanceof ImportActorError) {
      console.error(`[import] ${err.message} — rien n'a été écrit.`);
    } else {
      console.error('[import] échec', err);
    }
    process.exit(1);
  });
