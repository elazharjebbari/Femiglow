import type { PlanStatus } from '@/lib/tracking/plan/types';

const STYLES: Record<PlanStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border-stone-300',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  archived: 'bg-rose-50 text-rose-700 border-rose-300',
};

const LABELS: Record<PlanStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
};

export function StatusBadge({ status }: { status: PlanStatus }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
      aria-label={`Statut : ${LABELS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
