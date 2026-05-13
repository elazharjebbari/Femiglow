'use client';

import { useEffect, useReducer, useRef } from 'react';
import { reducer, initialState } from './reducer';
import { StepWelcome } from './steps/StepWelcome';
import { StepMode } from './steps/StepMode';
import { StepCustomOptions } from './steps/StepCustomOptions';
import { StepPreservation } from './steps/StepPreservation';
import { StepPreview } from './steps/StepPreview';
import { StepConfirm } from './steps/StepConfirm';
import { StepExecute } from './steps/StepExecute';
import { StepReport } from './steps/StepReport';
import type { ResetEvent } from '@/lib/reset/types';

export function ResetWizard() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const esRef = useRef<EventSource | null>(null);

  // SSE attach when jobId set
  useEffect(() => {
    if (!state.jobId) return;
    const es = new EventSource(`/api/admin/reset/jobs/${state.jobId}/stream`);
    esRef.current = es;
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ResetEvent;
        dispatch({ type: 'EVENT', event: data });
      } catch { /* swallow */ }
    };
    const types: Array<ResetEvent['type']> = [
      'job.start', 'phase.start', 'phase.progress', 'phase.complete', 'phase.error',
      'rollback.start', 'rollback.progress', 'rollback.complete', 'rollback.failed',
      'job.complete', 'job.failed', 'job.cancelled',
    ];
    for (const t of types) es.addEventListener(t, handler as EventListener);
    es.addEventListener('done', () => { es.close(); });
    es.onerror = () => { /* keep open: EventSource auto-reconnects */ };
    return () => { es.close(); esRef.current = null; };
  }, [state.jobId]);

  const stepIndex = ['welcome', 'mode', 'custom', 'preservation', 'preview', 'confirm', 'execute', 'report'].indexOf(state.step);
  const visibleSteps = state.mode === 'custom' ? 8 : 7;
  const displayedIndex = state.mode === 'custom' ? stepIndex + 1 : stepIndex + 1 - (stepIndex >= 2 ? 1 : 0);

  return (
    <div className="max-w-3xl">
      <ol
        aria-label="Étapes du wizard"
        className="mb-6 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500"
      >
        <li className={state.step === 'welcome' ? 'font-semibold text-stone-900' : ''}>Bienvenue</li>
        <li>·</li>
        <li className={state.step === 'mode' ? 'font-semibold text-stone-900' : ''}>Mode</li>
        {state.mode === 'custom' && (<><li>·</li><li className={state.step === 'custom' ? 'font-semibold text-stone-900' : ''}>Options</li></>)}
        <li>·</li>
        <li className={state.step === 'preservation' ? 'font-semibold text-stone-900' : ''}>Préserver</li>
        <li>·</li>
        <li className={state.step === 'preview' ? 'font-semibold text-stone-900' : ''}>Aperçu</li>
        <li>·</li>
        <li className={state.step === 'confirm' ? 'font-semibold text-stone-900' : ''}>Confirmer</li>
        <li>·</li>
        <li className={state.step === 'execute' ? 'font-semibold text-stone-900' : ''}>Exécution</li>
        <li>·</li>
        <li className={state.step === 'report' ? 'font-semibold text-stone-900' : ''}>Rapport</li>
        <li className="ml-auto">Étape {displayedIndex}/{visibleSteps}</li>
      </ol>

      <div className="rounded-md border border-stone-200 bg-white p-6 shadow-sm">
        {state.step === 'welcome'      && <StepWelcome      state={state} dispatch={dispatch} />}
        {state.step === 'mode'         && <StepMode         state={state} dispatch={dispatch} />}
        {state.step === 'custom'       && <StepCustomOptions state={state} dispatch={dispatch} />}
        {state.step === 'preservation' && <StepPreservation state={state} dispatch={dispatch} />}
        {state.step === 'preview'      && <StepPreview      state={state} dispatch={dispatch} />}
        {state.step === 'confirm'      && <StepConfirm      state={state} dispatch={dispatch} />}
        {state.step === 'execute'      && <StepExecute      state={state} dispatch={dispatch} />}
        {state.step === 'report'       && <StepReport       state={state} dispatch={dispatch} />}
      </div>
    </div>
  );
}
