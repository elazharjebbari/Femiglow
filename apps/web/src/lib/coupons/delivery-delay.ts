/**
 * Délai d'activation du code de fidélité selon la durée MAX de livraison de la
 * ville. PUR (testable sans I/O).
 *
 * `delivery_eta` est un texte libre admin (« 24h », « 24-48h », « 48 à 72 h »,
 * « 2 jours », « 3-5 jours »). On en extrait la borne HAUTE, convertie en
 * jours, pour garantir que le code ne s'active qu'une fois la 1ʳᵉ commande
 * vraisemblablement reçue.
 *
 * cf. docs/promo-code-loyalty-2026-06-03/02-architecture.md.
 */

/** Délai par défaut (jours) si l'ETA n'est pas parsable. */
export const DEFAULT_MAX_DELIVERY_DAYS = 4;
/** Buffer ajouté à la durée de livraison avant activation (jours). */
export const ACTIVATION_BUFFER_DAYS = 1;

/**
 * Extrait la durée MAX de livraison en jours depuis un libellé ETA.
 * - heures (« h ») → jours = ceil(maxHeures / 24)
 * - jours (« j », « jour(s) ») → max jours tel quel
 * - non parsable → `DEFAULT_MAX_DELIVERY_DAYS`
 */
export function maxDeliveryDays(eta: string | null | undefined): number {
  if (!eta || typeof eta !== 'string') return DEFAULT_MAX_DELIVERY_DAYS;
  const s = eta.toLowerCase();
  const numbers = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) =>
    Number(n.replace(',', '.')),
  );
  if (numbers.length === 0) return DEFAULT_MAX_DELIVERY_DAYS;
  const max = Math.max(...numbers);
  const isDays = /jour|\bj\b|jrs|jours/.test(s);
  const isHours = /h|heure/.test(s);
  if (isDays && !isHours) return Math.max(1, Math.ceil(max));
  // par défaut on suppose des heures (cas le plus courant : « 24-48h »)
  return Math.max(1, Math.ceil(max / 24));
}

/**
 * Date d'activation = commande + durée max de livraison + buffer.
 */
export function computeActivatesAt(
  orderDate: Date,
  eta: string | null | undefined,
): Date {
  const days = maxDeliveryDays(eta) + ACTIVATION_BUFFER_DAYS;
  const d = new Date(orderDate.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
