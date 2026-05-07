/**
 * FunnelDataTable — DataTable funnel par page d'entrée.
 * cf. docs/analytics/05-onglets-specs.md §3.7
 *
 * Colonnes : Page · Views · View→CTA · CTA→Buy · Volume Buy. Tri client + export
 * CSV. La page la plus visitée n'est pas forcément celle qui convertit — l'idée
 * est d'identifier ces deltas.
 */
'use client';

import { ExportCsvButton, type CsvColumn } from '../primitives/ExportCsvButton';
import {
  DataTable,
  type DataTableColumn,
} from '../primitives/DataTable';
import type { FunnelByPageRow } from '@/lib/analytics/queries/funnel';
import { formatNumber, formatPercent } from '@/lib/analytics/format';

const COLUMNS: DataTableColumn<FunnelByPageRow>[] = [
  {
    key: 'pageRoute',
    label: 'Page',
    sortable: true,
    render: (r) => (
      <span className="font-mono text-xs text-stone-700">{r.pageRoute}</span>
    ),
  },
  {
    key: 'views',
    label: 'Views',
    sortable: true,
    align: 'right',
    accessor: (r) => r.views,
    render: (r) => formatNumber(r.views),
  },
  {
    key: 'viewToCta',
    label: 'View → CTA',
    sortable: true,
    align: 'right',
    accessor: (r) => (r.viewToCta ?? -1),
    render: (r) => formatPercent(r.viewToCta, 1),
  },
  {
    key: 'ctaToBuy',
    label: 'CTA → Buy',
    sortable: true,
    align: 'right',
    accessor: (r) => (r.ctaToBuy ?? -1),
    render: (r) => formatPercent(r.ctaToBuy, 1),
  },
  {
    key: 'purchases',
    label: 'Volume Buy',
    sortable: true,
    align: 'right',
    accessor: (r) => r.purchases,
    render: (r) => formatNumber(r.purchases),
  },
];

interface FunnelDataTableProps {
  rows: FunnelByPageRow[];
  loading?: boolean;
}

const CSV_COLUMNS: CsvColumn<FunnelByPageRow>[] = [
  { key: 'pageRoute', label: 'Page', accessor: (r) => r.pageRoute },
  { key: 'views', label: 'Views', accessor: (r) => r.views },
  {
    key: 'viewToCta',
    label: 'View_to_CTA',
    accessor: (r) => (r.viewToCta !== null ? r.viewToCta.toFixed(4) : ''),
  },
  {
    key: 'ctaToBuy',
    label: 'CTA_to_Buy',
    accessor: (r) => (r.ctaToBuy !== null ? r.ctaToBuy.toFixed(4) : ''),
  },
  { key: 'purchases', label: 'Purchases', accessor: (r) => r.purchases },
];

export function FunnelDataTable({ rows, loading = false }: FunnelDataTableProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Funnel par page d'entrée">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-medium text-stone-900">
            Funnel par page d'entrée
          </h3>
          <p className="text-xs text-stone-500">
            Tri sur n'importe quelle colonne. Export CSV pour analyse externe.
          </p>
        </div>
        <ExportCsvButton
          rows={rows}
          columns={CSV_COLUMNS}
          filename="funnel-by-page.csv"
        />
      </header>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        getRowId={(r) => r.pageRoute}
        emptyTitle="Aucune page"
        emptyMessage="Aucune session avec une vue produit / kit sur la période."
      />
    </section>
  );
}
