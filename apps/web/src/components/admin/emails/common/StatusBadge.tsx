/**
 * StatusBadge — badge de statut outbox CANONIQUE, FR, palette unique.
 *
 * Source de vérité unique pour le rendu d'un `email_outbox.status` (les 11
 * statuts de l'enum `email_outbox_status`). Tue la double-vérité de l'audit
 * UX-TRANSVERSE-005 : le dashboard montrait « Bounce perm. » (rose) pendant que
 * le cockpit affichait le slug brut anglais « bounced_permanent » (rouge).
 *
 * Couleurs dérivées de la SOURCE UNIQUE `ui/tokens.ts` (charte 09 §A.1, gate
 * G10) : chaque statut déclare son `tone` + son `intensity`. Les états
 * TERMINAUX/morts (dlq, bounce permanent) sont en `solid` pour accrocher l'œil ;
 * tout le reste en `subtle`. Plus aucune nuance ad hoc (50/100/200) ni `blue-`.
 *
 * Présentationnel pur, importable côté RSC comme côté client. `KpiCards`
 * réexporte ce composant.
 *
 * Toujours un libellé FR — jamais le slug brut anglais (un statut inconnu rend
 * « Inconnu » plutôt que la chaîne technique).
 */

export type OutboxStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'failed'
  | 'bounced_soft'
  | 'bounced_permanent'
  | 'suppressed'
  | 'dlq';

import type { Tone, ToneIntensity } from '../ui/tokens';
import { Pill } from '../ui/Pill';

interface StatusMeta {
  label: string;
  /** Ton sémantique (ui/tokens.ts). */
  tone: Tone;
  /** Intensité : `solid` pour les états terminaux/urgents, `subtle` sinon. */
  intensity: ToneIntensity;
}

/** Mapping FR + ton/intensité canoniques des 11 statuts outbox. */
export const STATUS_META: Record<OutboxStatus, StatusMeta> = {
  pending: { label: 'En attente', tone: 'warning', intensity: 'subtle' },
  sending: { label: 'Envoi…', tone: 'warning', intensity: 'subtle' },
  sent: { label: 'Envoyé', tone: 'success', intensity: 'subtle' },
  delivered: { label: 'Livré', tone: 'success', intensity: 'subtle' },
  opened: { label: 'Ouvert', tone: 'info', intensity: 'subtle' },
  clicked: { label: 'Cliqué', tone: 'info', intensity: 'subtle' },
  failed: { label: 'Échec', tone: 'danger', intensity: 'subtle' },
  bounced_soft: { label: 'Bounce soft', tone: 'warning', intensity: 'subtle' },
  // États TERMINAUX/morts → solid (accroche l'œil dans une table dense).
  bounced_permanent: { label: 'Bounce permanent', tone: 'danger', intensity: 'solid' },
  suppressed: { label: 'Supprimé', tone: 'neutral', intensity: 'subtle' },
  dlq: { label: 'DLQ', tone: 'danger', intensity: 'solid' },
};

const UNKNOWN_META: StatusMeta = { label: 'Inconnu', tone: 'neutral', intensity: 'subtle' };

/** Libellé FR canonique d'un statut (utilitaire hors rendu). */
export function statusLabel(status: string): string {
  return (STATUS_META as Record<string, StatusMeta>)[status]?.label ?? UNKNOWN_META.label;
}

export function StatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const meta = (STATUS_META as Record<string, StatusMeta>)[status] ?? UNKNOWN_META;
  // Rendu via la primitive Pill : géométrie/typographie mono-source (la couleur
  // vient du même toneClass). data-status passe par le passthrough de Pill.
  return (
    <Pill tone={meta.tone} intensity={meta.intensity} data-status={status} className={className}>
      <span aria-hidden="true">⏺</span>
      {meta.label}
    </Pill>
  );
}
