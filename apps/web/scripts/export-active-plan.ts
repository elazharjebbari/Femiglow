#!/usr/bin/env tsx
/**
 * Export du container GTM pour le plan actif (TrackingPlan v2).
 *
 * Usage :
 *   pnpm --filter @femiglow/web tsx scripts/export-active-plan.ts [--env production] [--out path]
 *
 * Lit le plan où `status='active'`, appelle `exportPlan()` depuis
 * `lib/tracking/plan/exporter.ts` (qui inclut TikTok Init + Evt mappés
 * en canonical names depuis commit 7cea8a5), et écrit le JSON sur disque.
 *
 * Le JSON produit est prêt à être importé dans GTM Web UI (Admin →
 * Import Container → workspace existant → menu "Renommer balises
 * existantes" recommandé).
 *
 * Note : ce script ne PUBLIE pas le container côté Google. Après import,
 * il faut Submit + Publish dans GTM UI.
 */
import './_load-env.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db/client';
import { trackingPlans } from '@/lib/db/schema-tracking-plan';
import { eq } from 'drizzle-orm';
import { exportPlan } from '@/lib/tracking/plan/exporter';
import type { EnvName, TrackingPlan } from '@/lib/tracking/plan/types';

interface Args {
  env: EnvName;
  out: string | null;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> & Record<string, unknown> = { env: 'production' as EnvName };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      out[k] = v ?? argv[++i];
    }
  }
  return {
    env: (out.env as EnvName) ?? 'production',
    out: (out.out as string) ?? null,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const conn = db();
  if (!conn) throw new Error('DATABASE_URL not set');

  const rows = await conn
    .select()
    .from(trackingPlans)
    .where(eq(trackingPlans.status, 'active'))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error('No active tracking plan found');

  // Le row DB ↔ TrackingPlan : les champs jsonb sont déjà décodés par
  // Drizzle. On reconstruit la forme attendue par exportPlan.
  const plan: TrackingPlan = {
    id: row.id,
    name: row.name,
    status: row.status as TrackingPlan['status'],
    version: row.version,
    providers: row.providers as TrackingPlan['providers'],
    envProfiles: row.envProfiles as TrackingPlan['envProfiles'],
    events: row.events as TrackingPlan['events'],
    settings: row.settings as TrackingPlan['settings'],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  const result = exportPlan(plan, args.env);
  const tags = (result.json as { containerVersion: { tag: Array<{ name: string }> } })
    .containerVersion.tag;
  const tikTokInit = tags.find((t) => t.name === 'TikTok Init');
  const tikTokEvts = tags.filter((t) => t.name.startsWith('TikTok Evt'));

  // eslint-disable-next-line no-console
  console.error('--- Export summary ---');
  // eslint-disable-next-line no-console
  console.error(`Plan: ${plan.id} (v${plan.version}, ${plan.status})`);
  // eslint-disable-next-line no-console
  console.error(`Env: ${args.env}`);
  // eslint-disable-next-line no-console
  console.error(`bundleId: ${result.bundleId}`);
  // eslint-disable-next-line no-console
  console.error(`Total tags: ${tags.length}`);
  // eslint-disable-next-line no-console
  console.error(`TikTok Init present: ${!!tikTokInit}`);
  // eslint-disable-next-line no-console
  console.error(`TikTok Evt tags: ${tikTokEvts.length}`);
  for (const t of tikTokEvts) {
    // eslint-disable-next-line no-console
    console.error(`  - ${t.name}`);
  }

  const outPath =
    args.out ??
    path.join(
      '/var/www/femiglow/draft',
      `container.${args.env}.${plan.id}.v${plan.version}.json`,
    );
  await fs.writeFile(outPath, JSON.stringify(result.json, null, 2));
  // eslint-disable-next-line no-console
  console.error(`Written: ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('export-active-plan failed:', err);
  process.exit(1);
});
