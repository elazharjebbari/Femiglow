/**
 * CtaTopPages — DataTable top 10 pages d'origine du CTA cliqué.
 * cf. docs/analytics/05-onglets-specs.md §4.4-B
 *
 * Lecture orthogonale au tableau principal : « quelle page d'origine convertit
 * le mieux indépendamment du CTA exact ».
 *
 * Marqué `'use client'` parce que les colonnes du DataTable utilisent des
 * fonctions `render` non sérialisables au passage de frontière RSC.
 */
'use client';

import {
  DataTable,
  type DataTableColumn,
} from '../primitives/DataTable';
import type { CtaTopPage } from '@/lib/analytics/queries/cta';
import { formatNumber, formatPercent } from '@/lib/analytics/format';

const COLUMNS: DataTableColumn<CtaTopPage>[] = [
  {
    key: 'pageRoute',
    label: 'Page',
    sortable: true,
    render: (r) => <span className="font-mono text-xs text-stone-700">{r.pageRoute}</span>,
  },
  {
    key: 'impressions',
    label: 'Impr.',
    sortable: true,
    align: 'right',
    accessor: (r) => r.impressions,
    render: (r) => formatNumber(r.impressions),
  },
  {
    key: 'clicks',
    label: 'Clics',
    sortable: true,
    align: 'right',
    accessor: (r) => r.clicks,
    render: (r) => formatNumber(r.clicks),
  },
  {
    key: 'purchasesAttributed',
    label: 'Achats',
    sortable: true,
    align: 'right',
    accessor: (r) => r.purchasesAttributed,
    render: (r) => formatNumber(r.purchasesAttributed),
  },
  {
    key: 'conversionRate',
    label: 'CR achat',
    sortable: true,
    align: 'right',
    accessor: (r) => r.conversionRate ?? -1,
    render: (r) => formatPercent(r.conversionRate, 1),
  },
];

interface CtaTopPagesProps {
  rows: CtaTopPage[];
  loading?: boolean;
}

export function CtaTopPages({ rows, loading = false }: CtaTopPagesProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Top pages d'origine CTA">
      <header className="flex items-baseline justify-between">
        <h3 className="font-display text-base font-medium text-stone-900">
          Top pages d'origine
        </h3>
        <span className="text-xs text-stone-500">par achats attribués</span>
      </header>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        getRowId={(r) => r.pageRoute}
        emptyTitle="Aucune page"
        emptyMessage="Aucun clic CTA enregistré sur la période."
      />
    </section>
  );
}
