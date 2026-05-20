/**
 * `BulkDeleteConfirmDialog` — modale de confirmation pour la suppression
 * groupée d'overrides SEO.
 *
 * Pourquoi ne pas réutiliser `window.confirm` natif (cf. version précédente
 * de `SeoBulkActionBar`) :
 *  - non stylable (UX hors charte maison),
 *  - bloque la boucle d'événements,
 *  - aucune protection contre le clic réflexe : un OK suffit pour effacer
 *    une sélection massive.
 *
 * Ici on demande une **saisie du nombre exact** d'éléments concernés avant
 * d'activer le bouton de suppression. Coût pour l'éditeur : 1 s. Bénéfice :
 * pas de suppression accidentelle quand on enchaîne plusieurs lots.
 *
 * Le composant est piloté (controlled) — il ne gère pas son propre `open`.
 *
 * A11y :
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + `aria-describedby`.
 *  - Focus initial sur le champ de saisie.
 *  - `Escape` ferme via `onCancel`.
 *  - Clic sur le backdrop ferme via `onCancel`.
 *  - Le bouton de confirmation reste désactivé tant que la saisie ne
 *    correspond pas exactement à `count` ou que `busy === true`.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface BulkDeleteConfirmDialogProps {
  open: boolean;
  /** Nombre d'éléments visés par la suppression. Doit être saisi à l'identique. */
  count: number;
  /** Action en cours côté serveur — désactive les boutons. */
  busy?: boolean;
  /** Libellé court de la cible (e.g. "override SEO"). Pluralisé via `count`. */
  itemLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkDeleteConfirmDialog({
  open,
  count,
  busy = false,
  itemLabel = 'override SEO',
  onConfirm,
  onCancel,
}: BulkDeleteConfirmDialogProps): JSX.Element | null {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  // Reset du champ à chaque (re)ouverture pour éviter qu'un clic accidentel
  // sur une nouvelle confirmation hérite de la saisie précédente.
  useEffect(() => {
    if (open) {
      setValue('');
      // Focus initial sur l'input — différé d'un tick pour laisser le portail
      // se monter avant de demander le focus.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Escape ferme la modale (équivalent du bouton Annuler).
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const expected = String(count);
  const matchesExpected = value.trim() === expected;
  const canConfirm = matchesExpected && !busy && count > 0;
  const plural = count > 1;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        // Clic sur le backdrop uniquement (pas l'intérieur de la carte).
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 px-4"
      data-testid="seo-bulk-delete-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-xl border border-stone-200 bg-[#FBF8F1] p-6 shadow-xl"
        data-testid="seo-bulk-delete-dialog"
      >
        <h2 id={titleId} className="font-serif text-xl text-[#2C2A28]">
          Confirmer la suppression
        </h2>
        <p id={descId} className="mt-3 text-sm text-stone-700">
          Vous êtes sur le point de supprimer{' '}
          <strong>
            {count} {itemLabel}
            {plural ? 's' : ''}
          </strong>
          . Cette action est irréversible.
        </p>
        <p className="mt-3 text-sm text-stone-700">
          Pour confirmer, saisissez le nombre exact :
        </p>

        <label className="mt-3 block text-xs font-medium text-stone-600">
          Nombre attendu
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={value !== '' && !matchesExpected}
            disabled={busy}
            data-testid="seo-bulk-delete-input"
            className="mt-1 block w-32 rounded-md border border-stone-300 px-3 py-2 font-mono text-base text-[#2C2A28] focus:border-[#C8A876] focus:outline-none focus:ring-2 focus:ring-[#C8A876]/40 disabled:opacity-60"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
            data-testid="seo-bulk-delete-cancel"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (canConfirm) onConfirm();
            }}
            disabled={!canConfirm}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="seo-bulk-delete-confirm"
          >
            {busy ? 'Suppression…' : `Supprimer ${count} ${itemLabel}${plural ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
