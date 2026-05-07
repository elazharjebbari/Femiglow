/**
 * CheckoutFormErrors — top 20 erreurs de validation formulaire.
 * cf. docs/analytics/05-onglets-specs.md §5.4-A
 *
 * Group by (field_id, error_code) avec compteur d'occurrences et nombre de
 * sessions distinctes affectées. Tri occurrences DESC.
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
import { formatNumber } from '@/lib/analytics/format';
import type { CheckoutFormError } from '@/lib/analytics/queries/checkout';

interface CheckoutFormErrorsProps {
  rows: CheckoutFormError[];
  loading?: boolean;
}

const COLUMNS: DataTableColumn<CheckoutFormError>[] = [
  {
    key: 'fieldId',
    label: 'Champ',
    sortable: true,
    render: (r) => (
      <span className="font-mono text-xs text-stone-700">{r.fieldId}</span>
    ),
  },
  {
    key: 'errorCode',
    label: 'Code erreur',
    sortable: true,
    render: (r) => (
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
        {r.errorCode}
      </span>
    ),
  },
  {
    key: 'occurrences',
    label: 'Occ.',
    sortable: true,
    align: 'right',
    accessor: (r) => r.occurrences,
    render: (r) => formatNumber(r.occurrences),
  },
  {
    key: 'affectedSessions',
    label: 'Sessions',
    sortable: true,
    align: 'right',
    accessor: (r) => r.affectedSessions,
    render: (r) => formatNumber(r.affectedSessions),
  },
];

const CSV_COLUMNS: CsvColumn<CheckoutFormError>[] = [
  { key: 'fieldId', label: 'Field_id', accessor: (r) => r.fieldId },
  { key: 'errorCode', label: 'Error_code', accessor: (r) => r.errorCode },
  { key: 'occurrences', label: 'Occurrences', accessor: (r) => r.occurrences },
  {
    key: 'affectedSessions',
    label: 'Affected_sessions',
    accessor: (r) => r.affectedSessions,
  },
];

export function CheckoutFormErrors({
  rows,
  loading = false,
}: CheckoutFormErrorsProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Top erreurs formulaire">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-medium text-stone-900">
            Top erreurs formulaire
          </h3>
          <p className="text-xs text-stone-500">
            Validation côté client. Repérer les champs piégés.
          </p>
        </div>
        <ExportCsvButton
          rows={rows}
          columns={CSV_COLUMNS}
          filename="checkout-form-errors.csv"
        />
      </header>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        getRowId={(r) => `${r.fieldId}|${r.errorCode}`}
        emptyTitle="Aucune erreur"
        emptyMessage="Aucune erreur de validation formulaire sur la période."
      />
    </section>
  );
}
