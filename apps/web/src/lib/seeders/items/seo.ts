/**
 * Seeder SEO — réutilise `runSeoSeed()` du script CLI existant.
 */
import { runSeoSeed } from '../../../../scripts/seed-seo';
import type { SeederContext, SeederResult } from '../types';

export async function seoSeeder(ctx: SeederContext): Promise<SeederResult> {
  ctx.onProgress?.('Settings SEO + 13 overrides', 0.1);
  const result = await runSeoSeed(ctx.actorId ?? null);
  return {
    stats: { overrides: result.overrides, settings: 1 },
    summary: `Settings + ${result.overrides} overrides upserted`,
  };
}
