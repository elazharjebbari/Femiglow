/**
 * Seeder products — réutilise `runProductsSeed()` du script CLI existant.
 */
import { runProductsSeed } from '../../../../scripts/seed-products';
import type { SeederContext, SeederResult } from '../types';

export async function productsSeeder(
  ctx: SeederContext,
): Promise<SeederResult> {
  ctx.onProgress?.('Produits + variantes + override SEO', 0.1);
  const result = await runProductsSeed(ctx.actorId ?? null);
  return {
    stats: { products: result.products, variants: result.variants },
    summary: `${result.products} produit · ${result.variants} variantes`,
  };
}
