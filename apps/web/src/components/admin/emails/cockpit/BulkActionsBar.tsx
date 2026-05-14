'use client';

/**
 * BulkActionsBar — barre d'actions sur la sélection multi-ligne (M5.1.6).
 *
 * Affichée uniquement quand selectedCount > 0. Actions :
 *   - Retry sélection (status éligible)
 *   - Mark suppressed
 *   - Export CSV
 *   - Clear selection
 *
 * Confirmation modale pour les actions destructives (suppress) gérée par
 * le parent.
 */
import type { ReactNode } from 'react';

export type BulkAction = {
  id: 'retry' | 'suppress' | 'export' | 'clear';
  label: string;
  icon?: ReactNode;
  danger?: boolean;
};

const DEFAULT_ACTIONS: BulkAction[] = [
  { id: 'retry', label: 'Retry sélection', icon: '↻' },
  { id: 'suppress', label: 'Marquer en suppression', icon: '⊘', danger: true },
  { id: 'export', label: 'Exporter CSV', icon: '⬇' },
];

export type BulkActionsBarProps = {
  selectedCount: number;
  actions?: BulkAction[];
  onAction?: (id: BulkAction['id']) => void;
  onClear?: () => void;
};

export function BulkActionsBar({
  selectedCount,
  actions = DEFAULT_ACTIONS,
  onAction,
  onClear,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      data-testid="bulk-actions-bar"
      className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-2 shadow-sm"
    >
      <span className="text-sm text-stone-700">
        <strong className="font-semibold tabular-nums">{selectedCount}</strong>{' '}
        ligne{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
      </span>

      <div className="flex items-center gap-1">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAction?.(a.id)}
            data-testid={`bulk-action-${a.id}`}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              a.danger
                ? 'text-red-700 hover:bg-red-50'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {a.icon && <span className="mr-1.5">{a.icon}</span>}
            {a.label}
          </button>
        ))}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Désélectionner tout"
            data-testid="bulk-clear"
            className="ml-2 rounded px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
