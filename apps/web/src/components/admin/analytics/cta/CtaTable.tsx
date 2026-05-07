/**
 * CtaTable — DataTable principale CTA avec attribution + export CSV.
 * cf. docs/analytics/05-onglets-specs.md §4.3
 *
 * Colonnes : Label · Rôle · Page · Impressions · Clics · CR clic · CR achat ·
 * Volume achat · Revenu attribué. Tri multi-col, export CSV.
 *
 * Edge case : composant supprimé → label affiché en gris + suffixe « (supprimé) ».
 */
'use client';

import {
  DataTable,
  type DataTableColumn,
} from '../primitives/DataTable';
import {
  ExportCsvButton,
  type CsvColumn,
} from '../primitives/ExportCsvButton';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/analytics/format';
import type { CtaRow } from '@/lib/analytics/queries/cta';

interface CtaTableProps {
  rows: CtaRow[];
  loading?: boolean;
  /** Devise pour le revenu attribué (default EUR). */
  currency?: string;
}

const CSV_COLUMNS: CsvColumn<CtaRow>[] = [
  { key: 'label', label: 'Label', accessor: (r) => r.label },
  { key: 'role', label: 'Role', accessor: (r) => r.role },
  { key: 'pageRoute', label: 'Page', accessor: (r) => r.pageRoute ?? '' },
  { key: 'impressions', label: 'Impressions', accessor: (r) => r.impressions },
  { key: 'clicks', label: 'Clicks', accessor: (r) => r.clicks },
  {
    key: 'clickRate',
    label: 'Click_rate',
    accessor: (r) => (r.clickRate !== null ? r.clickRate.toFixed(4) : ''),
  },
  {
    key: 'conversionRate',
    label: 'Conversion_rate',
    accessor: (r) =>
      r.conversionRate !== null ? r.conversionRate.toFixed(4) : '',
  },
  {
    key: 'purchasesAttributed',
    label: 'Purchases',
    accessor: (r) => r.purchasesAttributed,
  },
  {
    key: 'revenueAttributedCents',
    label: 'Revenue_cents',
    accessor: (r) => r.revenueAttributedCents,
  },
  { key: 'isDeleted', label: 'Deleted', accessor: (r) => (r.isDeleted ? '1' : '0') },
];

export function CtaTable({ rows, loading = false, currency = 'EUR' }: CtaTableProps) {
  const COLUMNS: DataTableColumn<CtaRow>[] = [
    {
      key: 'label',
      label: 'CTA',
      sortable: true,
      render: (r) => (
        <span
          className={
            r.isDeleted
              ? 'text-stone-400 italic'
              : 'font-medium text-stone-900'
          }
        >
          {r.label}
          {r.isDeleted ? (
            <span className="ml-1 text-xs text-stone-400">(supprimé)</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      render: (r) => (
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
          {r.role}
        </span>
      ),
    },
    {
      key: 'pageRoute',
      label: 'Page',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs text-stone-700">
          {r.pageRoute ?? '—'}
        </span>
      ),
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
      key: 'clickRate',
      label: 'CR clic',
      sortable: true,
      align: 'right',
      accessor: (r) => r.clickRate ?? -1,
      render: (r) => formatPercent(r.clickRate, 1),
    },
    {
      key: 'conversionRate',
      label: 'CR achat',
      sortable: true,
      align: 'right',
      accessor: (r) => r.conversionRate ?? -1,
      render: (r) => formatPercent(r.conversionRate, 1),
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
      key: 'revenueAttributedCents',
      label: 'Revenu',
      sortable: true,
      align: 'right',
      accessor: (r) => r.revenueAttributedCents,
      render: (r) => formatCurrency(r.revenueAttributedCents, currency),
    },
  ];

  return (
    <section className="flex flex-col gap-3" aria-label="Performance CTA">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-medium text-stone-900">
            Performance des CTA
          </h3>
          <p className="text-xs text-stone-500">
            Attribution last-click sur 7 jours. Tri sur n'importe quelle
            colonne.
          </p>
        </div>
        <ExportCsvButton
          rows={rows}
          columns={CSV_COLUMNS}
          filename="cta-performance.csv"
        />
      </header>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        getRowId={(r) => r.componentId}
        emptyTitle="Aucun CTA"
        emptyMessage="Aucune impression, ni clic, ni achat attribué sur la période."
      />
    </section>
  );
}
