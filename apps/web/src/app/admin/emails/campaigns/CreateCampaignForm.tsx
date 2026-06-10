'use client';

/**
 * UX-CAMP-009 — formulaire « Nouvelle campagne » avec feedback d'erreur inline
 * (role=alert) et anti-double-clic (`useFormStatus` → bouton désactivé pendant
 * la soumission). Auparavant : form natif qui crashait sur erreur et autorisait
 * deux brouillons au double-clic.
 */
// React 18 (App Router) : `useFormState`/`useFormStatus` viennent de `react-dom`
// (`useActionState` n'existe qu'en React 19). Next fournit ces hooks au runtime.
import { useFormState, useFormStatus } from 'react-dom';
import {
  createCampaignDraftAction,
  type CreateDraftState,
} from '@/lib/admin/emails/wizard-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
    >
      {pending ? 'Création…' : '+ Créer'}
    </button>
  );
}

export function CreateCampaignForm() {
  const [state, formAction] = useFormState<CreateDraftState, FormData>(
    createCampaignDraftAction,
    { error: null },
  );

  return (
    // id ciblé par le redirect /admin/emails/campaigns/new → #nouvelle-campagne :
    // sans cette ancre le fragment ne mène nulle part (F02-E-005).
    <form action={formAction} id="nouvelle-campagne">
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Nouvelle campagne</span>
        <div className="mt-1 flex gap-2">
          <input
            name="name"
            type="text"
            required
            minLength={3}
            maxLength={120}
            placeholder="Nom interne"
            aria-label="Nom de la nouvelle campagne"
            aria-invalid={state.error ? true : undefined}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <SubmitButton />
        </div>
      </label>
      {state.error ? (
        <p role="alert" className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
