/**
 * CLI : seed des photos clientes (`product_review_photos`) depuis le
 * dossier `apps/web/public/reviews/`.
 *
 * Usage :
 *   pnpm --filter @femiglow/web tsx scripts/seed-review-photos.ts
 *   pnpm --filter @femiglow/web tsx scripts/seed-review-photos.ts --product=kit-femiglow
 *   pnpm --filter @femiglow/web tsx scripts/seed-review-photos.ts --dry-run
 *   pnpm --filter @femiglow/web tsx scripts/seed-review-photos.ts --reset
 *
 * Comportement :
 *  - Scan tous les `reviews*.jpg|.png|.webp` du dossier `/public/reviews/`.
 *  - Pour chaque fichier non encore en DB (même `src`), insère une ligne avec
 *    status='published' et display_order incrémenté à partir du max actuel.
 *  - Avec `--reset` : truncate la table avant insertion (utile en dev).
 *  - Idempotent : pas de doublon sur la combinaison (product_id, src).
 *
 * Convention de nommage :
 *   reviews{n}.jpg → display_order = n (parsé via regex). À défaut, ordre
 *   alphabétique du nom de fichier.
 */
import './_load-env.mjs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { productReviewPhotos } from '@/lib/db/schema';
import { createId } from '@/lib/ids';
import { getProductBySlug } from '@/lib/db/queries/products';
import { KIT_PRODUCT_SLUG } from '@/lib/products/public';
import { mockKit } from '@/data/mock/product';

/**
 * Résout dynamiquement l'`id` du produit kit :
 *  - en DB si la table `products` contient le slug `le-kit` (cas prod / dev seedé)
 *  - sinon retombe sur `mockKit.id` (cas dev local frais sans seed produits)
 *
 * Ainsi le seed reste idempotent même quand l'`id` DB change entre environnements.
 */
async function resolveKitProductId(): Promise<string> {
  const row = await getProductBySlug(KIT_PRODUCT_SLUG);
  return row?.id ?? mockKit.id;
}
const PUBLIC_REVIEWS_DIR = path.resolve(process.cwd(), 'public/reviews');
const ACCEPTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface CliOptions {
  productId: string;
  dryRun: boolean;
  reset: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const out: CliOptions = {
    // Sera résolu dynamiquement dans `main()` si non override par --product=.
    productId: '',
    dryRun: false,
    reset: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--reset') out.reset = true;
    else if (arg.startsWith('--product=')) out.productId = arg.slice('--product='.length);
  }
  return out;
}

function orderFromFilename(name: string): number {
  const m = name.match(/reviews?(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return 9999;
}

async function listReviewFiles(): Promise<string[]> {
  try {
    const entries = await readdir(PUBLIC_REVIEWS_DIR);
    const files: string[] = [];
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (!ACCEPTED_EXT.has(ext)) continue;
      const full = path.join(PUBLIC_REVIEWS_DIR, entry);
      const st = await stat(full);
      if (st.isFile()) files.push(entry);
    }
    return files.sort((a, b) => orderFromFilename(a) - orderFromFilename(b));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function readDimensions(filename: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(path.join(PUBLIC_REVIEWS_DIR, filename)).metadata();
  return {
    width: meta.width ?? 800,
    height: meta.height ?? 1000,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const drizzle = db();

  if (!drizzle) {
    console.error('❌ DATABASE_URL is required for this seed (memoryStore is dev-only).');
    process.exit(1);
  }

  // Résout le productId au moment du run (table products en DB ou fallback mock).
  if (!opts.productId) {
    opts.productId = await resolveKitProductId();
  }
  console.log(`Target product id: ${opts.productId}`);

  const files = await listReviewFiles();
  if (files.length === 0) {
    console.log(`⚠️  No review photos found in ${PUBLIC_REVIEWS_DIR}.`);
    console.log('   Add reviews1.jpg, reviews2.jpg, … and re-run.');
    return;
  }

  console.log(`Found ${files.length} review files in /public/reviews/`);

  if (opts.reset) {
    if (opts.dryRun) {
      console.log(`[dry-run] Would TRUNCATE product_review_photos for product '${opts.productId}'.`);
    } else {
      await drizzle
        .delete(productReviewPhotos)
        .where(eq(productReviewPhotos.productId, opts.productId));
      console.log(`Cleared all photos for product '${opts.productId}'.`);
    }
  }

  // Lecture des src déjà présents (idempotence)
  const existing = opts.reset
    ? new Set<string>()
    : new Set(
        (
          await drizzle
            .select({ src: productReviewPhotos.src })
            .from(productReviewPhotos)
            .where(eq(productReviewPhotos.productId, opts.productId))
        ).map((r) => r.src),
      );

  // Max display_order actuel
  const maxRow = await drizzle.execute<{ max_order: number | null }>(
    sql`SELECT COALESCE(MAX(display_order), -1) AS max_order
        FROM product_review_photos
        WHERE product_id = ${opts.productId}`,
  );
  // postgres-js typed result : `.rows` ou directement array (selon adapter).
  const rowsArr = (maxRow as unknown as { rows?: Array<{ max_order: number | null }> }).rows
    ?? (maxRow as unknown as Array<{ max_order: number | null }>);
  let nextOrder = ((rowsArr?.[0]?.max_order ?? -1) as number) + 1;

  let inserted = 0;
  let skipped = 0;

  for (const filename of files) {
    const src = `/reviews/${filename}`;
    if (existing.has(src)) {
      skipped++;
      continue;
    }

    const { width, height } = await readDimensions(filename);
    const fileOrder = orderFromFilename(filename);
    const displayOrder = fileOrder < 9999 ? fileOrder : nextOrder++;

    if (opts.dryRun) {
      console.log(`[dry-run]  insert ${src} (${width}x${height}, order=${displayOrder})`);
      inserted++;
      continue;
    }

    await drizzle.insert(productReviewPhotos).values({
      id: createId('rphoto'),
      productId: opts.productId,
      reviewId: null,
      src,
      alt: 'Photo cliente — Pack FemiGlow',
      width,
      height,
      blurDataUrl: null,
      displayOrder,
      status: 'published',
      reviewerInitials: null,
      reviewerCity: null,
    });
    console.log(`  ✓ ${src} (${width}x${height}, order=${displayOrder})`);
    inserted++;
  }

  console.log('\nSummary:');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already in DB): ${skipped}`);
  console.log(`  Product: ${opts.productId}`);
  if (opts.dryRun) console.log('  Mode: DRY RUN (no changes)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
