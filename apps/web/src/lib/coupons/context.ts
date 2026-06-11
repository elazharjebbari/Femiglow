/**
 * Construction du `CouponContext` — PURE (prend des primitives lisibles
 * depuis headers/cookies, jamais l'objet `headers()` Next directement) afin
 * d'être identique côté Server Component et côté API checkout.
 *
 * INVARIANT : un même visiteur DOIT produire le même `visitorKey` sur les
 * deux surfaces → même bucket → prix affiché == prix facturé.
 *
 * `visitorKey` = hash anonyme stable d'un identifiant de session/_fbp.
 * Jamais de PII (email/téléphone) dans la clé.
 *
 * cf. docs/coupons-qa-2026-06-02/05-coupon-context/.
 */
import { createHash } from 'node:crypto';
import type { CouponContext, Device, VisitorType } from './types';

export interface RawContextInput {
  /** Valeur brute utm_source (query/cookie). */
  utmSource?: string | null;
  /** En-tête referer. */
  referer?: string | null;
  /** En-tête user-agent. */
  userAgent?: string | null;
  /** Identifiant de session/_fbp brut (sera hashé). */
  sessionId?: string | null;
  /** Marqueur visiteur connu (cookie returning). */
  returning?: boolean | null;
  now?: Date;
}

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i;

/** Normalise la source de trafic : utm_source > host du referer > null. */
export function normalizeTrafficSource(
  utmSource?: string | null,
  referer?: string | null,
): string | null {
  if (utmSource && utmSource.trim()) return utmSource.trim().toLowerCase();
  if (referer && referer.trim()) {
    try {
      return new URL(referer).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

export function detectDevice(userAgent?: string | null): Device {
  return userAgent && MOBILE_UA.test(userAgent) ? 'mobile' : 'desktop';
}

/** Hash anonyme stable (sha256 tronqué). Renvoie `null` si pas d'identifiant. */
export function hashVisitorKey(sessionId?: string | null): string | null {
  if (!sessionId || !sessionId.trim()) return null;
  const h = createHash('sha256').update(sessionId.trim()).digest('hex');
  return `vk_${h.slice(0, 16)}`;
}

export function buildCouponContext(raw: RawContextInput): CouponContext {
  const visitorType: VisitorType | undefined =
    raw.returning === true ? 'returning' : raw.returning === false ? 'first' : undefined;

  return {
    trafficSource: normalizeTrafficSource(raw.utmSource, raw.referer),
    device: detectDevice(raw.userAgent),
    visitorType,
    visitorKey: hashVisitorKey(raw.sessionId),
    now: raw.now,
  };
}
