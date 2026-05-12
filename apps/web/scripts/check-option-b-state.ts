/**
 * CLI temporaire — vérifie l'état Option B des `componentMediaBindings`.
 *
 * Affiche le total, le nombre actifs, et la liste des inactifs avec
 * `componentKey/slot`. Utilisé pendant la validation Option B
 * (CHA-230) pour confirmer qu'un override admin `is_active=false`
 * reste intact après un re-seed sans `--auto-activate`.
 */
import { SITE_COMPONENT_REGISTRY } from '@/lib/components/registry';
import { listBindingsByComponent } from '@/lib/db/queries/component-bindings';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';

async function main(): Promise<void> {
  let total = 0;
  let active = 0;
  const inactive: string[] = [];

  for (const seed of SITE_COMPONENT_REGISTRY) {
    const cmp = await getSiteComponentByKey(seed.key);
    if (!cmp) continue;
    const bindings = await listBindingsByComponent(cmp.id);
    for (const b of bindings) {
      total += 1;
      if (b.isActive) {
        active += 1;
      } else {
        inactive.push(`${seed.key}/${b.slot}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        total,
        active,
        inactive: inactive.length,
        inactiveList: inactive.sort(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
