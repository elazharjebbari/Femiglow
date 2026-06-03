/**
 * Seed du coupon d'accueil `welcome_auto` (CPN-20).
 *
 * Idempotent (D-2) : s'il existe déjà un coupon `welcome_auto`, on PRÉSERVE
 * son `status` (ne réactive pas une pause volontaire de l'opérateur) et on
 * réaligne uniquement la valeur/cible. Sinon on le crée `active`.
 *
 * Valeurs Phase 1 : -90 MAD (9000 centimes) sur le prix produit → 289 → 199,
 * AUTO pour tout le trafic, holdout=0.
 *
 * cf. docs/coupons-qa-2026-06-02/20-seed-welcome-auto/.
 */
import {
  createCoupon,
  listCoupons,
  updateCoupon,
} from '@/lib/db/queries/coupon-repo';
import type { CouponInput } from '@/lib/coupons/schemas';

export const WELCOME_AUTO_VALUE_CENTS = 9000;
export const RESCUE_HOLDOUT_PCT = 20;
export const LOYALTY_CREDIT_CENTS = 2000; // -20 MAD sur la prochaine commande
export const LOYALTY_VALIDITY_DAYS = 60;

const WELCOME_INPUT: CouponInput = {
  label: 'Geste d’accueil',
  code: null,
  type: 'welcome_auto',
  mode: 'auto',
  status: 'active',
  valueKind: 'fixed_amount',
  valueAmount: WELCOME_AUTO_VALUE_CENTS,
  target: 'product_price',
  currency: 'MAD',
  eligibility: {},
  stackable: false,
  usageScope: 'unlimited',
  holdoutPct: 0,
  priority: 0,
};

/**
 * Coupon de SAUVETAGE (Phase 2) — avantage NON monétaire (cadeau), donc
 * `target='future_credit'` + `valueAmount` nominal : il n'altère jamais le
 * prix (le moteur n'applique que `target='product_price'`). Déclenché côté
 * client (exit-intent + scroll), holdout 20% pour mesurer l'incrémental.
 */
const RESCUE_INPUT: CouponInput = {
  label: 'Sauvetage — cadeau d’accompagnement',
  code: null,
  type: 'rescue',
  mode: 'auto',
  status: 'active',
  valueKind: 'fixed_amount',
  valueAmount: 1, // nominal — jamais appliqué au prix
  target: 'future_credit',
  currency: 'MAD',
  eligibility: {},
  stackable: false,
  usageScope: 'unlimited',
  holdoutPct: RESCUE_HOLDOUT_PCT,
  priority: 0,
};

/**
 * Coupon TEMPLATE de fidélité (Phase 3). Paramètre le crédit post-achat
 * (valeur, programme on/off). Mode `code` car redeemable par code personnel.
 * Chaque commande émet un `coupon_grant` (code unique) référençant ce template.
 */
const LOYALTY_INPUT: CouponInput = {
  label: 'Crédit de fidélité',
  code: 'LOYALTY-TEMPLATE', // sentinelle interne (le client utilise un code de grant)
  type: 'post_purchase',
  mode: 'code',
  status: 'active',
  valueKind: 'fixed_amount',
  valueAmount: LOYALTY_CREDIT_CENTS,
  target: 'product_price',
  currency: 'MAD',
  eligibility: {},
  stackable: true, // le crédit fidélité se cumule avec le geste d'accueil
  usageScope: 'unlimited',
  holdoutPct: 0,
  priority: 0,
};

export interface CouponsSeedResult {
  created: number;
  updated: number;
  couponId: string;
  rescueCouponId: string;
  loyaltyCouponId: string;
}

/** Upsert idempotent par type, préservant le `status` existant (D-2). */
async function upsertByType(
  input: CouponInput,
  actorId: string | null,
  now: Date,
): Promise<{ created: number; updated: number; id: string }> {
  const existing = (await listCoupons({ type: input.type }))[0] ?? null;
  if (!existing) {
    const created = await createCoupon(input, actorId, now);
    return { created: 1, updated: 0, id: created.id };
  }
  await updateCoupon(
    existing.id,
    {
      valueKind: input.valueKind,
      valueAmount: input.valueAmount,
      target: input.target,
      holdoutPct: input.holdoutPct,
    },
    now,
  );
  return { created: 0, updated: 1, id: existing.id };
}

export async function runCouponsSeed(
  actorId: string | null = null,
  now: Date = new Date(),
): Promise<CouponsSeedResult> {
  const welcome = await upsertByType(WELCOME_INPUT, actorId, now);
  const rescue = await upsertByType(RESCUE_INPUT, actorId, now);
  const loyalty = await upsertByType(LOYALTY_INPUT, actorId, now);
  return {
    created: welcome.created + rescue.created + loyalty.created,
    updated: welcome.updated + rescue.updated + loyalty.updated,
    couponId: welcome.id,
    rescueCouponId: rescue.id,
    loyaltyCouponId: loyalty.id,
  };
}

/** Template fidélité actif (par type post_purchase), ou null. */
export async function getLoyaltyTemplate() {
  return (await listCoupons({ type: 'post_purchase' }))[0] ?? null;
}

// Exécution directe via `tsx scripts/seed-coupons.ts`.
if (process.argv[1] && process.argv[1].endsWith('seed-coupons.ts')) {
  runCouponsSeed()
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(`[seed:coupons] created=${r.created} updated=${r.updated} id=${r.couponId}`);
      process.exit(0);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[seed:coupons] échec', e);
      process.exit(1);
    });
}
