/**
 * LiveByDevice — répartition par device (1h glissante).
 * cf. docs/analytics/05-onglets-specs.md §2.4 C
 */
import { ChartFrame } from '@/components/admin/analytics/primitives';
import type { LiveDeviceRow } from '@/lib/analytics/queries/live';

const DEVICE_LABELS: Record<LiveDeviceRow['device'], string> = {
  mobile: 'Mobile',
  tablet: 'Tablette',
  desktop: 'Desktop',
  unknown: 'Inconnu',
};

interface LiveByDeviceProps {
  rows: LiveDeviceRow[];
}

export function LiveByDevice({ rows }: LiveByDeviceProps) {
  const total = rows.reduce((acc, r) => acc + r.sessions, 0);

  return (
    <ChartFrame
      title="Par device"
      description="Sessions par appareil sur la fenêtre courante"
      isEmpty={rows.length === 0}
      emptyMessage="Pas de données device pour la période."
      height={320}
    >
      <ul className="space-y-2" data-testid="live-by-device">
        {rows.map((row) => {
          const pct = total > 0 ? row.sessions / total : 0;
          return (
            <li key={row.device} className="text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-stone-700">{DEVICE_LABELS[row.device]}</span>
                <span className="tabular-nums text-stone-900">
                  <strong className="font-medium">{row.sessions}</strong>
                  <span className="ml-1.5 text-xs text-stone-500">
                    {`${(pct * 100).toFixed(0)}\u202f%`}
                  </span>
                </span>
              </div>
              <div
                aria-hidden
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100"
              >
                <div
                  className="h-full bg-stone-900"
                  style={{ width: `${(pct * 100).toFixed(2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}
