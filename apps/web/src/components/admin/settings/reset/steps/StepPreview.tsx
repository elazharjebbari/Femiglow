'use client';
import { useEffect, useRef, type Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

export function StepPreview({ state, dispatch }: Props) {
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current || !state.mode) return;
    fetched.current = true;
    dispatch({ type: 'PREFLIGHT_LOADING', v: true });
    const body = {
      mode: state.mode,
      domains: state.mode === 'custom' ? state.domains : undefined,
      preserve: state.preserve,
      wipeMedia: state.wipeMedia,
      wipeNextCache: state.wipeNextCache,
      withBackup: state.withBackup,
      keepBackups: state.keepBackups,
      dryRun: state.dryRun,
      confirm: state.mode === 'hard' ? 'HARD RESET' : 'RESET',
    };
    fetch('/api/admin/reset/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          dispatch({ type: 'PREFLIGHT_ERROR', error: { code: data?.error?.code ?? 'ERROR', message: data?.error?.message ?? 'preflight failed' } });
        } else {
          dispatch({ type: 'PREFLIGHT_OK', plan: data.plan, rowCounts: data.rowCounts ?? {} });
        }
      })
      .catch((err) => dispatch({ type: 'PREFLIGHT_ERROR', error: { code: 'NETWORK', message: String(err) } }));
  }, [dispatch, state.mode, state.domains, state.preserve, state.wipeMedia, state.wipeNextCache, state.withBackup, state.keepBackups, state.dryRun]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Aperçu de l&apos;impact</h2>
      {state.preflightLoading && <p className="mt-3 text-sm text-stone-500">Préflight en cours…</p>}
      {state.error && (
        <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">
          <strong>{state.error.code}</strong> · {state.error.message}
        </p>
      )}
      {state.plan && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-stone-700">
            <dt className="text-stone-500">Mode</dt><dd className="font-semibold">{state.plan.mode}</dd>
            <dt className="text-stone-500">ETA total</dt><dd>{(state.plan.totalEtaMs / 1000).toFixed(0)} s</dd>
            <dt className="text-stone-500">Phases</dt><dd>{state.plan.phases.length}</dd>
            <dt className="text-stone-500">Stratégie DB</dt><dd>{state.plan.dbStrategy}</dd>
            <dt className="text-stone-500">Backup</dt><dd>{state.withBackup ? 'oui' : 'non'}</dd>
            <dt className="text-stone-500">Wipe média</dt><dd>{state.wipeMedia ? 'oui' : 'non'}</dd>
          </dl>
          <h3 className="mt-4 text-sm font-medium text-stone-700">Phases prévues</h3>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-stone-700">
            {state.plan.phases.map((p) => (
              <li key={p.name}>
                <code className="font-mono text-xs">{p.name}</code> — {p.label} (~{(p.estimatedDurationMs/1000).toFixed(1)}s){p.critical ? ' · critical' : ''}
              </li>
            ))}
          </ol>
          {Object.keys(state.rowCounts).length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-medium text-stone-700">Row counts actuels (extrait)</h3>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-xs uppercase text-stone-500">
                  <tr><th className="py-1">Table</th><th className="py-1">Avant</th><th className="py-1">Action</th></tr>
                </thead>
                <tbody>
                  {Object.entries(state.rowCounts).slice(0, 12).map(([t, n]) => {
                    const preserved = (state.preserve as string[]).includes(t);
                    const truncate = state.plan!.truncateTables.includes(t);
                    const action = state.plan!.dbStrategy === 'drop-schema' && !preserved ? 'DROP' :
                      truncate ? 'TRUNCATE' : preserved ? 'préservé' : 'upsert';
                    return (
                      <tr key={t} className="border-t border-stone-100">
                        <td className="py-1 font-mono text-xs">{t}</td>
                        <td className="py-1 tabular-nums">{n < 0 ? '—' : n}</td>
                        <td className="py-1 text-xs text-stone-600">{action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
      <div className="mt-6 flex justify-between">
        <button type="button" onClick={() => dispatch({ type: 'BACK' })}
          className="text-sm text-stone-600 hover:underline">← Retour</button>
        <button type="button" onClick={() => dispatch({ type: 'NEXT' })} disabled={!state.plan}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:bg-stone-300">
          Suivant →
        </button>
      </div>
    </div>
  );
}
