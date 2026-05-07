/**
 * Seed products — Le Kit FemiGlow + variantes + override SEO produit enrichi.
 *
 * Idempotent : ré-applique les valeurs seed à chaque exécution.
 *
 * Usage : `pnpm tsx scripts/seed-products.ts`
 */
import {
  createProduct,
  getProductBySlug,
  listVariants,
  patchProduct,
  publishProduct,
  upsertVariant,
} from '@/lib/db/queries/products';
import { upsertOverride } from '@/lib/db/queries/seo';
import type { Product, ProductVariant } from '@/lib/products/types';

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

const SEEDS: ProductSeed[] = [
  {
    slug: 'le-kit',
    title: 'Le Kit FemiGlow',
    tagline: 'Le rituel intime complet, pensé au Maroc.',
    description: [
      'Le Kit FemiGlow réunit les trois gestes du Rituel : nettoyer en douceur,',
      'équilibrer le pH, hydrater. Formulé sans parfum agressif, validé en clinique,',
      'inspiré du hammam — pour une routine quotidienne apaisée.',
    ].join(' '),
    category: 'kit',
    tags: ['rituel', 'soin intime', 'pH', 'hammam'],
    featured: true,
    variants: [
      {
        sku: 'FEMI-KIT-30',
        label: 'Format découverte (30 mL)',
        priceCents: 2900,
        weightG: 80,
        attributes: { volume: '30 mL', usage: 'découverte' },
      },
      {
        sku: 'FEMI-KIT-100',
        label: 'Format complet (100 mL)',
        priceCents: 4900,
        promoPriceCents: 4400,
        weightG: 220,
        attributes: { volume: '100 mL', usage: 'rituel quotidien' },
      },
      {
        sku: 'FEMI-KIT-200',
        label: 'Format duo (200 mL)',
        priceCents: 8900,
        weightG: 420,
        inventoryStatus: 'low_stock',
        attributes: { volume: '200 mL', usage: 'duo / cure longue' },
      },
    ],
    seo: {
      title: 'Le Kit FemiGlow — Rituel intime complet 30/100/200 mL',
      description:
        'Le Kit FemiGlow : nettoyant doux, soin pH-équilibré, brume hydratante. 3 formats. Livraison Maroc + Europe. Conçu en clinique.',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Le Kit FemiGlow',
        description:
          'Soin intime complet : nettoyant doux, soin pH-équilibré, brume hydratante.',
        brand: { '@type': 'Brand', name: 'FemiGlow' },
        offers: [
          {
            '@type': 'Offer',
            sku: 'FEMI-KIT-30',
            priceCurrency: 'EUR',
            price: '29.00',
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/kit`,
          },
          {
            '@type': 'Offer',
            sku: 'FEMI-KIT-100',
            priceCurrency: 'EUR',
            price: '44.00',
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/kit`,
          },
          {
            '@type': 'Offer',
            sku: 'FEMI-KIT-200',
            priceCurrency: 'EUR',
            price: '89.00',
            availability: 'https://schema.org/LimitedAvailability',
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
      currency: 'EUR',
      inventoryStatus: v.inventoryStatus ?? 'available',
      weightG: v.weightG ?? null,
      attributes: v.attributes ?? {},
      position,
    });
    position += 1;
  }

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

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed-products] erreur:', err);
    process.exit(1);
  });
}
