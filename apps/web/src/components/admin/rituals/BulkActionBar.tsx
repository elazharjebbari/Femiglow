'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface BulkActionBarProps {
  selectedIds: string[];
  totalVisible: number;
  totalAll: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  /** Actions disponibles selon la surface (queue vs published vs archived). */
  actions: ReadonlyArray<{
    key: 'approve' | 'reject' | 'hide' | 'restore' | 'feature' | 'unfeature';
    label: string;
    requiresNote?: boolean;
    variant?: 'primary' | 'secondary' | 'destructive';
  }>;
}

/**
 * Barre bulk sticky qui apparaît dès la première sélection.
 * Cf. docs/reviews-wall/execution/16-bulk-management.md § 3
 */
export function BulkActionBar({
  selectedIds,
  totalVisible,
  totalAll,
  onSelectAll,
  onClearSelection,
  actions,
}: BulkActionBarProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const callAction = async (
    actionKey: BulkActionBarProps['actions'][number]['key'],
    requiresNote: boolean,
  ) => {
    let note: string | undefined;
    if (requiresNote) {
      const promptResult = window.prompt(
        `Note (obligatoire) — appliquée aux ${selectedIds.length} rituels`,
      );
      if (!promptResult || promptResult.trim().length === 0) return;
      note = promptResult.trim();
    } else {
      if (!window.confirm(`Confirmer ${actionKey} sur ${selectedIds.length} rituels ?`)) return;
    }

    setPending(actionKey);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/rituals/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionKey, ids: selectedIds, note }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      const data = json.data as {
        totalSucceeded: number;
        totalSkipped: number;
        totalFailed: number;
      };
      setResult(
        `${data.totalSucceeded} ${actionKey}, ${data.totalSkipped} ignorés, ${data.totalFailed} échec(s)`,
      );
      onClearSelection();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const variantStyle = (variant?: string) => {
    if (variant === 'destructive') {
      return 'border-rose-300 bg-white text-rose-900 hover:bg-rose-50';
    }
    if (variant === 'secondary') {
      return 'border-stone-300 bg-white text-stone-900 hover:bg-stone-100';
    }
    return 'border-stone-900 bg-stone-900 text-white hover:bg-stone-800';
  };

  return (
    <div
      role="region"
      aria-label="Actions bulk"
      data-testid="bulk-action-bar"
      className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-3 border border-stone-200 bg-white p-3 shadow-sm"
    >
      <span className="text-sm font-medium text-stone-900">
        {selectedIds.length} sélectionné{selectedIds.length === 1 ? '' : 's'}
      </span>
      <button
        type="button"
        onClick={onClearSelection}
        className="text-xs text-stone-600 underline hover:text-stone-900"
      >
        Désélectionner
      </button>
      {selectedIds.length === totalVisible && totalVisible < totalAll && (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs text-stone-600 underline hover:text-stone-900"
          data-testid="bulk-select-all-results"
        >
          Tout sélectionner sur les {totalAll} résultats →
        </button>
      )}

      <div className="ml-auto flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={pending !== null}
            onClick={() => callAction(a.key, a.requiresNote === true)}
            data-testid={`bulk-action-${a.key}`}
            className={`border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${variantStyle(a.variant)}`}
          >
            {pending === a.key ? 'En cours…' : a.label}
          </button>
        ))}
      </div>

      {result && (
        <p
          role="status"
          className="basis-full bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
          data-testid="bulk-action-result"
        >
          ✓ {result}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="basis-full bg-rose-50 px-3 py-2 text-xs text-rose-900"
          data-testid="bulk-action-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
