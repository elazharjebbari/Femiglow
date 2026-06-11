/* eslint-disable no-console -- CLI de provisioning : la sortie console EST l'interface. */
/**
 * Seed COMPLET headless — provisioning d'un environnement (local, CI, remote).
 *
 * Exécute tous les seeders du registry (`/admin/settings/seeders`) dans l'ordre
 * canonique, en appelant directement `seeder.run(ctx)` (sans le job-store/SSE de
 * l'orchestrateur admin). Tous les seeders sont idempotents (UPSERT / skip).
 *
 * Pré-requis :
 *   - `DATABASE_URL` pointant sur un Postgres migré (`pnpm db:migrate-safe`).
 *   - `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` (ou un admin déjà
 *     présent) : l'`actorId` est un `admin_users.id` VALIDE car plusieurs
 *     seeders écrivent `updated_by` / `actor_id` (FK → admin_users).
 *   - Pour les providers chat + FAQ + centroids d'intent : au moins une clé
 *     `CHAT_*_API_KEY` (sinon ces 3 feeds se dégradent gracieusement à 0 lignes).
 *
 * Usage :
 *   tsx scripts/seed-all.ts                 # tous les feeds
 *   tsx scripts/seed-all.ts products seo    # sous-ensemble par id
 */
import { ensureBootstrapAdmin } from '@/lib/auth/bootstrap-admin';
import { db, schema } from '@/lib/db/client';
import { SEEDERS_REGISTRY } from '@/lib/seeders/registry';
import type { SeederContext } from '@/lib/seeders/types';

async function resolveActorId(): Promise<string> {
  // 1) Crée l'admin bootstrap si les variables d'env sont posées (no-op sinon).
  await ensureBootstrapAdmin().catch(() => undefined);
  // 2) Récupère un admin_users.id valide (FK `updated_by` / `actor_id`).
  const d = db();
  if (!d) {
    throw new Error(
      '[seed-all] Aucune connexion DB — vérifie DATABASE_URL (Postgres migré).',
    );
  }
  const rows = await d
    .select({ id: schema.adminUsers.id })
    .from(schema.adminUsers)
    .limit(1);
  const actorId = rows[0]?.id;
  if (!actorId) {
    throw new Error(
      '[seed-all] Aucun admin_users en base. Pose ADMIN_BOOTSTRAP_EMAIL + ' +
        'ADMIN_BOOTSTRAP_PASSWORD (ou crée un admin) puis relance.',
    );
  }
  return actorId;
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const list = only.length
    ? SEEDERS_REGISTRY.filter((s) => only.includes(s.id))
    : SEEDERS_REGISTRY;

  const actorId = await resolveActorId();
  console.log(`[seed-all] actor=${actorId} · ${list.length} feed(s)\n`);

  const ctx: SeederContext = {
    actorId,
    signal: new AbortController().signal,
    onProgress: () => undefined,
  };

  let ok = 0;
  let ko = 0;
  for (const seeder of list) {
    const t = Date.now();
    try {
      const result = await seeder.run(ctx);
      const ms = Date.now() - t;
      const summary = result.summary || JSON.stringify(result.stats);
      console.log(`✓ ${seeder.id} (${ms}ms) — ${summary}`);
      ok += 1;
    } catch (err) {
      const e = err as Error & { cause?: unknown };
      const cause = e.cause instanceof Error ? ` || ${e.cause.message}` : '';
      console.error(`✗ ${seeder.id} — ${e.message}${cause}`);
      ko += 1;
    }
  }

  console.log(`\n[seed-all] terminé : ok=${ok} ko=${ko}`);
  if (ko > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error('[seed-all] échec fatal :', err);
    process.exit(1);
  });
