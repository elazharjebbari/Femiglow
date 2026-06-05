/**
 * StatusPill — badge FR canonique pour un `email_automation_run.status`.
 *
 * Source unique pour la liste automations, la liste runs et la page détail
 * d'un run. Libellés FRANÇAIS (jamais le slug brut anglais).
 */
export type RunStatus =
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'errored'
  | 'waiting_for_event';

const META: Record<RunStatus, { label: string; cls: string }> = {
  running: { label: 'En cours', cls: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Terminé', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Annulé', cls: 'bg-stone-100 text-stone-600' },
  errored: { label: 'En erreur', cls: 'bg-rose-100 text-rose-800' },
  waiting_for_event: { label: 'En attente d’événement', cls: 'bg-sky-100 text-sky-800' },
};

const UNKNOWN = { label: 'Inconnu', cls: 'bg-stone-100 text-stone-600' };

export function runStatusLabel(status: string): string {
  return (META as Record<string, { label: string }>)[status]?.label ?? UNKNOWN.label;
}

export function StatusPill({ status }: { status: string }) {
  const meta = (META as Record<string, { label: string; cls: string }>)[status] ?? UNKNOWN;
  return (
    <span
      role="status"
      data-status={status}
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}
