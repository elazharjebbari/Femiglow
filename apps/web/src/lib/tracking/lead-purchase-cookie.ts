/**
 * Identifiant de PARCOURS Purchase (jpid) + cookie anti-doublon lead→Meta
 * Purchase. Audit : docs/meta-lead-as-purchase-2026-06-01 +
 * docs/meta-lead-purchase-pixel-2026-06-01.
 *
 * Rôle du cookie `fg_meta_lead_purchase` :
 *  1. **Source de vérité du `eventID` de parcours (jpid)** : à la 1ʳᵉ émission
 *     Purchase-éligible (lead chat / lead panier), on génère un `uuidv7` et on le
 *     stocke (TTL 24 h glissant). TOUS les signaux Purchase suivants du même
 *     visiteur (lead_capture, generate_lead, et le purchase) réutilisent ce jpid
 *     comme `eventID` → Meta déduplique nativement (Pixel↔Pixel, Pixel↔CAPI) →
 *     **1 seul Purchase** par parcours, même chat→commande à cheval sur minuit.
 *  2. **Blocage du pixel Purchase du VRAI achat** : cookie non vide ⇒ le trigger
 *     GTM `BLK` bloque le pixel Purchase de l'achat réel (le lead a déjà compté).
 *
 * Le jpid est poussé en dataLayer (`params.meta_purchase_eid`) ET envoyé à
 * `/api/track` (→ même `event_id` côté CAPI). Pur client, no-op côté serveur.
 */
import { uuidv7 } from '@/lib/tracking/uuid';

export const LEAD_PURCHASE_COOKIE = 'fg_meta_lead_purchase';

export function isLeadAsPurchaseClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED === 'true';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * Retourne le `eventID` de parcours (jpid) du visiteur, en le CRÉANT si absent.
 * Idempotent : tant que le cookie vit (24 h glissant), le même jpid est renvoyé.
 * No-op (retourne `null`) hors navigateur ou si le flag NEXT_PUBLIC est OFF.
 */
export function getJourneyPurchaseId(windowHours = 24): string | null {
  if (typeof document === 'undefined') return null;
  if (!isLeadAsPurchaseClientEnabled()) return null;
  const existing = readCookie(LEAD_PURCHASE_COOKIE);
  if (existing && existing !== '1') return existing; // jpid déjà posé
  const jpid = uuidv7();
  const maxAge = Math.max(1, Math.floor(windowHours * 60 * 60));
  document.cookie = `${LEAD_PURCHASE_COOKIE}=${jpid}; max-age=${maxAge}; path=/; SameSite=Lax`;
  return jpid;
}

/**
 * Lit le jpid de parcours SANS le créer. Retourne `null` si aucun lead n'a
 * encore posé le cookie. Utilisé par l'emit `purchase` : si un lead a précédé,
 * le vrai achat porte le MÊME jpid → la CAPI déduplique l'achat réel avec le
 * lead même si le ledger serveur a été perdu (restart). Pour un achat DIRECT
 * (sans lead), retourne `null` → l'achat garde son `event_id` client (dédup
 * Pixel↔CAPI standard, cf. Fix A).
 */
export function readJourneyPurchaseId(): string | null {
  const v = readCookie(LEAD_PURCHASE_COOKIE);
  return v && v !== '1' ? v : null;
}

/**
 * Pose le cookie de parcours (back-compat). Équivaut à `getJourneyPurchaseId()`
 * en ignorant la valeur — garde l'API existante des appelants. Idempotent.
 */
export function markLeadAsPurchaseCookie(windowHours = 24): void {
  getJourneyPurchaseId(windowHours);
}
