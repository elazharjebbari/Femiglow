/**
 * Seed superadmin — crée l'admin par défaut depuis les variables d'env
 * `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` / `ADMIN_BOOTSTRAP_NAME`
 * si aucun admin avec cet email n'existe déjà.
 *
 * Usage : `pnpm tsx scripts/seed-admin.ts`
 *
 * Idempotent : peut être lancé plusieurs fois sans danger.
 */
import './_load-env.mjs';
import { ensureBootstrapAdmin } from '@/lib/auth/bootstrap-admin';
import { env } from '@/lib/env';

async function main() {
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) {
    console.error(
      '[seed-admin] ADMIN_BOOTSTRAP_EMAIL et ADMIN_BOOTSTRAP_PASSWORD doivent être définis dans .env',
    );
    process.exit(1);
  }

  const result = await ensureBootstrapAdmin();
  switch (result.status) {
    case 'created':
      console.log(`[seed-admin] superadmin créé : ${result.email}`);
      break;
    case 'exists':
      console.log(`[seed-admin] superadmin déjà présent : ${result.email}`);
      break;
    case 'skipped':
      console.log('[seed-admin] ignoré (variables d\'env manquantes)');
      break;
  }
}

main().catch((err) => {
  console.error('[seed-admin] erreur:', err);
  process.exit(1);
});
