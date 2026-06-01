/**
 * Cookie client « un lead-as-Purchase a déjà compté » (pont lead→Meta Purchase,
 * audit meta-lead-as-purchase-2026-06-01).
 *
 * Posé quand un lead éligible (chat / panier abandonné) est émis ET que le flag
 * NEXT_PUBLIC est ON. Lu par GTM via une variable 1st-party cookie : la balise
 * Meta `Purchase` du VRAI purchase est alors BLOQUÉE (trigger d'exception) →
 * pas de doublon pixel avec le lead-Purchase envoyé en CAPI.
 *
 * TTL = fenêtre de dédup (heures). Pur client (no-op côté serveur).
 */
export const LEAD_PURCHASE_COOKIE = 'fg_meta_lead_purchase';

export function isLeadAsPurchaseClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED === 'true';
}

/**
 * Marque le cookie (TTL = `windowHours`, défaut 24). Idempotent : ré-écrire
 * prolonge simplement la fenêtre. No-op si flag OFF ou hors navigateur.
 */
export function markLeadAsPurchaseCookie(windowHours = 24): void {
  if (typeof document === 'undefined') return;
  if (!isLeadAsPurchaseClientEnabled()) return;
  const maxAge = Math.max(1, Math.floor(windowHours * 60 * 60));
  document.cookie = `${LEAD_PURCHASE_COOKIE}=1; max-age=${maxAge}; path=/; SameSite=Lax`;
}
