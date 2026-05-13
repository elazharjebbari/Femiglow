'use client';
import type { Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';
import type { ResetMode } from '@/lib/reset/types';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

const MODES: Array<{ id: ResetMode; label: string; eta: string; description: string; recommended?: boolean }> = [
  { id: 'soft',   label: 'SOFT',   eta: '~10 s',  recommended: true,
    description: 'Re-run des 16 seeders (upsert). Pas de destructif. Idéal pour corriger une donnée stale.' },
  { id: 'medium', label: 'MEDIUM', eta: '~30 s',
    description: 'TRUNCATE catalogue + CMS + SEO, puis re-seed. Préserve médias, users, orders.' },
  { id: 'hard',   label: 'HARD',   eta: '~90 s',
    description: 'DROP SCHEMA, wipe médias, rebuild depuis migrations. Préserve uniquement admin_users + audit_events.' },
  { id: 'custom', label: 'CUSTOM', eta: 'variable',
    description: 'Choisir domaine par domaine.' },
];

export function StepMode({ state, dispatch }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Quel niveau de reset&nbsp;?</h2>
      <div className="mt-4 grid gap-3">
        {MODES.map((m) => {
          const checked = state.mode === m.id;
          return (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition ${
                checked ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900' : 'border-stone-200 bg-white hover:border-stone-400'
              }`}
            >
              <input
                type="radio"
                name="reset-mode"
                value={m.id}
                checked={checked}
                onChange={() => dispatch({ type: 'SET_MODE', mode: m.id })}
                className="mt-1"
                aria-describedby={`mode-${m.id}-desc`}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold tracking-tight text-stone-900">{m.label}</span>
                  <span className="text-xs uppercase tracking-wide text-stone-500">
                    {m.eta}{m.recommended ? ' · recommandé' : ''}
                  </span>
                </div>
                <p id={`mode-${m.id}-desc`} className="mt-1 text-sm text-stone-600">{m.description}</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between">
        <button type="button" onClick={() => dispatch({ type: 'BACK' })}
          className="text-sm text-stone-600 hover:underline">← Retour</button>
        <button type="button" onClick={() => dispatch({ type: 'NEXT' })} disabled={!state.mode}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300">
          Suivant →
        </button>
      </div>
    </div>
  );
}
