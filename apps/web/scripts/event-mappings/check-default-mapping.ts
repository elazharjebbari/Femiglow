/**
 * check-default-mapping.ts — CI safeguard.
 *
 * Vérifie que `default-mapping.json` est en sync avec le code source
 * `event-mapping.ts`. Exit 1 + diff listé si drift détecté.
 *
 * Usage CI :
 *   pnpm --filter @femiglow/web exec tsx scripts/event-mappings/check-default-mapping.ts
 *
 * Si le check échoue, l'auteur de la PR doit :
 *   pnpm --filter @femiglow/web exec tsx scripts/event-mappings/generate-default-mapping.ts
 *   git add docs/event-mappings/20-data/default-mapping.json
 *   git commit --amend --no-edit
 *
 * cf. ADR-002, 90-plan/risks.md R1
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const DEFAULT_JSON = join(REPO_ROOT, 'docs/event-mappings/20-data/default-mapping.json');

async function main() {
  const { mapEventName } = await import('@/lib/tracking/providers/event-mapping');
  const { EVENT_CATALOG } = await import('@/lib/tracking/event-catalog');

  const file = JSON.parse(readFileSync(DEFAULT_JSON, 'utf8'));
  const fileMappings = file.mappings ?? {};

  const KINDS = ['meta', 'google_ga4', 'google_ads', 'tiktok', 'snap', 'pinterest'] as const;
  const drifts: string[] = [];

  // Pour chaque event du catalog code, comparer chaque mapping vendor avec le fichier
  for (const entry of EVENT_CATALOG) {
    const fileEvent = fileMappings[entry.name];
    if (!fileEvent) {
      drifts.push(`Event manquant dans default-mapping.json : ${entry.name}`);
      continue;
    }
    for (const kind of KINDS) {
      const fromCode = mapEventName(entry.name, kind);
      const fromFile = fileEvent[kind]?.mappedName ?? null;
      if (fromCode !== fromFile) {
        drifts.push(
          `${entry.name}/${kind} : code='${fromCode ?? '(null)'}' file='${fromFile ?? '(null)'}'`,
        );
      }
    }
  }

  // Inverse : events dans le fichier mais absents du catalog code (rare mais possible)
  for (const eventName of Object.keys(fileMappings)) {
    if (!EVENT_CATALOG.find((e) => e.name === eventName)) {
      drifts.push(`Event présent dans default-mapping.json mais absent du catalog code : ${eventName}`);
    }
  }

  if (drifts.length === 0) {
    console.log('✓ default-mapping.json est en sync avec event-mapping.ts (' + Object.keys(fileMappings).length + ' events)');
    process.exit(0);
  }

  console.error(`✗ DRIFT détecté entre code et default-mapping.json :`);
  for (const d of drifts) console.error(`  - ${d}`);
  console.error(`\nRégénérer le fichier via :\n  pnpm --filter @femiglow/web exec tsx scripts/event-mappings/generate-default-mapping.ts`);
  process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
