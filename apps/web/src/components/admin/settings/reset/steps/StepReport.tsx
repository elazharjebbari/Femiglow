'use client';
import type { Dispatch } from 'react';
import Link from 'next/link';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} m ${Math.floor((ms % 60_000) / 1000)} s`;
}

export function StepReport({ state, dispatch }: Props) {
  const r = state.finalReport;
  if (!r) return <p className="text-sm text-stone-500">Pas de rapport.</p>;

  const success = r.status === 'completed';
  return (
    <div>
      <div className={`rounded-md p-4 ${success ? 'bg-emerald-50 text-emerald-900' : r.rolledBack ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-900'}`}>
        <h2 className="text-lg font-semibold">
          {success ? '✅ Reset terminé' : r.rolledBack ? '⚠ Reset échoué, rollback OK' : '❌ Reset échoué'}
        </h2>
        <p className="mt-1 text-sm">Durée : {fmtMs(r.durationMs)}</p>
        {r.errorCode && <p className="mt-1 text-sm"><strong>{r.errorCode}</strong> · {r.errorMessage}</p>}
      </div>
      {r.backupId && (
        <p className="mt-4 text-sm text-stone-700">
          <strong>Backup&nbsp;:</strong> <code className="font-mono text-xs">{r.backupId}</code>
        </p>
      )}
      {r.seedersReport && (
        <p className="mt-2 text-sm text-stone-700">
          <strong>Seeders&nbsp;:</strong> {r.seedersReport.completed} OK · {r.seedersReport.failed} échecs
        </p>
      )}
      {r.verify && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-stone-700">Vérifications post-reset</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {r.verify.checks.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 font-mono text-xs">
                <span className="w-4">
                  {c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : '⚠'}
                </span>
                <span className="flex-1">{c.label}</span>
                <span className="text-stone-500">{c.message ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={() => dispatch({ type: 'RESET_WIZARD' })}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
          Faire un autre reset
        </button>
        <Link href="/admin/settings"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
          Retour aux réglages
        </Link>
      </div>
    </div>
  );
}
