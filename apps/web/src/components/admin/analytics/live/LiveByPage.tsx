/**
 * LiveByPage — Top 10 pages avec utilisateurs en ligne (5 min glissants).
 * cf. docs/analytics/05-onglets-specs.md §2.4 A
 */
import { ChartFrame } from '@/components/admin/analytics/primitives';
import type { LivePageRow } from '@/lib/analytics/queries/live';

interface LiveByPageProps {
  rows: LivePageRow[];
}

export function LiveByPage({ rows }: LiveByPageProps) {
  const total = rows.reduce((acc, r) => acc + r.users, 0);

  return (
    <ChartFrame
      title="En ligne par page"
      description={`Sessions actives par route (5${'\u202f'}min)${total > 0 ? ` · ${total} au total` : ''}`}
      isEmpty={rows.length === 0}
      emptyMessage="Aucune session active sur les 5 dernières minutes."
      height={320}
    >
      <ul
        className="divide-y divide-stone-100 overflow-y-auto"
        style={{ maxHeight: 320 }}
        data-testid="live-by-page"
      >
        {rows.map((row) => (
          <li
            key={row.pageRoute}
            className="flex items-baseline justify-between py-2.5 text-sm"
          >
            <span className="truncate text-stone-700" title={row.pageRoute}>
              {row.pageRoute || '/'}
            </span>
            <span className="font-medium tabular-nums text-stone-900">
              {row.users}
            </span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
