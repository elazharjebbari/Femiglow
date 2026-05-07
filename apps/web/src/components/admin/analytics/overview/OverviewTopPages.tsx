/**
 * OverviewTopPages — top des pages les plus consultées.
 * cf. docs/analytics/05-onglets-specs.md §1.5
 *
 * Marqué `'use client'` parce que les colonnes du DataTable utilisent des
 * fonctions `render` non sérialisables au passage de frontière RSC.
 */
'use client';

import { DataTable, type DataTableColumn } from '../primitives/DataTable';
import type { OverviewPageRow } from '@/lib/analytics/queries/overview';
import { formatNumber } from '@/lib/analytics/format';

const COLUMNS: DataTableColumn<OverviewPageRow>[] = [
  {
    key: 'pageRoute',
    label: 'Page',
    sortable: true,
    render: (r) => (
      <span className="font-mono text-xs text-stone-700">{r.pageRoute}</span>
    ),
  },
  {
    key: 'pageViews',
    label: 'Vues',
    sortable: true,
    align: 'right',
    accessor: (r) => r.pageViews,
    render: (r) => formatNumber(r.pageViews),
  },
  {
    key: 'sessions',
    label: 'Sessions',
    sortable: true,
    align: 'right',
    accessor: (r) => r.sessions,
    render: (r) => formatNumber(r.sessions),
  },
];

interface OverviewTopPagesProps {
  rows: OverviewPageRow[];
  loading?: boolean;
}

export function OverviewTopPages({ rows, loading }: OverviewTopPagesProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Top pages">
      <header className="flex items-baseline justify-between">
        <h3 className="font-display text-base font-medium text-stone-900">
          Top pages
        </h3>
        <span className="text-xs text-stone-500">par vues</span>
      </header>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        getRowId={(r) => r.pageRoute}
        emptyTitle="Aucune page"
        emptyMessage="Aucune page vue sur la période."
      />
    </section>
  );
}
