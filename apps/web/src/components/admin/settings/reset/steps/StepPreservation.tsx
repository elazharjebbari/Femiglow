'use client';
import type { Dispatch } from 'react';
import type { WizardState } from '../types';
import type { WizardAction } from '../reducer';
import type { PreservableTable } from '@/lib/reset/types';
import { ALWAYS_PRESERVED } from '../types';

interface Props { state: WizardState; dispatch: Dispatch<WizardAction>; }

const GROUPS: Array<{ label: string; tables: PreservableTable[] }> = [
  { label: 'Système (toujours préservé)', tables: ['admin_users', 'audit_events'] },
  { label: 'Données utilisateurs', tables: ['orders', 'order_items', 'leads', 'lead_events', 'chat_lead', 'ritual_testimonials', 'ritual_testimonial_photos', 'ritual_audit_log'] },
];

export function StepPreservation({ state, dispatch }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-stone-900">Que veux-tu PRÉSERVER&nbsp;?</h2>
      <p className="mt-1 text-sm text-stone-600">Décoche pour autoriser le wipe.</p>
      <div className="mt-4 space-y-4">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <h3 className="text-sm font-medium text-stone-700">{g.label}</h3>
            <ul className="mt-2 space-y-1">
              {g.tables.map((t) => {
                const isAlways = (ALWAYS_PRESERVED as string[]).includes(t);
                const checked = state.preserve.includes(t);
                return (
                  <li key={t}>
                    <label className={`flex items-center gap-2 rounded p-2 text-sm ${isAlways ? 'text-stone-500' : 'text-stone-800 hover:bg-stone-50'}`}>
                      <input type="checkbox" checked={checked} disabled={isAlways}
                        onChange={() => dispatch({ type: 'TOGGLE_PRESERVE', table: t })} />
                      <code className="font-mono text-xs">{t}</code>
                      {isAlways && <span className="text-xs text-stone-400">(verrouillé)</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-between">
        <button type="button" onClick={() => dispatch({ type: 'BACK' })}
          className="text-sm text-stone-600 hover:underline">← Retour</button>
        <button type="button" onClick={() => dispatch({ type: 'NEXT' })}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
          Suivant →
        </button>
      </div>
    </div>
  );
}
