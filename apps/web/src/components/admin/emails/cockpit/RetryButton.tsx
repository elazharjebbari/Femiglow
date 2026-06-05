'use client';

/**
 * RetryButton — bouton « Renvoyer » du détail d'un envoi (UX-COCKPIT-005).
 *
 * Remplace le `<form action={retryOutboxAction}>` muet : ajoute
 *  - une confirmation explicite avant renvoi (pas de relance par mégarde) ;
 *  - un état pending (bouton disabled + « Renvoi… ») → anti double-clic = pas de
 *    double enqueue ;
 *  - un feedback honnête succès/erreur via role=alert (succès ET échec visibles,
 *    plus de page d'erreur Next générique illisible).
 *
 * Implémentation : on appelle la server action `retryOutboxActionState`
 * directement et on pilote nous-mêmes l'état `submitting` (verrou pending) —
 * on n'utilise PAS `useFormState`/`useFormStatus` (absents du build react-dom
 * 18.3 de ce projet) ni `useTransition.isPending` (ne couvre pas un await
 * arbitraire).
 */
import { useCallback, useState } from 'react';
import {
  retryOutboxActionState,
  RETRY_INITIAL_STATE,
  type RetryActionState,
} from '@/lib/admin/emails/actions';

export function RetryButton({ outboxId }: { outboxId: string }) {
  const [state, setState] = useState<RetryActionState>(RETRY_INITIAL_STATE);
  const [isPending, setIsPending] = useState(false);

  const handleClick = useCallback(async () => {
    if (isPending) return; // anti double-clic (le bouton est déjà disabled).
    if (!window.confirm('Remettre cet envoi en file ?')) return;
    const formData = new FormData();
    formData.set('id', outboxId);
    setIsPending(true);
    try {
      const next = await retryOutboxActionState(RETRY_INITIAL_STATE, formData);
      setState(next);
    } catch (err) {
      setState({ ok: false, message: `Le renvoi a échoué : ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsPending(false);
    }
  }, [isPending, outboxId]);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isPending}
        aria-disabled={isPending}
        data-testid="retry-submit"
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Renvoi…' : '↻ Renvoyer'}
      </button>

      {state.ok === true && (
        <div
          role="alert"
          data-testid="retry-feedback-ok"
          className="mt-3 rounded-md border border-sage-300 bg-sage-50 p-3 text-sm text-sage-800"
        >
          <span aria-hidden="true" className="mr-1.5">✓</span>
          {state.message}
        </div>
      )}
      {state.ok === false && (
        <div
          role="alert"
          data-testid="retry-feedback-error"
          className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}
    </div>
  );
}
