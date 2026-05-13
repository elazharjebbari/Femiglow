'use client';
import type { Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';
import { DOMAIN_LABELS } from '../types';
import type { ResetDomain } from '@/lib/reset/types';

const DOMAINS: ResetDomain[] = ['commerce', 'content', 'tracking', 'chat', 'system'];

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

export function StepCustomOptions({ state, dispatch }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Domaines à reset</h2>
      <p className="mt-1 text-sm text-stone-600">TRUNCATE puis re-seed pour les domaines cochés.</p>
      <ul className="mt-4 space-y-2">
        {DOMAINS.map((d) => {
          const checked = state.domains.includes(d);
          return (
            <li key={d}>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-200 bg-white p-3 hover:border-stone-400">
                <input type="checkbox" checked={checked}
                  onChange={() => dispatch({ type: 'TOGGLE_DOMAIN', domain: d })}
                  className="mt-0.5" />
                <span className="text-sm text-stone-700">{DOMAIN_LABELS[d]}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid gap-2 text-sm text-stone-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.wipeMedia}
            onChange={(e) => dispatch({ type: 'SET_WIPE_MEDIA', v: e.target.checked })} />
          Wipe médias (.media-storage)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.wipeNextCache}
            onChange={(e) => dispatch({ type: 'SET_WIPE_CACHE', v: e.target.checked })} />
          Wipe cache .next
        </label>
      </div>
      <div className="mt-6 flex justify-between">
        <button type="button" onClick={() => dispatch({ type: 'BACK' })}
          className="text-sm text-stone-600 hover:underline">← Retour</button>
        <button type="button" onClick={() => dispatch({ type: 'NEXT' })} disabled={state.domains.length === 0}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:bg-stone-300">
          Suivant →
        </button>
      </div>
    </div>
  );
}
