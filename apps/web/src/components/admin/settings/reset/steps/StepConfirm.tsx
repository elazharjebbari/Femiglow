'use client';
import { useState, type Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

export function StepConfirm({ state, dispatch }: Props) {
  const expected: 'RESET' | 'HARD RESET' = state.mode === 'hard' ? 'HARD RESET' : 'RESET';
  const match = state.confirm === expected;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit() {
    if (!match) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const body = {
        mode: state.mode,
        domains: state.mode === 'custom' ? state.domains : undefined,
        preserve: state.preserve,
        wipeMedia: state.wipeMedia,
        wipeNextCache: state.wipeNextCache,
        withBackup: state.withBackup,
        keepBackups: state.keepBackups,
        dryRun: state.dryRun,
        confirm: expected,
      };
      const r = await fetch('/api/admin/reset/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(`${data?.error?.code ?? 'ERROR'}: ${data?.error?.message ?? 'failed'}`);
      } else {
        dispatch({ type: 'START_JOB', jobId: data.jobId, plan: data.plan });
      }
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isHard = state.mode === 'hard';
  return (
    <div>
      <h2 className={`text-lg font-semibold ${isHard ? 'text-rose-900' : 'text-stone-900'}`}>
        {isHard ? '⚠ Action destructive — Confirmation' : 'Confirmation'}
      </h2>
      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Action {state.dryRun ? '(dry-run, sans destruction)' : 'irréversible (mais avec backup)'}.
        Tape exactement <code className="rounded bg-rose-100 px-1 font-mono text-xs">{expected}</code> pour démarrer.
      </div>
      <label className="mt-4 block text-sm font-medium text-stone-700">Texte de confirmation</label>
      <input
        type="text"
        value={state.confirm}
        onChange={(e) => dispatch({ type: 'SET_CONFIRM', v: e.target.value })}
        placeholder={expected}
        className="mt-1 w-full max-w-sm rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        aria-describedby="confirm-hint"
      />
      <p id="confirm-hint" className="mt-1 text-xs text-stone-500">
        {match ? '✅ Le texte correspond.' : `Doit valoir « ${expected} » exactement.`}
      </p>
      {submitError && (
        <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{submitError}</p>
      )}
      <div className="mt-6 flex justify-between">
        <button type="button" onClick={() => dispatch({ type: 'BACK' })} disabled={submitting}
          className="text-sm text-stone-600 hover:underline disabled:opacity-50">← Retour</button>
        <button type="button" onClick={onSubmit} disabled={!match || submitting}
          className={`rounded-md px-5 py-2 text-sm font-medium text-white disabled:bg-stone-300 ${isHard ? 'bg-rose-700 hover:bg-rose-800' : 'bg-stone-900 hover:bg-stone-800'}`}>
          {submitting ? 'Démarrage…' : 'Démarrer le reset'}
        </button>
      </div>
    </div>
  );
}
