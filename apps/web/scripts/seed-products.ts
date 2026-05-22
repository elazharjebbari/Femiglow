/**
 * Seed products — Le Kit FemiGlow + variantes + override SEO produit enrichi.
 *
 * Idempotent : ré-applique les valeurs seed à chaque exécution.
 *
 * Usage : `pnpm tsx scripts/seed-products.ts`
 */
import './_load-env.mjs';
import { sql } from 'drizzle-orm';
import {
  createProduct,
  getProductBySlug,
  listVariants,
  patchProduct,
  publishProduct,
  upsertVariant,
} from '@/lib/db/queries/products';
import { upsertOverride } from '@/lib/db/queries/seo';
import { db } from '@/lib/db/client';
import type { Product, ProductVariant } from '@/lib/products/types';

const DEFAULT_STOCK_AVAILABLE = 100;
const DEFAULT_STOCK_THRESHOLD = 5;

/**
 * S'assure que chaque variante du produit a une ligne `product_stock`
 * (avec 100 unités disponibles par défaut). Idempotent : si la ligne
 * existe déjà, on la laisse intacte (l'admin a la priorité).
 */
async function ensureDefaultStockForProduct(productId: string, actorId: string | null): Promise<void> {
  const conn = db();
  if (!conn) return;
  await conn.execute(sql`
    INSERT INTO product_stock (variant_id, sku, available, reserved, threshold_low, updated_at, updated_by)
    SELECT v.id, v.sku, ${DEFAULT_STOCK_AVAILABLE}, 0, ${DEFAULT_STOCK_THRESHOLD}, NOW(), ${actorId}
    FROM product_variants v
    WHERE v.product_id = ${productId}
    ON CONFLICT (variant_id) DO NOTHING
  `);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://femiglow.com';

interface ProductSeed {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  featured: boolean;
  variants: Array<{
    sku: string;
    label: string;
    priceCents: number;
    promoPriceCents?: number | null;
    inventoryStatus?: ProductVariant['inventoryStatus'];
    weightG?: number;
    attributes?: Record<string, string>;
  }>;
  /** SEO override scope=product targetKey=slug */
  seo: {
    title: string;
    description: string;
    structuredData?: unknown;
  };
}

/*
 * Source de vérité : `apps/web/src/data/mock/product.ts` (`mockKit`).
 *
 * - Audit 08/09 : Pack FemiGlow (manucure japonaise halal), anchoring 199 dh
 *   payé / 289 dh référence (révision 2026-05-22) — devise MAD. La pipeline marketing
 *   (`buildKitPublicProduct`) prend ses valeurs depuis la première variante,
 *   donc le SKU `FEMI-KIT-100` doit rester la première variante seedée pour
 *   que la sticky CTA et le PriceDisplay héro affichent bien 199,00 dhs.
 * - Le seed historique (3 formats 30/100/200 mL en EUR) datait d'un concept
 *   « soin intime » avant le pivot 08/09 ; les SKUs orphelins sont
 *   supprimés ici pour aligner DB et `mockKit`.
 */

const KIT_DESCRIPTION = [
  'Le pack FemiGlow réunit deux pots — une paste lissante et une powder lustrante — et un polissoir Step 4 Polish & Shine.',
  'Une manucure japonaise halal, formulée à Rabat par Souheila, biologiste et formulatrice.',
  'Sans vernis. Sans abrasion. Cinq minutes par jour suffisent.',
].join(' ');

const SEEDS: ProductSeed[] = [
  {
    slug: 'le-kit',
    title: 'Pack FemiGlow',
    tagline: 'Manucure japonaise halal. Deux gestes, un polissoir, un éclat.',
    description: KIT_DESCRIPTION,
    category: 'kit',
    tags: ['rituel', 'manucure', 'halal', 'paste-powder', 'polissoir'],
    featured: true,
    variants: [
      {
        sku: 'FEMI-KIT-100',
        label: 'Pack complet — paste + powder + polissoir',
        // Anchoring 199 dh payé / 289 dh référence (révision 2026-05-22 —
        // ancien 390 dh ajusté pour cohérence wizard recap).
        priceCents: 28900,
        promoPriceCents: 19900,
        weightG: 220,
        attributes: { format: 'pack complet', usage: 'rituel quotidien' },
      },
    ],
    seo: {
      title: 'Pack FemiGlow — manucure japonaise halal',
      description:
        'Pack FemiGlow — paste, powder et polissoir Step 4. Manucure japonaise halal, formulée à Rabat. Livraison offerte au Maroc.',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Pack FemiGlow',
        description: KIT_DESCRIPTION,
        brand: { '@type': 'Brand', name: 'FemiGlow' },
        offers: [
          {
            '@type': 'Offer',
            sku: 'FEMI-KIT-100',
            priceCurrency: 'MAD',
            // Prix affiché = prix payé (promo active). Le strike 289 dh
            // est porté côté UI (<PriceDisplay>) via `promoPriceCents`.
            price: '199.00',
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/kit`,
          },
        ],
      },
    },
  },
];

async function ensureProduct(seed: ProductSeed, actorId: string | null) {
  let existing = await getProductBySlug(seed.slug);
  let product: Product;
  if (!existing) {
    product = await createProduct({
      slug: seed.slug,
      title: seed.title,
      category: seed.category,
      actorId,
    });
  } else {
    product = existing.product;
  }

  // Patch éditorial
  const patched = await patchProduct(seed.slug, {
    title: seed.title,
    tagline: seed.tagline,
    description: seed.description,
    category: seed.category,
    tags: seed.tags,
    featured: seed.featured,
    position: 0,
  });
  if (patched) product = patched;

  // Variantes — upsert par SKU (préserve les IDs si déjà présents)
  const current = await listVariants(product.id);
  const bySku = new Map(current.map((v) => [v.sku, v]));
  let position = 0;
  for (const v of seed.variants) {
    const existingVariant = bySku.get(v.sku);
    await upsertVariant({
      ...(existingVariant ? { id: existingVariant.id } : {}),
      productId: product.id,
      sku: v.sku,
      label: v.label,
      priceCents: v.priceCents,
      promoPriceCents: v.promoPriceCents ?? null,
      currency: 'MAD',
      inventoryStatus: v.inventoryStatus ?? 'available',
      weightG: v.weightG ?? null,
      attributes: v.attributes ?? {},
      position,
    });
    position += 1;
  }

  // CHA — Stock par défaut : 100 unités disponibles par variante.
  // Idempotent (ON CONFLICT DO NOTHING) — un re-seed ne réinitialise pas
  // le stock géré par l'admin via /admin/products/stock.
  await ensureDefaultStockForProduct(product.id, actorId);

  // Publish — snapshot + status='published'
  await publishProduct(seed.slug, actorId, 'seed');

  // SEO override scope=product
  await upsertOverride({
    scope: 'product',
    targetKey: seed.slug,
    locale: 'fr-MA',
    title: seed.seo.title,
    description: seed.seo.description,
    keywords: seed.tags,
    ogTitle: seed.seo.title,
    ogDescription: seed.seo.description,
    ogImageMediaId: null,
    ogImageTemplate: 'product',
    twitterCard: 'summary_large_image',
    canonical: `${SITE_URL}/kit`,
    robotsIndex: true,
    robotsFollow: true,
    structuredData: seed.seo.structuredData ?? null,
    actorId,
  });

  return product;
}

export async function runProductsSeed(
  actorId: string | null = null,
): Promise<{ products: number; variants: number }> {
  let products = 0;
  let variants = 0;
  for (const seed of SEEDS) {
    await ensureProduct(seed, actorId);
    products += 1;
    variants += seed.variants.length;
  }
  return { products, variants };
}

async function main(): Promise<void> {
  const result = await runProductsSeed();
  console.log(
    `[seed-products] products: ${result.products} | variants: ${result.variants}`,
  );
}

// Détection « exécuté directement » en ESM (`apps/web` est un module ESM
// : `"type": "module"`, donc `require` n'existe pas). On compare le path
// du fichier courant à `process.argv[1]` après normalisation file://.
const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[seed-products] erreur:', err);
    process.exit(1);
  });
}
