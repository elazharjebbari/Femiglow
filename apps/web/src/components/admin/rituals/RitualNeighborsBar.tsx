import Link from 'next/link';
import type { RitualStatus } from '@/lib/db/types';

interface RitualNeighborsBarProps {
  previousId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  status: RitualStatus;
  /** Status filter qualifiant la « file » (ex. "PENDING" ou "REJECTED,HIDDEN"). */
  statusParam: string;
}

const STATUS_LABEL: Record<RitualStatus, string> = {
  PENDING: 'en attente',
  APPROVED: 'publiés',
  REJECTED: 'rejetés',
  HIDDEN: 'masqués',
};

function backHref(statusParam: string): string {
  const map: Record<string, string> = {
    PENDING: '/admin/rituals/queue',
    APPROVED: '/admin/rituals/published',
    'REJECTED,HIDDEN': '/admin/rituals/archived',
    'HIDDEN,REJECTED': '/admin/rituals/archived',
  };
  return map[statusParam] ?? '/admin/rituals/queue';
}

export function RitualNeighborsBar({
  previousId,
  nextId,
  position,
  total,
  status,
  statusParam,
}: RitualNeighborsBarProps) {
  const fileLabel = STATUS_LABEL[status] ?? statusParam.toLowerCase();
  const hrefSuffix = `?status=${encodeURIComponent(statusParam)}`;

  return (
    <nav
      aria-label="Navigation entre rituels"
      className="mb-4 flex items-center justify-between gap-2 rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
      data-testid="ritual-neighbors-bar"
    >
      {previousId ? (
        <Link
          href={`/admin/rituals/${previousId}${hrefSuffix}`}
          className="font-medium text-stone-900 hover:underline"
          data-testid="ritual-neighbors-prev"
          rel="prev"
        >
          ← Précédent
        </Link>
      ) : (
        <span className="text-stone-400" data-testid="ritual-neighbors-prev-disabled">
          ← Précédent
        </span>
      )}

      <div className="text-center text-xs text-stone-600">
        <Link href={backHref(statusParam)} className="hover:underline">
          {total > 0 ? `${position} sur ${total} ${fileLabel}` : `Aucun ${fileLabel}`}
        </Link>
      </div>

      {nextId ? (
        <Link
          href={`/admin/rituals/${nextId}${hrefSuffix}`}
          className="font-medium text-stone-900 hover:underline"
          data-testid="ritual-neighbors-next"
          rel="next"
        >
          Suivant →
        </Link>
      ) : (
        <span className="text-stone-400" data-testid="ritual-neighbors-next-disabled">
          Suivant →
        </span>
      )}
    </nav>
  );
}
