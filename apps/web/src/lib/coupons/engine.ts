/**
 * Moteur de coupons.
 *
 * Architecture testable :
 *  - `applyCoupon` / `selectCoupon` / `computeResolvedPricing` sont PURES
 *    (aucune I/O) → testables exhaustivement sans DB.
 *  - `resolveCoupon` / `resolveProductPricing` sont les variantes SERVER
 *    qui chargent les définitions via le repo (caché) puis délèguent au
 *    cœur pur.
 *
 * INVARIANT MAÎTRE : la sortie est strictement une `PromoComputation`
 * (+ ref coupon) → tous les consommateurs aval (`PriceDisplay`, snapshot,
 * JSON-LD, tracking, repricing) restent inchangés. Le prix AFFICHÉ doit
 * être égal au prix FACTURÉ : ce module est la source unique appelée aux
 * trois points (affichage, snapshot, order-repo).
 *
 * cf. docs/coupons-qa-2026-06-02/{02,03,04,19}-*.
 */
import { computePromo, type PromoComputation } from '@/lib/utils/promo';
import { pickBucket } from './bucketing';
import { isActiveEligible, isCandidate } from './eligibility';
import type {
  CouponBucket,
  CouponContext,
  CouponDef,
  CouponType,
  PricingInput,
  ResolvedPricing,
} from './types';

/**
 * Applique une définition de coupon à un prix de base — PUR.
 *
 * Calcule un `promoPriceCents` candidat puis DÉLÈGUE à `computePromo`
 * (réutilise la garde « promo > 0 ET promo < prix sinon inactive » et le
 * framing Kolenda — aucune duplication). Conséquences notables :
 *  - montant fixe ≥ prix → candidat ≤ 0 → `active:false`, prix plein ;
 *  - percent = 100 → candidat 0 → `active:false` (0 n'est pas une promo) ;
 *  - percent = 0 → candidat = prix → `active:false`.
 * Ne lève jamais et ne renvoie jamais un prix négatif.
 */
export function applyCoupon(priceCents: number, coupon: CouponDef): PromoComputation {
  const base = Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0;

  let candidate: number;
  if (coupon.valueKind === 'fixed_amount') {
    candidate = base - Math.max(0, Math.round(coupon.valueAmount));
  } else {
    // percent — borné [0,100] par sécurité.
    const pct = Math.min(100, Math.max(0, coupon.valueAmount));
    candidate = Math.round(base * (1 - pct / 100));
  }

  // computePromo gère candidate<=0 / candidate>=base → active:false (prix plein).
  return computePromo(base, candidate);
}

/**
 * Sélectionne le coupon applicable parmi une liste — PUR.
 * Filtre les candidats (statut/fenêtre/éligibilité/cible) puis, en
 * non-cumul, retient le plus prioritaire ; tie-break déterministe :
 * priorité desc → createdAt asc → id asc.
 */
export function selectCoupon(
  coupons: CouponDef[],
  ctx: CouponContext,
  now: Date,
): CouponDef | null {
  const candidates = coupons.filter((c) => isCandidate(c, ctx, now));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const at = a.createdAt.getTime();
    const bt = b.createdAt.getTime();
    if (at !== bt) return at - bt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return candidates[0] ?? null;
}

/**
 * Sélectionne un coupon actif/éligible d'un TYPE donné (sans contrainte de
 * cible) — PUR. Utilisé pour les coupons non-prix (ex. `rescue` = avantage
 * non monétaire). Tie-break déterministe identique à `selectCoupon`.
 */
