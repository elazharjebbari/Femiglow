/**
 * generate-default-mapping.ts — Génère le fichier default-mapping.json
 * depuis le code source `event-mapping.ts`.
 *
 * Usage :
 *   pnpm --filter @femiglow/web exec tsx scripts/event-mappings/generate-default-mapping.ts
 *
 * Source de vérité : `apps/web/src/lib/tracking/providers/event-mapping.ts`
 * Destination     : `docs/event-mappings/20-data/default-mapping.json`
 *
 * cf. ADR-002 (default config restore)
 */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import dynamique pour récupérer le MAP du code source
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const OUTPUT = join(REPO_ROOT, 'docs/event-mappings/20-data/default-mapping.json');

async function main() {
  // Import dynamique (resolu via le tsconfig paths du repo)
  const { mapEventName } = await import('@/lib/tracking/providers/event-mapping');

  // On lit la const MAP via require interne (event-mapping.ts l'exporte indirectement via mapEventName)
  // Plus simple : on liste tous les events du catalog et on calcule chaque mapping.
  const { EVENT_CATALOG } = await import('@/lib/tracking/event-catalog');

  const KINDS = ['meta', 'google_ga4', 'google_ads', 'tiktok', 'snap', 'pinterest'] as const;

  // Heuristique custom Meta : si le nom contient '_' minuscule ou matche pas un standard,
  // on flag isCustom=true. Liste blanche des standards Meta connus :
  const META_STANDARD = new Set([
    'PageView',
    'ViewContent',
    'AddToCart',
    'InitiateCheckout',
    'Purchase',
    'Lead',
    'CompleteRegistration',
    'AddPaymentInfo',
    'AddShippingInfo',
    'Search',
    'Contact',
    'Subscribe',
    'AddToWishlist',
    'StartTrial',
  ]);

  const mappings: Record<string, Record<string, unknown>> = {};

  for (const entry of EVENT_CATALOG) {
    const eventCells: Record<string, unknown> = {};
    for (const kind of KINDS) {
      const mappedName = mapEventName(entry.name, kind);
      eventCells[kind] = {
        mappedName: mappedName ?? null,
        isCustom: kind === 'meta' && mappedName !== null ? !META_STANDARD.has(mappedName) : false,
        isEnabled: mappedName !== null,
        notes: null,
      };
    }
    mappings[entry.name] = eventCells;
  }

  // Calcul checksum déterministe du payload mappings
  const sortedJson = JSON.stringify(mappings, Object.keys(mappings).sort());
  const checksum = 'sha256:' + createHash('sha256').update(sortedJson).digest('hex');

  const output = {
    _meta: {
      schemaVersion: 1,
      name: 'FemiGlow Factory Default',
      generatedFromCode: 'apps/web/src/lib/tracking/providers/event-mapping.ts',
      generatedAt: new Date().toISOString().slice(0, 10),
      checksum,
      notes:
        "Source de vérité du factory mapping FemiGlow. " +
        "Re-générer avec `pnpm tracking:generate-default-mapping`. " +
        "Le test CI `pnpm tracking:check-default-mapping` garantit l'alignement avec event-mapping.ts.",
    },
    mappings,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`✓ Generated ${OUTPUT}`);
  console.log(`  Events: ${Object.keys(mappings).length}`);
  console.log(`  Checksum: ${checksum}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
