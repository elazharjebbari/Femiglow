/**
 * Phase ensure-admin — garantit qu'un super-admin existe après reset.
 * Recrée l'admin bootstrap (ADMIN_BOOTSTRAP_EMAIL / _PASSWORD du .env) si absent.
 *
 * Tourne JUSTE APRÈS migrate, AVANT seed et publish-components, pour que les
 * audit_events des seeders aient un actor_id valide si on en a besoin.
 */
import type { PhaseContext, PhaseResult } from '../types';
import { ResetError } from '../errors';

export async function runEnsureAdmin(ctx: PhaseContext): Promise<PhaseResult> {
  if (ctx.config.dryRun) {
    return { stats: { skipped: true, reason: 'dryRun' }, summary: 'dry-run' };
  }

  ctx.onProgress?.('Bootstrap admin', 0.3);

  // Import dynamique pour éviter de charger `env.ts` trop tôt côté CLI tsx.
  const { ensureBootstrapAdmin } = await import('@/lib/auth/bootstrap-admin');

  try {
    const result = await ensureBootstrapAdmin();
    return {
      stats: { status: result.status, email: result.email ?? null },
      summary:
        result.status === 'created'
          ? `Super-admin créé : ${result.email}`
          : result.status === 'exists'
            ? `Super-admin déjà présent : ${result.email}`
            : 'Skipped (ADMIN_BOOTSTRAP_* absents du .env)',
      warnings: result.status === 'skipped'
        ? ['ADMIN_BOOTSTRAP_EMAIL/PASSWORD manquants : aucun super-admin créé']
        : undefined,
    };
  } catch (err) {
    throw new ResetError(
      'BOOTSTRAP_ENV_MISSING', 'seed',
      `ensureBootstrapAdmin failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}