export function selectCouponByType(
  coupons: CouponDef[],
  ctx: CouponContext,
  now: Date,
  type: CouponType,
): CouponDef | null {
  const candidates = coupons.filter(
    (c) => c.type === type && c.mode === 'auto' && isActiveEligible(c, ctx, now),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const at = a.createdAt.getTime();
    const bt = b.createdAt.getTime();
    if (at !== bt) return at - bt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return candidates[0] ?? null;
}

/**
 * Résout l'offre de SAUVETAGE (Phase 2) — server-only.
 * N'altère JAMAIS le prix : renvoie seulement quel coupon `rescue` est actif
 * pour ce visiteur et son bucket (treatment voit l'offre ; holdout = contrôle).
 * Tolérant : toute erreur → `null` (aucune offre, aucun crash).
 */
export async function resolveRescueCoupon(
  ctx: CouponContext,
): Promise<{ coupon: CouponDef; bucket: CouponBucket } | null> {
  const now = ctx.now ?? new Date();
  try {
    const { listAutoCoupons } = await import('@/lib/db/queries/coupon-repo');
    const coupons = await listAutoCoupons();
    const coupon = selectCouponByType(coupons, ctx, now, 'rescue');
    if (!coupon) return null;
    const bucket = pickBucket(ctx.visitorKey, coupon.id, coupon.holdoutPct);
    return { coupon, bucket };
  } catch {
    return null;
  }
}

/**
 * Compose le pricing final à partir d'un coupon DÉJÀ sélectionné — PUR.
 *  - pas de coupon → fallback `computePromo(price, promoPriceCents)`, coupon=null ;
 *  - coupon + bucket `treatment` → `applyCoupon` ;
 *  - coupon + bucket `holdout` → fallback `computePromo` (le groupe contrôle
 *    NE bénéficie PAS de la remise coupon) MAIS la ref coupon est conservée
 *    (pour le tracking d'incrémentalité).
 *  - devise incohérente coupon/variante → ignore le coupon (fallback).
 */
export function computeResolvedPricing(
  input: PricingInput,
  coupon: CouponDef | null,
  ctx: CouponContext,
): ResolvedPricing {
  const fallback = (): PromoComputation =>
    computePromo(input.priceCents, input.promoPriceCents);

  if (!coupon) {
    return { ...fallback(), coupon: null };
  }

  // Garde défensive : seuls les coupons ciblant le PRIX produit modifient le
  // prix. Un coupon non-prix (ex. `rescue`/`future_credit`) ne doit JAMAIS
  // réduire le montant, même s'il est passé par erreur.
  if (coupon.target !== 'product_price') {
    return { ...fallback(), coupon: null };
  }

  if (coupon.currency !== input.currency) {
    return { ...fallback(), coupon: null };
  }

  const bucket = pickBucket(ctx.visitorKey, coupon.id, coupon.holdoutPct);
  const ref = { id: coupon.id, type: coupon.type, mode: coupon.mode, bucket };

  if (bucket === 'holdout') {
    return { ...fallback(), coupon: ref };
  }

  return { ...applyCoupon(input.priceCents, coupon), coupon: ref };
}

// ───────────────────────────────────────────────────────────────────────────
// Variantes SERVER (I/O) — chargent les définitions puis délèguent au pur.
// Importées dynamiquement pour garder ce module utilisable côté test pur.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Charge le coupon `auto` applicable au contexte (server-only).
 * Lit le repo (caché par tag `coupons`) puis `selectCoupon`. Ne sélectionne
 * que les coupons en mode `auto` (le mode `code` est résolu par saisie).
 * Tolérant aux pannes : toute erreur → `null` (fallback legacy en aval).
 */
export async function resolveCoupon(ctx: CouponContext): Promise<CouponDef | null> {
  const now = ctx.now ?? new Date();
  try {
    const { listAutoCoupons } = await import('@/lib/db/queries/coupon-repo');
    const coupons = await listAutoCoupons();
    return selectCoupon(coupons, ctx, now);
  } catch {
    return null;
  }
}

/**
 * Résout le pricing complet (server-only) : charge le coupon puis compose.
 * En cas d'erreur (DB indisponible), retombe SILENCIEUSEMENT sur
 * `computePromo(price, promoPriceCents)` — la page publique ne plante jamais.
 */
export async function resolveProductPricing(
  input: PricingInput,
  ctx: CouponContext,
): Promise<ResolvedPricing> {
  try {
    const coupon = await resolveCoupon(ctx);
    return computeResolvedPricing(input, coupon, ctx);
  } catch {
    return { ...computePromo(input.priceCents, input.promoPriceCents), coupon: null };
  }
}
