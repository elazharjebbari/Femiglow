/**
 * OverviewTopSources — top des buckets de trafic par sessions.
 * cf. docs/analytics/05-onglets-specs.md §1.4
 *
 * Marqué `'use client'` parce que les colonnes du DataTable utilisent des
 * fonctions `render` non sérialisables au passage de frontière RSC.
 */
'use client';

import { DataTable, type DataTableColumn } from '../primitives/DataTable';
import type { OverviewSourceRow } from '@/lib/analytics/queries/overview';
import { formatNumber, formatPercent } from '@/lib/analytics/format';
// Source de vérité unique pour les libellés canal — alignée sur la
// taxonomie `TrafficBucket` (cf. `docs/attribution-fix-2026-05/`).
import { BUCKET_LABELS } from '@/lib/tracking/taxonomy';

/**
 * Labels affichés dans la table — fallback sur BUCKET_LABELS (taxonomy)
 * + 1 alias legacy (`other` → `unknown`) pour rétrocompat data antérieure
 * au refactor (rows persistées avec l'ancienne énumération).
 */
const SOURCE_LABELS: Record<string, string> = {
  ...BUCKET_LABELS,
  // Aliases legacy (rétrocompat data pre-refactor)
  other: 'Autres',
  paid_other: 'Paid (autre)',
  organic_other: 'Organic (autre)',
  ai_assistant: 'IA assistants',
};

const COLUMNS: DataTableColumn<OverviewSourceRow>[] = [
  {
    key: 'source',
    label: 'Source',
    sortable: true,
    render: (r) => (
      <span className="font-medium text-stone-900">
        {SOURCE_LABELS[r.source] ?? r.source}
      </span>
    ),
  },
  {
    key: 'sessions',
    label: 'Sessions',
    sortable: true,
    align: 'right',
    accessor: (r) => r.sessions,
    render: (r) => formatNumber(r.sessions),
  },
  {
    key: 'conversionRate',
    label: 'Conv.',
    sortable: true,
    align: 'right',
    accessor: (r) => r.conversionRate ?? -1,
    render: (r) => formatPercent(r.conversionRate),
  },
];

interface OverviewTopSourcesProps {
  rows: OverviewSourceRow[];
  loading?: boolean;
}

export function OverviewTopSources({ rows, loading }: OverviewTopSourcesProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Top sources de trafic">
      <header className="flex items-baseline justify-between">
        <h3 className="font-display text-base font-medium text-stone-900">
          Top sources
        </h3>
        <span className="text-xs text-stone-500">par sessions</span>
      </header>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        getRowId={(r) => r.source}
        emptyTitle="Aucune source"
        emptyMessage="Aucun trafic identifié sur la période."
      />
    </section>
  );
}
