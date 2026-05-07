'use client';

import { useEffect, useRef } from 'react';

interface Props {
  totalCount: number;
  selectedCount: number;
  onChange: (next: boolean) => void;
  /** Aria-label personnalisé. */
  label?: string;
}

/**
 * Checkbox tri-state (« voyant ») :
 *  - vide        → aucune sélection,
 *  - indéterminé → sélection partielle (visible via `indeterminate=true`),
 *  - cochée      → tout sélectionné.
 *
 * Cliquer la case bascule entre « rien » et « tout », jamais vers indéterminé.
 */
export function SelectAllCheckbox({ totalCount, selectedCount, onChange, label }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);

  const allChecked = totalCount > 0 && selectedCount === totalCount;
  const someChecked = selectedCount > 0 && selectedCount < totalCount;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  return (
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <input
        ref={ref}
        type="checkbox"
        aria-label={label ?? 'Tout sélectionner'}
        checked={allChecked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="h-4 w-4 cursor-pointer rounded border-stone-300"
        data-testid="select-all"
      />
      <span data-testid="select-all-state">
        {allChecked
          ? 'Tout sélectionné'
          : someChecked
            ? `${selectedCount} / ${totalCount} sélectionné(s)`
            : 'Tout sélectionner'}
      </span>
    </label>
  );
}
