/**
 * Seeder coupons — réutilise `runCouponsSeed()` du script CLI.
 * Idempotent (préserve le status existant). cf. scripts/seed-coupons.ts.
 */
import { runCouponsSeed } from '../../../../scripts/seed-coupons';
import type { SeederContext, SeederResult } from '../types';

export async function couponsSeeder(ctx: SeederContext): Promise<SeederResult> {
  ctx.onProgress?.('Coupon d’accueil (welcome_auto)', 0.5);
  const r = await runCouponsSeed(ctx.actorId ?? null);
  return {
    stats: { created: r.created, updated: r.updated },
    summary: r.created ? 'Coupon d’accueil créé' : 'Coupon d’accueil réaligné',
  };
}
