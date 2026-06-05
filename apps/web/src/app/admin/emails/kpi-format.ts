/**
 * Formatage & sémantique des KPI du dashboard emailing (`/admin/emails`).
 *
 * Fonctions PURES extraites de `page.tsx` pour être testables en isolation
 * (le RSC `page.tsx` lit la DB et n'est pas montable en jsdom). `page.tsx`
 * importe désormais ces helpers — une seule source de vérité pour le formatage
 * et la sémantique couleur des cartes.
 *
 * Oracles métier couverts (module 01, F-001) :
 *  - `pct(num, 0)` → '—' (jamais 'NaN %' ni division par zéro).
 *  - `fmt(n)` → fr-FR avec séparateur de milliers (espace insécable).
 *  - `deliveredTone()` : la carte « Livrés » passe en ALERTE (rose) quand des
 *    emails partent (`sent ≥ seuil`) mais qu'aucune livraison n'est confirmée
 *    (`delivered = 0`) — signalement de l'anomalie « webhook delivery muet »
 *    (audit F-001), au lieu d'un « 0 » neutre trompeur.
 */
import type { OutboxKpi } from '@/lib/admin/emails/queries';

export type KpiTone = 'neutral' | 'amber' | 'rose' | 'emerald';

/**
 * Seuil d'envois à partir duquel un `delivered = 0` devient suspect.
 * En dessous (très petit volume), 0 livraison confirmée peut être un simple
 * effet de bord de timing webhook ; au-dessus, c'est une anomalie à signaler.
 */
export const DELIVERY_SILENCE_MIN_SENT = 1;

/** Seuil au-delà duquel la file d'attente (`pending`) passe en ton ambre. */
export const PENDING_AMBER_THRESHOLD = 50;

/** Formate un entier en fr-FR (séparateur de milliers = espace insécable). */
export function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

/**
 * Pourcentage `num/den` à 1 décimale, suffixé ` %`.
 * Quand `den === 0` → '—' (anti-division-par-zéro ; surtout PAS '0.0 %' ni
 * 'NaN %' qui mentiraient sur l'absence de dénominateur).
 */
export function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return ((num / den) * 100).toFixed(1) + ' %';
}

/**
 * `true` si la carte « Livrés » doit basculer en alerte : des emails ont quitté
 * le pipeline (`sent ≥ seuil`) mais zéro livraison confirmée (`delivered = 0`).
 * Symptôme du webhook Stalwart muet (F-001).
 */
export function isDeliverySilent(sent: number, delivered: number): boolean {
  return sent >= DELIVERY_SILENCE_MIN_SENT && delivered === 0;
}

/** Ton de la carte « Livrés » : rose si livraison silencieuse, sinon neutre. */
export function deliveredTone(kpi: Pick<OutboxKpi, 'sentLast7d' | 'deliveredLast7d'>): KpiTone {
  return isDeliverySilent(kpi.sentLast7d, kpi.deliveredLast7d) ? 'rose' : 'neutral';
}

/** Ton de la carte « Échecs » : ambre dès qu'il y a au moins un échec. */
export function failedTone(failed: number): KpiTone {
  return failed > 0 ? 'amber' : 'neutral';
}

/** Ton de la carte « DLQ » : rose dès qu'une ligne est abandonnée. */
export function dlqTone(dlq: number): KpiTone {
  return dlq > 0 ? 'rose' : 'neutral';
}

/** Ton de la carte « En attente » : ambre quand la file dépasse le seuil cron. */
export function pendingTone(pending: number): KpiTone {
  return pending > PENDING_AMBER_THRESHOLD ? 'amber' : 'neutral';
}
