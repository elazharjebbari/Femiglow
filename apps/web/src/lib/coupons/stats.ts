/**
 * Calcul d'incrémentalité — PUR. Uplift = (taux conversion treatment) −
 * (taux conversion holdout). Gardes anti division-par-zéro / NaN.
 * cf. docs/coupons-qa-2026-06-02/12-admin-stats-incrementality/.
 */
import type { CouponBucket, CouponEventPhase } from './types';

export interface PhaseBucketCount {
  phase: CouponEventPhase;
  bucket: CouponBucket;
  count: number;
}

export interface CouponStats {
  exposed: { treatment: number; holdout: number };
  converted: { treatment: number; holdout: number };
  conversionRate: { treatment: number | null; holdout: number | null };
  /** Uplift absolu en points (treatment − holdout). null si non calculable. */
  upliftAbsolute: number | null;
  /** Uplift relatif (treatment/holdout − 1). null si non calculable. */
  upliftRelative: number | null;
  /** true si pas de groupe contrôle (holdout exposé = 0) → pas d'uplift. */
  noControl: boolean;
  /** true si l'échantillon est trop petit pour une lecture fiable. */
  lowSample: boolean;
}

const LOW_SAMPLE_THRESHOLD = 100;

function get(counts: PhaseBucketCount[], phase: CouponEventPhase, bucket: CouponBucket): number {
  return counts.find((c) => c.phase === phase && c.bucket === bucket)?.count ?? 0;
}

export function computeCouponStats(counts: PhaseBucketCount[]): CouponStats {
  const exposed = { treatment: get(counts, 'exposed', 'treatment'), holdout: get(counts, 'exposed', 'holdout') };
  const converted = { treatment: get(counts, 'converted', 'treatment'), holdout: get(counts, 'converted', 'holdout') };

  const rate = (conv: number, exp: number): number | null => (exp > 0 ? conv / exp : null);
  const conversionRate = {
    treatment: rate(converted.treatment, exposed.treatment),
    holdout: rate(converted.holdout, exposed.holdout),
  };

  const noControl = exposed.holdout === 0;
  const lowSample = exposed.treatment + exposed.holdout < LOW_SAMPLE_THRESHOLD;

  let upliftAbsolute: number | null = null;
  let upliftRelative: number | null = null;
  if (conversionRate.treatment !== null && conversionRate.holdout !== null) {
    upliftAbsolute = conversionRate.treatment - conversionRate.holdout;
    upliftRelative =
      conversionRate.holdout > 0 ? conversionRate.treatment / conversionRate.holdout - 1 : null;
  }

  return { exposed, converted, conversionRate, upliftAbsolute, upliftRelative, noControl, lowSample };
}
