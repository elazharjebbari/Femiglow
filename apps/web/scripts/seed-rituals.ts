/**
 * Seed du wall « Rituels partagés » avec des avis FemiGlow réalistes.
 *
 * Usage :
 *   pnpm --filter @femiglow/web tsx scripts/seed-rituals.ts            # peuple
 *   pnpm --filter @femiglow/web tsx scripts/seed-rituals.ts --dry-run  # stats seulement
 *
 * Idempotent : repérage par hash du body normalisé. Re-run sans danger.
 *
 * Cf. src/lib/rituals/seed-data.ts — distribution éditoriale (Kolenda).
 */
/* eslint-disable no-console */
import './_load-env.mjs';
import { db, memoryStore, schema } from '@/lib/db/client';
import { eq } from 'drizzle-orm';
import {
  insertPhoto,
  insertRitual,
  refreshRitualAggregate,
} from '@/lib/db/queries/rituals';
import { SEED_RITUALS, getSeedStats } from '@/lib/rituals/seed-data';
import { bodyHash } from '@/lib/rituals/duplicate-detection';

const PRODUCT_KEY = 'pack-femiglow';

async function existingHashes(): Promise<Set<string>> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select({ body: schema.ritualTestimonials.body })
      .from(schema.ritualTestimonials)) as Array<{ body: string }>;
    return new Set(rows.map((r) => bodyHash(r.body)));
  }
  return new Set(
    Array.from(memoryStore().ritualTestimonials.values()).map((r) => bodyHash(r.body)),
  );
}

async function backdate(ritualId: string, createdAt: Date): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonials)
      .set({ createdAt })
      .where(eq(schema.ritualTestimonials.id, ritualId));
    return;
  }
  const row = memoryStore().ritualTestimonials.get(ritualId);
  if (row) {
    memoryStore().ritualTestimonials.set(ritualId, { ...row, createdAt });
  }
}

export interface RitualsSeedOptions {
  dryRun?: boolean;
  onProgress?: (label: string, fraction?: number) => void;
}

export interface RitualsSeedReport {
  inserted: number;
  skipped: number;
  total: number;
}

export async function runRitualsSeed(
  opts: RitualsSeedOptions = {},
): Promise<RitualsSeedReport> {
  const dryRun = opts.dryRun ?? false;
  const stats = getSeedStats();
  if (dryRun) {
    return { inserted: 0, skipped: 0, total: stats.total };
  }

  opts.onProgress?.('Lecture hashes existants', 0.1);
  const skip = await existingHashes();
  let inserted = 0;
  let skipped = 0;
  const total = SEED_RITUALS.length;
  let processed = 0;

  for (const seed of SEED_RITUALS) {
    processed += 1;
    opts.onProgress?.(`Ritual ${processed}/${total}`, processed / total);
    const hash = bodyHash(seed.body);
    if (skip.has(hash)) {
      skipped += 1;
      continue;
    }

    const createdAt = new Date(Date.now() - seed.daysAgo * 86400_000);
    const publishedAt =
      seed.status === 'APPROVED'
        ? new Date(createdAt.getTime() + 18 * 3600_000)
        : null;

    const ritual = await insertRitual({
      productKey: PRODUCT_KEY,
      body: seed.body,
      bodyOriginal: seed.bodyOriginal ?? seed.body,
      wouldRecommend: seed.wouldRecommend,
      ritualTags: seed.ritualTags,
      authorFirstName: seed.authorFirstName,
      authorCity: seed.authorCity,
      initiatedSince: seed.initiatedSince,
      isAnonymous: seed.isAnonymous ?? false,
      language: seed.language ?? 'fr',
      source: seed.source,
      verifiedPurchase: seed.verifiedPurchase,
      status: seed.status,
      autoFlags: seed.autoFlags ?? [],
      featured: seed.featured ?? false,
      publishedAt,
    });

    await backdate(ritual.id, createdAt);

    if (seed.photos && seed.photos.length > 0) {
      for (let i = 0; i < seed.photos.length; i++) {
        const p = seed.photos[i]!;
        await insertPhoto({
          testimonialId: ritual.id,
          url: p.url,
          thumbUrl: p.url,
          width: p.width,
          height: p.height,
          byteSize: 200_000,
          mime: 'image/jpeg',
          alt: p.alt ?? null,
          position: i,
          facesStatus: 'OK',
          facesCount: 0,
        });
      }
    }

    inserted += 1;
  }

  opts.onProgress?.('Rafraîchissement agrégat', 0.95);
  await refreshRitualAggregate(PRODUCT_KEY);
  return { inserted, skipped, total };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stats = getSeedStats();
  console.log('[seed-rituals] distribution prévue :');
  console.log(`  total : ${stats.total}`);
  console.log(
    `  signal : oui=${stats.bySignal.oui} · hesite=${stats.bySignal.hesite} · non=${stats.bySignal.non}`,
  );
  console.log(
    `  status : APPROVED=${stats.byStatus.APPROVED} · PENDING=${stats.byStatus.PENDING} · REJECTED=${stats.byStatus.REJECTED} · HIDDEN=${stats.byStatus.HIDDEN}`,
  );
  console.log(`  avec photos : ${stats.withPhotos}`);
  console.log(`  verified_purchase : ${stats.verified}`);
  console.log(`  featured : ${stats.featured}`);

  const report = await runRitualsSeed({ dryRun });
  if (dryRun) {
    console.log('[seed-rituals] dry-run terminé.');
  } else {
    console.log(
      `[seed-rituals] terminé. Insérés : ${report.inserted}, déjà présents : ${report.skipped}.`,
    );
  }
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-rituals] échec', err);
    process.exit(1);
  });
}
