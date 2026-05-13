'use client';
import { useState, type Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';
import type { PhaseName } from '@/lib/reset/types';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} m ${Math.floor((ms % 60_000) / 1000)} s`;
}

export function StepExecute({ state, dispatch }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const phasesArr = state.plan?.phases ?? [];

  async function onCancel() {
    if (!state.jobId) return;
    setCancelling(true);
    try {
      await fetch(`/api/admin/reset/jobs/${state.jobId}/cancel`, { method: 'POST' });
    } finally {
      setCancelling(false);
    }
  }
  void dispatch;

  const currentIndex = phasesArr.findIndex((p) => state.phases[p.name]?.status === 'running');
  const totalProgress = phasesArr.length > 0
    ? phasesArr.filter((p) => state.phases[p.name]?.status === 'done').length / phasesArr.length
    : 0;

  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Reset en cours…</h2>
      <div className="mt-4">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div
              role="progressbar"
              aria-valuenow={Math.round(totalProgress * 100)} aria-valuemin={0} aria-valuemax={100}
              aria-label="Progression globale"
              className="h-full bg-stone-900 transition-all"
              style={{ width: `${totalProgress * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-stone-500">{Math.round(totalProgress * 100)}%</span>
        </div>
        {currentIndex >= 0 && phasesArr[currentIndex] && (
          <p className="mt-2 text-sm text-stone-700" aria-live="polite">
            Phase {currentIndex + 1} / {phasesArr.length} · {phasesArr[currentIndex].label}
          </p>
        )}
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {phasesArr.map((p) => {
          const st = state.phases[p.name as PhaseName];
          const icon = st?.status === 'done' ? '✅'
            : st?.status === 'error' ? '❌'
            : st?.status === 'running' ? '▶ '
            : st?.status === 'skipped' ? '⏭️' : '·';
          return (
            <li key={p.name} className="flex items-baseline gap-2 font-mono text-xs">
              <span className="w-4">{icon}</span>
              <span className="w-40">{p.label}</span>
              <span className="text-stone-500">{st?.summary ?? ''}</span>
              {st?.durationMs !== undefined && (
                <span className="ml-auto text-stone-400">{fmtMs(st.durationMs)}</span>
              )}
            </li>
          );
        })}
      </ul>
      {state.rollback && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>🔄 Rollback en cours</strong>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-200">
            <div className="h-full bg-amber-600 transition-all" style={{ width: `${(state.rollback.progress ?? 0) * 100}%` }} />
          </div>
          {state.rollback.done && !state.rollback.failed && <p className="mt-1">Rollback OK.</p>}
          {state.rollback.failed && <p className="mt-1 font-semibold text-rose-900">Rollback ÉCHOUÉ.</p>}
        </div>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-stone-700">Logs détaillés ({state.events.length})</summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-stone-200 bg-stone-50 p-2 font-mono text-[11px]">
          {state.events.slice(-100).map((ev, i) => (
            <div key={i} className="border-b border-stone-100 py-0.5">
              <span className="text-stone-400">{new Date(ev.ts).toISOString().slice(11, 23)}</span>
              {' '}<span className="text-stone-600">{ev.type}</span>
              {' '}<span className="text-stone-800">{JSON.stringify(ev).slice(0, 200)}</span>
            </div>
          ))}
        </div>
      </details>
      <div className="mt-6 flex justify-end">
        {state.jobStatus === 'running' && (
          <button type="button" onClick={onCancel} disabled={cancelling}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50">
            {cancelling ? 'Annulation…' : 'Annuler le reset'}
          </button>
        )}
      </div>
    </div>
  );
}
