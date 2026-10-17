/**
 * Résolution SERVEUR d'un code de campagne présent dans l'URL (`/kit?code=…`).
 *
 * POURQUOI
 * --------
 * Sans elle, la page se peint au prix catalogue puis saute au prix remisé une
 * fois le JavaScript hydraté et l'appel /api/coupons/redeem revenu. Pour une
 * visiteuse arrivée d'une publicité qui promet « 199 → 99 », ce saut est le
 * moment exact où le doute naît : le premier écran contredit l'annonce.
 *
 * CE QUE CE MODULE N'EST PAS
 * --------------------------
 * Il ne rend pas le serveur autoritaire sur la remise : `PromoCodeAutoApply`
 * re-valide côté client et `order-repo.createOrder` tranche à la commande.
 * C'est une GRAINE d'affichage, rien de plus.
 *
 * INVARIANT
 * ---------
 * Sans paramètre de code dans l'URL, cette fonction renvoie `undefined` sans
 * émettre la moindre requête : la page d'une visiteuse normale ne paie rien,
 * ni en latence ni en accès base.
 */
import type { AppliedCouponSeed } from '@/lib/checkout/state/use-applied-coupon';

/** Paramètres d'URL acceptés, dans l'ordre de priorité (idem côté client). */
const URL_PARAMS = ['code', 'promo', 'coupon'] as const;

export type CouponSearchParams = Partial<Record<(typeof URL_PARAMS)[number], string | string[]>>;

/**
 * Extrait et normalise le code de l'URL. MÊME normalisation que
 * `readUrlCode` (PromoCodeAutoApply) : sans quoi serveur et client
 * pourraient résoudre deux codes différents et produire un écart visible.
 */
export function readCouponSearchParam(searchParams: CouponSearchParams | undefined): string | null {
  if (!searchParams) return null;
  for (const key of URL_PARAMS) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.trim().length >= 3) {
      return value.trim().toUpperCase().slice(0, 40);
    }
  }
  return null;
}

/**
 * Résout le code de l'URL en graine d'affichage. Best-effort : toute panne
 * (base indisponible, code inconnu) renvoie `undefined` et la page se rend
 * au prix catalogue — jamais une erreur 500 sur la page de conversion.
 */
export async function resolveUrlCouponSeed(
  searchParams: CouponSearchParams | undefined,
): Promise<AppliedCouponSeed | undefined> {
  const code = readCouponSearchParam(searchParams);
  if (!code) return undefined;
  try {
    const { resolveRedeemableCode } = await import('@/lib/coupons/promo-code');
    const resolved = await resolveRedeemableCode(code);
    if (!resolved.valid || resolved.valueCents <= 0) return undefined;
    return {
      code: resolved.code,
      valueCents: resolved.valueCents,
      kind: resolved.kind,
    };
  } catch {
    return undefined;
  }
}
