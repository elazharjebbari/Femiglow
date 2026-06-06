'use client';

/**
 * ConfirmDialog — confirmation destructive accessible (SOC-F01 / TRV-01).
 *
 * Remplace TOUS les `window.confirm` de la section emails (règle lint à venir).
 * Contrat (spec F01-socle-feedback/02-spec-technique.yaml) :
 *   - focus initial sur Annuler, retour du focus au déclencheur à la fermeture ;
 *   - Esc / clic backdrop = onCancel (jamais l'action) ;
 *   - Enter soumet UNE fois (ignoré si busy ou saisie invalide) ;
 *   - `requireText` (massif/irréversible) : bouton désactivé tant que la saisie
 *     ne correspond pas (trim + casse ignorées) ;
 *   - onConfirm async : busy + aria-busy + libellé dédié, 1 seule invocation ;
 *     un REJET laisse le dialog ouvert (role=alert interne, saisie préservée) —
 *     la fermeture sur succès appartient au parent (prop `open` contrôlée) ;
 *   - libellé du bouton = un VERBE (« Supprimer »), jamais « OK ».
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body?: ReactNode;
  /** Verbe d'action (« Supprimer », « Annuler l'envoi »…) — jamais « OK ». */
  confirmLabel?: string;
  /** Libellé pendant l'action async (défaut : `${confirmLabel}…`). */
  busyLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  /** Si défini, l'utilisateur doit taper ce texte pour activer la confirmation. */
  requireText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmer',
  busyLabel,
  cancelLabel = 'Annuler',
  variant = 'default',
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requireOk = !requireText || normalize(typedText) === normalize(requireText);

  // Ouverture : mémorise le déclencheur, pose le focus sur Annuler, reset état.
  useEffect(() => {
    if (open) {
      openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
      setBusy(false);
      setTypedText('');
      setError(null);
      // après le paint, pour que le bouton existe
      const t = setTimeout(() => cancelRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    // Fermeture : retour du focus au déclencheur (succès, Esc, Annuler, backdrop).
    openerRef.current?.focus?.();
    return undefined;
  }, [open]);

  const confirm = useCallback(async () => {
    if (busy || !requireOk) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      // Le parent ferme via `open` ; si le dialog reste monté, on ré-arme.
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie.');
    }
  }, [busy, requireOk, onConfirm]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancel();
        return;
      }
      if (e.key === 'Enter') {
        // Soumission unique au niveau dialog (jamais le submit natif du bouton
        // focalisé — sauf Annuler, qui garde son comportement naturel).
        if (document.activeElement === cancelRef.current) return;
        e.preventDefault();
        void confirm();
        return;
      }
      if (e.key === 'Tab') {
        // Piège de focus : cycle dans le dialog.
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [busy, confirm, onCancel],
  );

  if (!open) return null;

  const confirmTone = variant === 'danger' ? 'danger' : 'default';
  const confirmCls =
    variant === 'danger'
      ? 'bg-rose-700 text-white hover:bg-rose-800'
      : 'bg-stone-900 text-white hover:bg-stone-800';

  return (
    // Overlay : clic = annuler ; le clic DANS le dialog ne remonte pas.
    <div
      data-testid="confirm-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-stone-900">
          {title}
        </h2>
        {body ? (
          <div id={bodyId} className="mt-2 text-sm text-stone-600">
            {body}
          </div>
        ) : null}

        {requireText ? (
          <div className="mt-3">
            <label htmlFor={inputId} className="block text-xs font-medium text-stone-600">
              Tapez {requireText} pour confirmer
            </label>
            <input
              id={inputId}
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-sm"
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-tone={confirmTone}
            disabled={busy || !requireOk}
            aria-busy={busy || undefined}
            onClick={() => void confirm()}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${confirmCls}`}
          >
            {busy ? (busyLabel ?? `${confirmLabel}…`) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
