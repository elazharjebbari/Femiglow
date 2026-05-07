'use client';

export type ProductBulkAction =
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'restore-status'
  | 'hard-delete';

interface Props {
  /** Nombre de produits sélectionnés. */
  count: number;
  /** Stats par statut dans la sélection (info). */
  drafts?: number;
  published?: number;
  archived?: number;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
  onClear: () => void;
}

/**
 * Barre d'actions groupées (niveau produit) — calquée visuellement sur
 * `ComponentBulkActionBar` pour préserver la cohérence UX entre catalogues.
 *
 * Chaque action affiche les pré-conditions correspondantes :
 *  - Publier        : draft|published → published (snapshot)
 *  - Dépublier      : published → draft
 *  - Archiver       : * → archived
 *  - Restaurer      : archived → draft
 *  - Suppression dure : archived → suppression définitive (cascade variants)
 */
export function ProductsBulkActionBar({
  count,
  drafts,
  published,
  archived,
  busy,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onHardDelete,
  onClear,
}: Props) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Actions groupées produits"
      className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-900 px-3 py-2 text-xs text-white shadow-md"
    >
      <span className="font-semibold" data-testid="products-bulk-count">
        {count} produit{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
      </span>
      {(drafts !== undefined || published !== undefined || archived !== undefined) && (
        <span className="text-stone-400" data-testid="products-bulk-meta">
          {drafts ?? 0} draft · {published ?? 0} pub · {archived ?? 0} arch
        </span>
      )}
      <span aria-hidden="true" className="text-stone-500">
        ·
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={onPublish}
        className="rounded-md bg-emerald-500 px-2 py-1 font-medium text-white hover:bg-emerald-400 disabled:opacity-60"
        data-testid="products-bulk-publish"
      >
        Publier
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            confirm(
              `Dépublier ${count} produit${count > 1 ? 's' : ''} ? Le snapshot reste consultable côté admin.`,
            )
          ) {
            onUnpublish();
          }
        }}
        className="rounded-md bg-amber-500 px-2 py-1 font-medium text-white hover:bg-amber-400 disabled:opacity-60"
      >
        Dépublier
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            confirm(
              `Archiver ${count} produit${count > 1 ? 's' : ''} ? Ils seront masqués côté public.`,
            )
          ) {
            onArchive();
          }
        }}
        className="rounded-md bg-stone-700 px-2 py-1 font-medium text-white hover:bg-stone-600 disabled:opacity-60"
      >
        Archiver
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRestore}
        className="rounded-md bg-stone-600 px-2 py-1 font-medium text-white hover:bg-stone-500 disabled:opacity-60"
      >
        Restaurer (draft)
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            confirm(
              `Supprimer définitivement ${count} produit${count > 1 ? 's' : ''} ? Cette action est irréversible (variants + snapshots inclus).`,
            )
          ) {
            onHardDelete();
          }
        }}
        className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-60"
        data-testid="products-bulk-delete"
      >
        Supprimer
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
