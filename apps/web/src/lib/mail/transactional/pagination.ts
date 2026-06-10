/**
 * Saut de page du cockpit (CKPT-12) — calculs PURS, bornés, jamais d'erreur.
 */

export const COCKPIT_PAGE_SIZE = 50;

/** Nombre total de pages (≥ 1 même à 0 résultat — la page 1 existe toujours). */
export function pageCount(total: number, pageSize: number = COCKPIT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/**
 * Offset pour un numéro de page demandé :
 *  - page < 1 → ramenée à 1 ;
 *  - page > dernière → ramenée à la dernière ;
 *  - non-numérique → null (l'UI n'effectue AUCUNE navigation).
 */
export function offsetForPage(
  rawPage: string | number,
  total: number,
  pageSize: number = COCKPIT_PAGE_SIZE,
): number | null {
  const n = typeof rawPage === 'number' ? rawPage : Number.parseInt(String(rawPage).trim(), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return null;
  const clamped = Math.min(Math.max(1, n), pageCount(total, pageSize));
  return (clamped - 1) * pageSize;
}
