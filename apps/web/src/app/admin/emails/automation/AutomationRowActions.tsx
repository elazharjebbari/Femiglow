'use client';

/**
 * Actions client de la liste automations + runs (UX-AUT-003 / UX-AUT-012).
 *
 *  - ToggleAutomationButton : activer/désactiver une automation, avec
 *    CONFIRMATION explicite à la désactivation (les runs en cours seront
 *    annulés), feedback role=alert/role=status et anti-double-clic (pending).
 *  - CancelRunButton        : annuler un run en cours, avec confirmation,
 *    feedback et anti-double-clic.
 *  - RetryRunButton         : relancer un run errored, avec feedback et
 *    anti-double-clic.
 *
 * Toutes s'appuient sur `useFormState` (react-dom, React 18) + une server action
 * renvoyant `{ ok, message }` ; le feedback est annoncé via aria-live.
 */
import { useEffect, useRef, useState } from 'react';
// React 18 : useFormState/useFormStatus vivent dans react-dom (pas react).
import { useFormState, useFormStatus } from 'react-dom';
import {
  toggleAutomationActive,
  cancelAutomationRun,
  retryAutomationRun,
  type ActionResult,
} from '@/lib/admin/emails/automation-actions';

function SubmitButton({
  children,
  className,
  confirm,
  pendingLabel,
}: {
  children: React.ReactNode;
  className: string;
  confirm?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:opacity-50`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel ?? '…' : children}
    </button>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <span
      role={state.ok ? 'status' : 'alert'}
      aria-live="polite"
      className={`ml-2 text-xs ${state.ok ? 'text-emerald-700' : 'text-rose-700'}`}
    >
      {state.message}
    </span>
  );
}

export function ToggleAutomationButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    (_prev, fd) => toggleAutomationActive(undefined, fd),
    null,
  );
  return (
    <form action={formAction} className="inline-flex items-center">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next" value={String(!active)} />
      <SubmitButton
        className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
        pendingLabel={active ? 'Désactivation…' : 'Activation…'}
        confirm={
          active
            ? 'Désactiver cette automation ? Ses runs en cours seront annulés au prochain tick.'
            : undefined
        }
      >
        {active ? 'Désactiver' : 'Activer'}
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function CancelRunButton({ id }: { id: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    (_prev, fd) => cancelAutomationRun(undefined, fd),
    null,
  );
  return (
    <form action={formAction} className="inline-flex items-center">
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
        pendingLabel="Annulation…"
        confirm="Annuler ce run en cours ?"
      >
        Annuler
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function RetryRunButton({ id }: { id: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    (_prev, fd) => retryAutomationRun(undefined, fd),
    null,
  );
  return (
    <form action={formAction} className="inline-flex items-center">
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        pendingLabel="Relance…"
        confirm="Relancer ce run en erreur ? Il reprendra au step courant."
      >
        Relancer
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Variante "page détail" du bouton Relancer : après succès, propose un rechargement
 * explicite (la page RSC est revalidée mais on confirme visuellement l'état).
 */
export function RetryRunDetailButton({ id }: { id: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    (_prev, fd) => retryAutomationRun(undefined, fd),
    null,
  );
  const liveRef = useRef<HTMLDivElement>(null);
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (state?.ok) setAnnounced(true);
  }, [state]);
  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton
          className="rounded border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          pendingLabel="Relance en cours…"
          confirm="Relancer ce run en erreur ? Il reprendra au step courant au prochain tick."
        >
          Relancer ce run
        </SubmitButton>
      </form>
      <div ref={liveRef} aria-live="polite">
        {state && (
          <p
            role={state.ok ? 'status' : 'alert'}
            className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-rose-700'}`}
          >
            {state.message}
            {announced && state.ok ? ' Rechargez pour voir le nouvel état.' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
