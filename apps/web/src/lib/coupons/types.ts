/**
 * Types domaine du système de coupons.
 *
 * Découplés de la row Drizzle (`CouponRow`) pour que le moteur reste
 * testable sans DB et que les valeurs par défaut/normalisations soient
 * explicites. cf. docs/coupons-qa-2026-06-02/.
 */
import type { PromoComputation } from '@/lib/utils/promo';

export type CouponType =
  | 'welcome_auto'
  | 'rescue'
  | 'email_unlock'
  | 'manual_code'
  | 'post_purchase';

export type CouponMode = 'auto' | 'code';
export type CouponStatus = 'draft' | 'active' | 'paused' | 'archived';
export type CouponValueKind = 'fixed_amount' | 'percent';
export type CouponTarget = 'product_price' | 'shipping' | 'future_credit';
export type CouponUsageScope = 'unlimited' | 'once_per_visitor' | 'global_cap';
export type CouponBucket = 'treatment' | 'holdout';
export type CouponEventPhase = 'exposed' | 'applied' | 'converted';

export type VisitorType = 'first' | 'returning';
export type Device = 'mobile' | 'desktop';

/**
 * Règles d'éligibilité — toutes optionnelles. `{}` (tout vide) = tout le
 * trafic est éligible. Les clés présentes sont combinées en ET logique.
 */
export interface CouponEligibility {
  /** Sources de trafic autorisées (utm_source / referer normalisé). */
  trafficSources?: string[];
  /** Type de visiteur autorisé. */
  visitorType?: VisitorType;
  /** Devices autorisés. */
  devices?: Device[];
}

/**
 * Définition de campagne normalisée consommée par le moteur.
 * Les dates sont des `Date` (jamais des strings) pour comparaison sûre.
 */
export interface CouponDef {
  id: string;
  label: string;
  code: string | null;
  type: CouponType;
  mode: CouponMode;
  status: CouponStatus;
  valueKind: CouponValueKind;
  /** Centimes si `fixed_amount` ; points de % (0..100) si `percent`. */
  valueAmount: number;
  target: CouponTarget;
  currency: string;
  eligibility: CouponEligibility;
  startsAt: Date | null;
  endsAt: Date | null;
  stackable: boolean;
  usageScope: CouponUsageScope;
  usageCap: number | null;
  usageCount: number;
  /** 0..100 — part d'éligibles placés en groupe contrôle. */
  holdoutPct: number;
  priority: number;
  /** Sert au tie-break déterministe (le plus ancien gagne à priorité égale). */
  createdAt: Date;
}

/**
 * Contexte d'évaluation. Construit côté Server Component (headers/cookies)
 * et côté API checkout (req) — DOIT produire le même `visitorKey` pour un
 * visiteur donné afin de garantir un bucket stable (invariant prix).
 */
export interface CouponContext {
  visitorType?: VisitorType;
  trafficSource?: string | null;
  device?: Device;
  /** Hash anonyme stable du visiteur (jamais de PII). `null` → treatment. */
  visitorKey?: string | null;
  /** Horloge injectée — jamais `Date.now()` réel dans le moteur. */
  now?: Date;
}

/** Référence légère du coupon résolu, attachée au pricing pour le tracking. */
export interface ResolvedCouponRef {
  id: string;
  type: CouponType;
  mode: CouponMode;
  bucket: CouponBucket;
}

/**
 * Sortie du moteur : strictement la forme `PromoComputation` (zéro
 * régression aval) + la référence coupon (nullable).
 */
export interface ResolvedPricing extends PromoComputation {
  coupon: ResolvedCouponRef | null;
}

/** Entrée prix d'une variante pour la résolution. */
export interface PricingInput {
  priceCents: number;
  promoPriceCents: number | null;
  sku?: string;
  currency: string;
}
