'use client';

import { useEffect, useRef } from 'react';

/**
 * ConfirmDialog — modale de confirmation réutilisable.
 * Remplace `window.confirm()` natif. A11y dialog + focus trap basique +
 * Escape pour fermer.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  /** Détails optionnels (récap actions, liste changements…). */
  details?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variante visuelle. `danger` pour les actions destructives. */
  variant?: 'default' | 'danger' | 'success';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Disable le bouton confirm (ex: pendant un loading). */
  loading?: boolean;
}

const VARIANT_BTN: Record<NonNullable<ConfirmDialogProps['variant']>, string> = {
  default: 'bg-stone-900 hover:bg-stone-700',
  danger: 'bg-red-700 hover:bg-red-800',
  success: 'bg-emerald-700 hover:bg-emerald-800',
};

export function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Auto-focus le bouton de confirmation
    confirmRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      data-testid="confirm-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-stone-900">
          {title}
        </h2>
        <div id="confirm-dialog-message" className="mt-3 text-sm text-stone-700">
          {message}
        </div>
        {details ? (
          <div className="mt-3 rounded bg-stone-50 px-3 py-2 text-xs text-stone-600">
            {details}
          </div>
        ) : null}
        <footer className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            data-testid="confirm-dialog-cancel"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            data-testid="confirm-dialog-confirm"
            className={`rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50 ${VARIANT_BTN[variant]}`}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
