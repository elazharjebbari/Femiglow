'use client';

export type ComponentBulkAction =
  | 'activate-bindings'
  | 'deactivate-bindings'
  | 'publish-drafts';

interface Props {
  /** Nombre de composants sélectionnés. */
  count: number;
  /** Total de bindings actifs à travers la sélection (info). */
  bindingsInSelection?: number;
  /** Total de drafts à travers la sélection (info). */
  draftsInSelection?: number;
  busy: boolean;
  onActivateBindings: () => void;
  onDeactivateBindings: () => void;
  onPublishDrafts: () => void;
  onClear: () => void;
}

/**
 * Barre d'actions groupées (niveau composant) — calquée visuellement sur
 * `BulkActionBar` (slots) pour préserver l'UX entre la liste et le détail.
 */
export function ComponentBulkActionBar({
  count,
  bindingsInSelection,
  draftsInSelection,
  busy,
  onActivateBindings,
  onDeactivateBindings,
  onPublishDrafts,
  onClear,
}: Props) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Actions groupées composants"
      className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-900 px-3 py-2 text-xs text-white shadow-md"
    >
      <span className="font-semibold" data-testid="components-bulk-count">
        {count} composant{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
      </span>
      {(bindingsInSelection !== undefined || draftsInSelection !== undefined) && (
        <span className="text-stone-400" data-testid="components-bulk-meta">
          {bindingsInSelection !== undefined &&
            `${bindingsInSelection} binding${bindingsInSelection > 1 ? 's' : ''}`}
          {bindingsInSelection !== undefined && draftsInSelection !== undefined && ' · '}
          {draftsInSelection !== undefined &&
            `${draftsInSelection} draft${draftsInSelection > 1 ? 's' : ''}`}
        </span>
      )}
      <span aria-hidden="true" className="text-stone-500">
        ·
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onPublishDrafts}
        className="rounded-md bg-emerald-500 px-2 py-1 font-medium text-white hover:bg-emerald-400 disabled:opacity-60"
        data-testid="components-bulk-publish"
      >
        Publier les drafts
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onActivateBindings}
        className="rounded-md bg-stone-700 px-2 py-1 font-medium text-white hover:bg-stone-600 disabled:opacity-60"
      >
        Activer bindings
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            confirm(
              `Désactiver tous les bindings de ${count} composant${count > 1 ? 's' : ''} ?`,
            )
          ) {
            onDeactivateBindings();
          }
        }}
        className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-60"
      >
        Désactiver bindings
      </button>
      <span className="ml-auto" />
      <button
        type="button"
        onClick={onClear}
        className="rounded-md border border-stone-600 px-2 py-1 font-medium text-stone-200 hover:bg-stone-800"
      >
        Effacer
      </button>
    </div>
  );
}
