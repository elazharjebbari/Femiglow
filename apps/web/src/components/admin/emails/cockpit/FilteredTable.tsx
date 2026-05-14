'use client';

/**
 * FilteredTable — tableau dense des emails outbox filtrés (M5.1.6).
 *
 * Colonnes : checkbox, date, destinataire, template, sujet, statut,
 * tentatives, source, menu d'actions.
 *
 * Sélection : click checkbox toggles ; shift+click pour range ; ⌘A select
 * all visible. Sort via headers cliquables.
 *
 * Le composant est *présentationnel*. Les data + pagination + sort sont
 * pilotés par le parent via props.
 */
import { useState, useCallback } from 'react';
import type { OutboxSearchRow, SearchSort } from '@/lib/mail/transactional/search';

export type FilteredTableProps = {
  rows: OutboxSearchRow[];
  total: number;
  isLoading?: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  sort?: SearchSort;
  onSortChange?: (sort: SearchSort) => void;
  onRowClick?: (id: string) => void;
};

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-50 text-emerald-700',
  sent: 'bg-sky-50 text-sky-700',
  opened: 'bg-sky-50 text-sky-700',
  clicked: 'bg-sky-50 text-sky-700',
  pending: 'bg-stone-100 text-stone-700',
  sending: 'bg-sky-50 text-sky-700',
  failed: 'bg-red-50 text-red-700',
  bounced_soft: 'bg-amber-50 text-amber-700',
  bounced_permanent: 'bg-red-50 text-red-700',
  suppressed: 'bg-stone-100 text-stone-500 line-through',
  dlq: 'bg-red-100 text-red-800',
};

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const isToday =
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate();
  return isToday
    ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Header cell triable ─────────────────────────────────────────────────

type SortableHeaderProps = {
  label: string;
  sortKey?: SearchSort;
  currentSort?: SearchSort;
  onSortChange?: (s: SearchSort) => void;
  className?: string;
};

function SortableHeader({ label, sortKey, currentSort, onSortChange, className }: SortableHeaderProps) {
  if (!sortKey || !onSortChange) {
    return <th className={`text-left text-xs font-medium uppercase tracking-wider text-stone-500 ${className ?? ''}`}>{label}</th>;
  }
  const active = currentSort === sortKey;
  return (
    <th
      scope="col"
      className={`text-left text-xs font-medium uppercase tracking-wider text-stone-500 ${className ?? ''}`}
      aria-sort={active ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-stone-900 ${active ? 'text-stone-900' : ''}`}
      >
        {label}
        {active && <span aria-hidden="true">↓</span>}
      </button>
    </th>
  );
}

// ── Tableau principal ──────────────────────────────────────────────────

export function FilteredTable({
  rows,
  total,
  isLoading,
  selectedIds,
  onSelectionChange,
  sort,
  onSortChange,
  onRowClick,
}: FilteredTableProps) {
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);

  const toggleOne = useCallback(
    (id: string, idx: number, shiftKey: boolean) => {
      const next = new Set(selectedIds);

      if (shiftKey && lastClickedIdx !== null) {
        const [start, end] = lastClickedIdx < idx ? [lastClickedIdx, idx] : [idx, lastClickedIdx];
        for (let i = start; i <= end; i += 1) {
          const r = rows[i];
          if (r) next.add(r.id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }

      setLastClickedIdx(idx);
      onSelectionChange(next);
    },
    [selectedIds, lastClickedIdx, rows, onSelectionChange],
  );

  const toggleAll = useCallback(() => {
    if (selectedIds.size === rows.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((r) => r.id)));
    }
  }, [rows, selectedIds, onSelectionChange]);

  if (isLoading) {
    return (
      <div className="rounded-md border border-stone-200 bg-white p-8 text-center text-sm text-stone-500" data-testid="filtered-table-skeleton">
        Chargement…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-stone-200 bg-white p-12 text-center" data-testid="filtered-table-empty">
        <div className="mb-2 text-3xl">📭</div>
        <h3 className="text-base font-medium text-stone-900">Aucun email ne correspond à ces filtres</h3>
        <p className="mt-1 text-sm text-stone-500">Essaie de relâcher les critères ou efface les filtres.</p>
      </div>
    );
  }

  const allSelected = selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <div className="overflow-x-auto rounded-md border border-stone-200 bg-white" data-testid="filtered-table">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50/50">
          <tr>
            <th scope="col" className="w-8 px-3 py-2">
              <input
                type="checkbox"
                aria-label="Sélectionner tout"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                data-testid="select-all"
              />
            </th>
            <SortableHeader label="Date" sortKey="date_desc" currentSort={sort} onSortChange={onSortChange} className="px-3 py-2 w-32" />
            <SortableHeader label="Destinataire" className="px-3 py-2" />
            <SortableHeader label="Template" sortKey="template" currentSort={sort} onSortChange={onSortChange} className="px-3 py-2 w-48" />
            <SortableHeader label="Sujet" className="px-3 py-2" />
            <SortableHeader label="Statut" sortKey="status" currentSort={sort} onSortChange={onSortChange} className="px-3 py-2 w-32" />
            <SortableHeader label="Att." sortKey="attempts_desc" currentSort={sort} onSortChange={onSortChange} className="px-3 py-2 w-16" />
            <SortableHeader label="Source" className="px-3 py-2 w-36" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, idx) => {
            const isSelected = selectedIds.has(row.id);
            return (
              <tr
                key={row.id}
                data-testid={`row-${row.id}`}
                className={`hover:bg-stone-50 ${isSelected ? 'bg-sage-50/30' : ''}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${row.toEmail}`}
                    checked={isSelected}
                    onChange={(e) => {
                      const nativeEvent = e.nativeEvent as MouseEvent;
                      toggleOne(row.id, idx, nativeEvent.shiftKey);
                    }}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-stone-600">{formatDate(row.createdAt)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onRowClick?.(row.id)}
                    className="text-stone-900 hover:underline hover:underline-offset-2"
                  >
                    {row.toEmail}
                  </button>
                  {row.toName && <div className="text-xs text-stone-500">{row.toName}</div>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-stone-700">{row.template}</td>
                <td className="max-w-md truncate px-3 py-2 text-stone-700">{row.subject}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[row.status] ?? 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-stone-600 tabular-nums">
                  {row.attempts}/{row.maxAttempts}
                </td>
                <td className="px-3 py-2 text-xs text-stone-500">{row.source ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-500">
        <span>
          {rows.length} affichés sur {total.toLocaleString('fr-FR')} total
        </span>
        {selectedIds.size > 0 && (
          <span className="font-medium text-stone-900" data-testid="selection-count">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
