'use client';

import type { MediaObjectFit, MediaObjectPosition } from '@/lib/db/types';

export type BulkAction =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'delete' }
  | { kind: 'set-display'; objectFit: MediaObjectFit; objectPosition: MediaObjectPosition };

interface Props {
  /** Nombre de bindings sélectionnés. */
  count: number;
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onSetDisplay: (fit: MediaObjectFit, pos: MediaObjectPosition) => void;
  onClear: () => void;
}

const FIT_OPTIONS: Array<{ value: MediaObjectFit; label: string }> = [
  { value: 'cover', label: 'Remplir (cover)' },
  { value: 'contain', label: 'Entier (contain)' },
  { value: 'fill', label: 'Étirer' },
  { value: 'none', label: 'Naturel' },
  { value: 'scale-down', label: 'Réduit si besoin' },
];

const POS_OPTIONS: Array<{ value: MediaObjectPosition; label: string }> = [
  { value: 'center', label: 'Centré' },
  { value: 'top', label: 'Haut' },
  { value: 'bottom', label: 'Bas' },
  { value: 'left', label: 'Gauche' },
  { value: 'right', label: 'Droite' },
];

/**
 * Barre d'actions groupées affichée quand au moins un binding est
 * sélectionné dans la liste des slots.
 *
 * - tous les boutons sont désactivés tant qu'aucune sélection n'existe
 *   ET tant qu'une action est en cours.
 * - le selecteur d'affichage applique fit + position en un clic.
 */
export function BulkActionBar({
  count,
  busy,
  onActivate,
  onDeactivate,
  onDelete,
  onSetDisplay,
  onClear,
}: Props) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Actions groupées"
      className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-900 px-3 py-2 text-xs text-white shadow-md"
    >
      <span className="font-semibold" data-testid="bulk-count">
        {count} sélectionné{count > 1 ? 's' : ''}
      </span>
      <span aria-hidden="true" className="text-stone-500">
        ·
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onActivate}
        className="rounded-md bg-emerald-500 px-2 py-1 font-medium text-white hover:bg-emerald-400 disabled:opacity-60"
      >
        Activer
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDeactivate}
        className="rounded-md bg-stone-700 px-2 py-1 font-medium text-white hover:bg-stone-600 disabled:opacity-60"
      >
        Désactiver
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (confirm(`Supprimer ${count} binding(s) ?`)) onDelete();
        }}
        className="rounded-md bg-rose-600 px-2 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-60"
      >
        Supprimer
      </button>
      <span aria-hidden="true" className="text-stone-500">
        ·
      </span>
      <label className="flex items-center gap-1">
        <span className="sr-only">Mode d&apos;affichage</span>
        <select
          aria-label="Mode d'affichage groupé (fit)"
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            const fit = e.target.value as MediaObjectFit | '';
            if (!fit) return;
            onSetDisplay(fit, 'center');
            e.target.value = '';
          }}
          className="rounded-md bg-stone-800 px-2 py-1 text-white"
        >
          <option value="">Mode d&apos;affichage…</option>
          {FIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="sr-only">Position</span>
        <select
          aria-label="Position groupée"
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            const pos = e.target.value as MediaObjectPosition | '';
            if (!pos) return;
            onSetDisplay('cover', pos);
            e.target.value = '';
          }}
          className="rounded-md bg-stone-800 px-2 py-1 text-white"
        >
          <option value="">Position…</option>
          {POS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
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
