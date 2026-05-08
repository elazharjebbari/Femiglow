/**
 * Génère les variantes PNG des illustrations produit (SVG → PNG).
 *
 * **Pourquoi** : Google Merchant Center, Facebook Catalog et la plupart
 * des régies Shopping Ads **rejettent les SVG**. La spec officielle
 * Merchant n'accepte que JPG, PNG, GIF, BMP, TIFF.
 *
 * Source de vérité = `*.svg` dans `public/products/` (vectoriel, net pour
 * le rendu HTML). Cette commande synthétise un `*.png` à 1600×2000 (4:5,
 * ratio retenu pour le hero produit) sur fond crème, prêt pour Merchant.
 *
 * Idempotent : ré-exécutable, écrase les PNG existants. À lancer après
 * toute modification d'un SVG produit.
 *
 * Usage : `pnpm tsx scripts/generate-product-images.ts`
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');
const OG_DIR = path.join(PUBLIC_DIR, 'og');

/** Largeur cible du PNG. 1600 px ⇒ 4:5 = 1600×2000, conforme Merchant. */
const TARGET_WIDTH = 1600;

/**
 * Liste des SVG à convertir, regroupés par dossier source.
 * - `products/*` : illustrations produit (hero, base, fortifiant, lime).
 * - `og/kit.svg` : fallback Open Graph + image_link Merchant en dernier
 *   recours. Conservé en PNG pour cohérence avec `kit-feed.ts`
 *   (`pickMerchantImageUrl` fallback).
 */
const TARGETS: ReadonlyArray<{ dir: string; basename: string }> = [
  { dir: PRODUCTS_DIR, basename: 'kit-principale' },
  { dir: PRODUCTS_DIR, basename: 'kit-base' },
  { dir: PRODUCTS_DIR, basename: 'kit-fortifiant' },
  { dir: PRODUCTS_DIR, basename: 'kit-lime' },
  { dir: PRODUCTS_DIR, basename: 'kit-detail-mains' },
  { dir: OG_DIR, basename: 'kit' },
];

async function convertSvgToPng(
  dir: string,
  basename: string,
): Promise<{ ok: boolean; reason?: string }> {
  const svgPath = path.join(dir, `${basename}.svg`);
  const pngPath = path.join(dir, `${basename}.png`);

  try {
    await fs.access(svgPath);
  } catch {
    return { ok: false, reason: 'svg-missing' };
  }

  const svgBuffer = await fs.readFile(svgPath);

  // density=300 + width=1600 garantit un rendu net sans aliasing visible
  // sur les régies (Google compresse à son tour).
  await sharp(svgBuffer, { density: 300 })
    .resize({ width: TARGET_WIDTH, fit: 'inside', withoutEnlargement: false })
    .png({ quality: 92, compressionLevel: 9 })
    .toFile(pngPath);

  return { ok: true };
}

async function main(): Promise<void> {
  let success = 0;
  let skipped = 0;
  for (const target of TARGETS) {
    const result = await convertSvgToPng(target.dir, target.basename);
    const relPath = path.relative(PUBLIC_DIR, path.join(target.dir, target.basename));
    if (result.ok) {
      console.warn(`[product-images] ✓ ${relPath}.png généré`);
      success += 1;
    } else {
      console.warn(`[product-images] ⊘ ${relPath}.svg manquant — ignoré`);
      skipped += 1;
    }
  }
  console.warn(
    `[product-images] terminé : ${success} générés / ${skipped} ignorés`,
  );
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('[product-images] erreur:', err);
    process.exit(1);
  });
}
