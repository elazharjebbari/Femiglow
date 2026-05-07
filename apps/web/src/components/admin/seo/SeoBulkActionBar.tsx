'use client';

export type SeoBulkAction = 'publish' | 'unpublish' | 'delete';

interface Props {
  count: number;
  drafts?: number;
  published?: number;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Barre d'actions groupées (niveau override SEO).
 */
export function SeoBulkActionBar({
  count,
  drafts,
  published,
  busy,
  onPublish,
  onUnpublish,
  onDelete,
  onClear,
}: Props) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Actions groupées SEO"
      className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-900 px-3 py-2 text-xs text-white shadow-md"
    >
      <span className="font-semibold" data-testid="seo-bulk-count">
        {count} override{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
      </span>
      {(drafts !== undefined || published !== undefined) && (
        <span className="text-stone-400" data-testid="seo-bulk-meta">
          {drafts ?? 0} draft · {published ?? 0} publié{(published ?? 0) > 1 ? 's' : ''}
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
        data-testid="seo-bulk-publish"
      >
        Publier
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            confirm(
              `Dépublier ${count} override${count > 1 ? 's' : ''} ? La cascade settings → defaults reprendra côté public.`,
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
              `Supprimer définitivement ${count} override${count > 1 ? 's' : ''} ? Cette action est irréversible.`,
            )
          ) {
            onDelete();
          }
        }}
        className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-60"
        data-testid="seo-bulk-delete"
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
