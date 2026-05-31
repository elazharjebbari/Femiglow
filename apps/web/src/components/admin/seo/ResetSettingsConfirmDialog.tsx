/**
 * `ResetSettingsConfirmDialog` — modale de confirmation pour le reset des
 * settings SEO globaux vers les defaults code.
 *
 * Action destructive (efface la config personnalisée et la remplace par
 * les valeurs codées dans `lib/seo/defaults.ts`). Comme pour le bulk
 * delete, on exige une saisie explicite pour empêcher un déclenchement
 * réflexe : ici l'éditeur doit taper le mot `RESET` en majuscules.
 *
 * L'état précédent reste accessible via l'audit log (`seo.settings.reset`
 * avec `meta.previous`), donc le risque est contenu — mais une confirmation
 * forte reste de mise.
 *
 * A11y similaire à `BulkDeleteConfirmDialog` :
 *  - `role="dialog"` + `aria-modal` + labelled/described by.
 *  - Focus initial sur l'input.
 *  - `Escape` → onCancel ; clic backdrop → onCancel.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface ResetSettingsConfirmDialogProps {
  open: boolean;
  busy?: boolean;
  /**
   * Texte que l'utilisateur doit taper pour activer le bouton.
   * Défaut : `RESET`.
   */
  expectedToken?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetSettingsConfirmDialog({
  open,
  busy = false,
  expectedToken = 'RESET',
  onConfirm,
  onCancel,
}: ResetSettingsConfirmDialogProps): JSX.Element | null {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (open) {
      setValue('');
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

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

  const matches = value === expectedToken;
  const canConfirm = matches && !busy;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 px-4"
      data-testid="seo-reset-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-xl border border-stone-200 bg-[#FBF8F1] p-6 shadow-xl"
        data-testid="seo-reset-dialog"
      >
        <h2 id={titleId} className="font-serif text-xl text-[#2C2A28]">
          Restaurer les paramètres par défaut
        </h2>
        <p id={descId} className="mt-3 text-sm text-stone-700">
          Les settings SEO globaux (site name, description par défaut, OG image,
          robots, Organization JSON-LD, pages connues) seront remplacés par les
          valeurs codées dans le module SEO. L'état actuel sera conservé dans
          l'audit log pour permettre une restauration manuelle si besoin.
        </p>
        <p className="mt-3 text-sm text-stone-700">
          Pour confirmer, tapez{' '}
          <code className="rounded bg-stone-200 px-1 py-0.5 font-mono text-xs text-stone-800">
            {expectedToken}
          </code>{' '}
          :
        </p>

        <label className="mt-3 block text-xs font-medium text-stone-600">
          Confirmation
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={value !== '' && !matches}
            disabled={busy}
            data-testid="seo-reset-input"
            className="mt-1 block w-44 rounded-md border border-stone-300 px-3 py-2 font-mono text-base uppercase tracking-widest text-[#2C2A28] focus:border-[#C8A876] focus:outline-none focus:ring-2 focus:ring-[#C8A876]/40 disabled:opacity-60"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
            data-testid="seo-reset-cancel"
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
            data-testid="seo-reset-confirm"
          >
            {busy ? 'Restauration…' : 'Restaurer les défauts'}
          </button>
        </div>
      </div>
    </div>
  );
}
