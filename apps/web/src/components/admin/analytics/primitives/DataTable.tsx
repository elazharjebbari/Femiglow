/**
 * DataTable — tableau analytics avec tri client-side et pagination optionnelle.
 * cf. docs/analytics/04-ui-design.md §3.5
 *
 * Volontairement minimaliste : pas de virtualisation (≤200 lignes typiques),
 * pas de filtres avancés (les filtres globaux suffisent). Pour > 1000 lignes,
 * basculer vers une variante serveur dans une itération ultérieure.
 */
'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** Accesseur pour le tri/affichage. Default : `row[key]`. */
  accessor?: (row: T) => string | number | null | undefined;
  /** Render custom de la cellule. Default : valeur brute. */
  render?: (row: T) => React.ReactNode;
  /** Activer le tri sur cette colonne. */
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Largeur CSS (ex: 'w-32' ou '120px'). */
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Identifiant unique d'une ligne (pour la `key` React). */
  getRowId: (row: T, index: number) => string | number;
  /** Pagination simple. Si non fourni, affiche toutes les lignes. */
  pageSize?: number;
  caption?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc';

export function DataTable<T>({
  columns,
  rows,
  loading = false,
  emptyTitle,
  emptyMessage,
  getRowId,
  pageSize,
  caption,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const acc = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[sortKey] as string | number | null | undefined);
    return [...rows].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  const total = sorted.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const visible = pageSize ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted;

  const onSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (loading) {
    return (
      <div
        data-testid="data-table-skeleton"
        className={`flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4 ${className}`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={`rounded-lg border border-stone-200 bg-white p-4 ${className}`}
      >
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </div>
    );
  }

  return (
    <div
      data-testid="data-table"
      className={`overflow-x-auto rounded-lg border border-stone-200 bg-white ${className}`}
    >
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50/60 text-xs font-medium uppercase tracking-wide text-stone-500">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'} ${c.className ?? ''}`}
                aria-sort={
                  sortKey === c.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-stone-900"
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-[10px]">
                      {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={getRowId(row, i)}
              className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50/60"
            >
              {columns.map((c) => {
                const acc = c.accessor ?? ((r: T) => (r as Record<string, unknown>)[c.key] as string | number | null | undefined);
                const raw = acc(row);
                return (
                  <td
                    key={c.key}
                    className={`px-4 py-2.5 tabular-nums text-stone-900 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'} ${c.className ?? ''}`}
                  >
                    {c.render ? c.render(row) : (raw ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {pageSize && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} sur {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-stone-200 px-2 py-1 disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border border-stone-200 px-2 py-1 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
