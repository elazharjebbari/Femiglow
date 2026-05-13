/**
 * Phase seed — délègue à l'orchestrateur des seeders existant.
 * On ne ré-implémente pas: on appelle séquentiellement chaque seeder du registry filtré.
 */
import type { PhaseContext, PhaseResult } from '../types';
import { ResetError } from '../errors';
import { SEEDERS_REGISTRY } from '../../seeders/registry';
import type { SeederContext } from '../../seeders/types';

const CRITICAL_SEEDER_IDS = new Set([
  'app-config-navigation',
  'app-config-flags',
  'app-config-rbac',
  'app-config-branding',
  'products',
  'form-config',
]);

export async function runSeed(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run: seeders non lancés' };
  }

  const ids = new Set(ctx.plan.seederIds);
  const selected = SEEDERS_REGISTRY.filter((s) => ids.has(s.id));

  let completed = 0;
  let failed = 0;
  const errors: Array<{ id: string; message: string }> = [];

  for (let i = 0; i < selected.length; i += 1) {
    if (ctx.signal.aborted) break;
    const seeder = selected[i]!;
    const fraction = (i + 1) / selected.length;
    ctx.onProgress?.(`seed: ${seeder.label}`, fraction);

    const sctx: SeederContext = {
      actorId: ctx.config.actorId,
      signal: ctx.signal,
      onProgress: (label, frac) => {
        ctx.onProgress?.(`${seeder.id} · ${label}`, frac);
      },
    };

    try {
      await seeder.run(sctx);
      completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ id: seeder.id, message });
      failed += 1;
      if (CRITICAL_SEEDER_IDS.has(seeder.id)) {
        throw new ResetError(
          'SEED_CONTRACT_BROKEN', 'seed',
          `Seeder critique ${seeder.id} a planté: ${message}`,
          err,
          { failedSoFar: failed, completedSoFar: completed },
        );
      }
    }
  }

  return {
    stats: { completed, failed, total: selected.length, errors },
    summary: `${completed}/${selected.length} seeders OK${failed ? ` · ${failed} échecs non critiques` : ''}`,
    warnings: failed > 0 ? errors.map((e) => `${e.id}: ${e.message}`) : undefined,
  };
}
