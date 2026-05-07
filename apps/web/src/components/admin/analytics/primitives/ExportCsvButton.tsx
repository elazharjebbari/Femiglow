/**
 * ExportCsvButton — bouton de téléchargement CSV côté client.
 * cf. docs/analytics/04-ui-design.md §3.6
 *
 * Construit un CSV (séparateur `,`, échappement RFC 4180) à partir des rows
 * et des colonnes passées en props, puis déclenche un téléchargement Blob.
 */
'use client';

import { useState } from 'react';

export interface CsvColumn<T> {
  key: string;
  label: string;
  /** Accesseur pour la valeur. Default : `row[key]`. */
  accessor?: (row: T) => string | number | null | undefined;
}

interface ExportCsvButtonProps<T> {
  rows: T[];
  columns: CsvColumn<T>[];
  filename?: string;
  label?: string;
  className?: string;
  /** Désactivé si pas de rows. */
  disabled?: boolean;
}

export function ExportCsvButton<T>({
  rows,
  columns,
  filename = 'export.csv',
  label = 'Exporter CSV',
  className = '',
  disabled,
}: ExportCsvButtonProps<T>) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const csv = buildCsv(rows, columns);
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = disabled || rows.length === 0 || busy;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      data-testid="export-csv-button"
      className={`inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" strokeLinecap="round" />
      </svg>
      {busy ? 'Export…' : label}
    </button>
  );
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const acc =
          c.accessor ?? ((r: T) => (r as Record<string, unknown>)[c.key] as string | number | null | undefined);
        const raw = acc(row);
        if (raw === null || raw === undefined) return '';
        return escapeCsv(String(raw));
      })
      .join(','),
  );
  return [header, ...lines].join('\r\n');
}

function escapeCsv(value: string): string {
  if (/["\n,;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
