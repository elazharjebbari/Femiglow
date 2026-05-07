import type { GtmStats } from '@/lib/tracking/gtm/exporter';

interface Props {
  stats: GtmStats;
}

export function GtmStatsGrid({ stats }: Props) {
  const cards: Array<{ label: string; value: number; sub?: string }> = [
    { label: 'Tags', value: stats.tags, sub: `${stats.conversions} conversions` },
    { label: 'Triggers', value: stats.triggers, sub: `${stats.chatTriggers} chat` },
    { label: 'Variables', value: stats.variables, sub: `${stats.chatDims} chat dims` },
    { label: 'Folders', value: stats.folders, sub: '9 catégories' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-md border border-stone-200 bg-white px-4 py-3"
        >
          <dt className="text-xs uppercase tracking-wide text-stone-500">{c.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
            {c.value}
          </dd>
          {c.sub ? <p className="mt-1 text-xs text-stone-500">{c.sub}</p> : null}
        </div>
      ))}
    </dl>
  );
}
