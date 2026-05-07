/**
 * LiveBySource — répartition par source de trafic (1h glissante).
 * cf. docs/analytics/05-onglets-specs.md §2.4 B
 *
 * Présenté en barres horizontales (plus lisible que donut sur 5+ catégories
 * et plus accessible que les hover Recharts en lecture rapide).
 */
import { ChartFrame } from '@/components/admin/analytics/primitives';
import type { LiveSourceRow } from '@/lib/analytics/queries/live';

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  meta: 'Meta',
  tiktok: 'TikTok',
  snap: 'Snapchat',
  pinterest: 'Pinterest',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  email: 'Email',
  affiliate: 'Affiliation',
  other: 'Autre',
};

interface LiveBySourceProps {
  rows: LiveSourceRow[];
}

export function LiveBySource({ rows }: LiveBySourceProps) {
  const total = rows.reduce((acc, r) => acc + r.sessions, 0);

  return (
    <ChartFrame
      title="Par source"
      description="Sessions par origine sur la fenêtre courante"
      isEmpty={rows.length === 0}
      emptyMessage="Pas de données de source pour la période."
      height={320}
    >
      <ul
        className="space-y-2 overflow-y-auto"
        style={{ maxHeight: 320 }}
        data-testid="live-by-source"
      >
        {rows.map((row) => {
          const pct = total > 0 ? row.sessions / total : 0;
          return (
            <li key={row.source} className="text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-stone-700">
                  {SOURCE_LABELS[row.source] ?? row.source}
                </span>
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
