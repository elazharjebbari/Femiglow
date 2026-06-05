/**
 * StatusBadge — badge de statut outbox CANONIQUE, FR, palette unique.
 *
 * Source de vérité unique pour le rendu d'un `email_outbox.status` (les 11
 * statuts de l'enum `email_outbox_status`). Tue la double-vérité de l'audit
 * UX-TRANSVERSE-005 : le dashboard montrait « Bounce perm. » (rose) pendant que
 * le cockpit affichait le slug brut anglais « bounced_permanent » (rouge).
 *
 * Présentationnel pur, importable côté RSC comme côté client. `KpiCards`
 * réexporte ce composant ; le cockpit (FilteredTable) le consommera pour
 * supprimer son `STATUS_STYLES` local et son rendu de slug brut.
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

interface StatusMeta {
  label: string;
  cls: string;
}

/** Mapping FR + palette canonique des 11 statuts outbox. */
export const STATUS_META: Record<OutboxStatus, StatusMeta> = {
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  sending: { label: 'Envoi…', cls: 'bg-amber-50 text-amber-700' },
  sent: { label: 'Envoyé', cls: 'bg-emerald-50 text-emerald-700' },
  delivered: { label: 'Livré', cls: 'bg-emerald-100 text-emerald-800' },
  opened: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
  clicked: { label: 'Cliqué', cls: 'bg-blue-100 text-blue-800' },
  failed: { label: 'Échec', cls: 'bg-rose-50 text-rose-700' },
  bounced_soft: { label: 'Bounce soft', cls: 'bg-amber-50 text-amber-700' },
  bounced_permanent: { label: 'Bounce perm.', cls: 'bg-rose-100 text-rose-800' },
  suppressed: { label: 'Supprimé', cls: 'bg-stone-100 text-stone-700' },
  dlq: { label: 'DLQ', cls: 'bg-rose-200 text-rose-900' },
};

const UNKNOWN_META: StatusMeta = {
  label: 'Inconnu',
  cls: 'bg-stone-100 text-stone-700',
};

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
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls} ${className}`}
      role="status"
      data-status={status}
    >
      <span aria-hidden="true">⏺</span>
      {meta.label}
    </span>
  );
}
