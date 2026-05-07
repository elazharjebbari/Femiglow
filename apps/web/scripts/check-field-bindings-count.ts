/**
 * CLI : audit léger des champs Components-CMS.
 *
 * Compare le nombre de fields du registre TS vs. le nombre de bindings
 * `published` en DB (ou memory store). Aide à détecter les dérives :
 *   - registre étendu mais seed jamais relancé → fields manquants en DB.
 *   - registre nettoyé mais seed sans `--reconcile` → orphans en DB.
 *
 * Sortie :
 *   {
 *     "components": [
 *       { "key": "home-hero", "registry": 5, "published": 5, "missing": [], "orphan": [] }
 *     ],
 *     "summary": { "registryFields": 12, "publishedBindings": 12, "missing": 0, "orphan": 0 }
 *   }
 *
 * Exit code 1 si au moins un missing/orphan détecté (utile en CI).
 */
import { SITE_COMPONENT_REGISTRY } from '@/lib/components/registry';
import { listBindingsByComponent } from '@/lib/db/queries/component-fields';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';

interface ComponentReport {
  key: string;
  registry: number;
  published: number;
  missing: string[];
  orphan: string[];
}

async function main(): Promise<void> {
  const components: ComponentReport[] = [];
  let registryTotal = 0;
  let publishedTotal = 0;
  let missingTotal = 0;
  let orphanTotal = 0;

  for (const seed of SITE_COMPONENT_REGISTRY) {
    const fields = seed.fields ?? [];
    if (fields.length === 0) continue;

    const cmp = await getSiteComponentByKey(seed.key);
    if (!cmp) {
      components.push({
        key: seed.key,
        registry: fields.length,
        published: 0,
        missing: fields.map((f) => f.key),
        orphan: [],
      });
      registryTotal += fields.length;
      missingTotal += fields.length;
      continue;
    }

    const bindings = await listBindingsByComponent(cmp.id);
    const publishedKeys = new Set(
      bindings.filter((b) => b.status === 'published').map((b) => b.fieldKey),
    );
    const registryKeys = new Set(fields.map((f) => f.key));

    const missing = [...registryKeys].filter((k) => !publishedKeys.has(k));
    const orphan = [...publishedKeys].filter((k) => !registryKeys.has(k));

    components.push({
      key: seed.key,
      registry: registryKeys.size,
      published: publishedKeys.size,
      missing,
      orphan,
    });
    registryTotal += registryKeys.size;
    publishedTotal += publishedKeys.size;
    missingTotal += missing.length;
    orphanTotal += orphan.length;
  }

  const summary = {
    registryFields: registryTotal,
    publishedBindings: publishedTotal,
    missing: missingTotal,
    orphan: orphanTotal,
  };
  console.log(JSON.stringify({ components, summary }, null, 2));

  if (missingTotal > 0 || orphanTotal > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('check-field-bindings-count failed', err);
  process.exit(1);
});
