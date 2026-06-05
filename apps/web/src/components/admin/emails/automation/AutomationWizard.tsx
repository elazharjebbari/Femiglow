'use client';

/**
 * AutomationWizard — 4-step wizard pour créer/éditer une automation.
 *
 *  1. Identité   (slug, name, trigger)
 *  2. Étapes     (StepList)
 *  3. Fréquence  (FrequencySettings)
 *  4. Revue      (récap + activer + submit)
 */
import { useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AutomationStep } from '@/lib/mail/automation/step-types-v2';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';
import { StepList } from './StepList';
import { FrequencySettings, type FrequencyValue } from './FrequencySettings';
import { stepLabel } from './step-defaults';

type WizardState = {
  step: 0 | 1 | 2 | 3;
  id?: string;
  slug: string;
  name: string;
  triggerType: 'event' | 'schedule' | 'subscription' | 'webhook';
  triggerConfig: Record<string, unknown>;
  triggerConditions: RulesGroup | null;
  steps: AutomationStep[];
  frequency: FrequencyValue;
  active: boolean;
};

type Action =
  | { type: 'goto'; step: WizardState['step'] }
  | { type: 'patch'; patch: Partial<WizardState> };

function reducer(s: WizardState, a: Action): WizardState {
  if (a.type === 'goto') return { ...s, step: a.step };
  if (a.type === 'patch') return { ...s, ...a.patch };
  return s;
}

const DEFAULT_STATE: WizardState = {
  step: 0,
  slug: '',
  name: '',
  triggerType: 'event',
  triggerConfig: {},
  triggerConditions: null,
  steps: [],
  frequency: {
    cooldownSeconds: 0,
    quietHoursEnabled: true,
    quietHoursStart: '08:00',
    quietHoursEnd: '22:00',
    quietHoursTz: 'Africa/Casablanca',
    dailyCap: null,
  },
  active: false,
};

export type AutomationWizardProps = {
  initial?: Partial<WizardState>;
  eventsCatalog?: Array<{ name: string; category: string; description: string }>;
  onSubmit: (state: Omit<WizardState, 'step'>) => Promise<{ id: string } | void>;
  submitLabel?: string;
};

export function AutomationWizard({
  initial,
  eventsCatalog = [],
  onSubmit,
  submitLabel = 'Créer l\'automation',
}: AutomationWizardProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, { ...DEFAULT_STATE, ...(initial ?? {}) });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le déclencheur `event`/`subscription` est piloté par le scan d'events du
  // dispatcher, qui lit `triggerConfig.eventName`. Sans ce champ l'automation
  // est INERTE (le dispatcher logue `missing_event_name`). Le wizard DOIT donc
  // exiger un eventName pour ces deux types — sinon il enregistre une promesse
  // que le moteur ne peut pas tenir.
  const triggerNeedsEvent = state.triggerType === 'event' || state.triggerType === 'subscription';
  const triggerEventName =
    typeof state.triggerConfig.eventName === 'string' ? state.triggerConfig.eventName : '';

  // Un step `send` sans template ne peut pas être persisté (schéma moteur :
  // template min(1)) ni envoyé par le runner — on bloque AVANT la revue avec
  // un message, plutôt que de laisser échouer la soumission.
  const sendWithoutTemplate = state.steps.some(
    (s) => s.kind === 'send' && (!s.template || s.template.trim().length === 0),
  );

  const canNext = (() => {
    if (state.step === 0) {
      const idOk = /^[a-z0-9][a-z0-9-]*$/.test(state.slug) && state.name.trim().length >= 1;
      if (!idOk) return false;
      if (triggerNeedsEvent && triggerEventName.trim().length === 0) return false;
      return true;
    }
    if (state.step === 1) {
      if (state.steps.length < 1) return false;
      if (sendWithoutTemplate) return false;
      return true;
    }
    return true;
  })();

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await onSubmit({
        id: state.id,
        slug: state.slug,
        name: state.name,
        triggerType: state.triggerType,
        triggerConfig: state.triggerConfig,
        triggerConditions: state.triggerConditions,
        steps: state.steps,
        frequency: state.frequency,
        active: state.active,
      });
      if (r && 'id' in r) router.push(`/admin/emails/automation/${r.id}/edit`);
      else router.push('/admin/emails/automation');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs">
        {['Identité', 'Étapes', 'Fréquence', 'Revue'].map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 rounded px-3 py-1 ${
              i === state.step
                ? 'bg-stone-900 text-white'
                : i < state.step
                ? 'bg-stone-200 text-stone-700'
                : 'bg-stone-100 text-stone-400'
            }`}
          >
            <span>{i + 1}.</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {/* Step 0 — Identité */}
      {state.step === 0 && (
        <section className="space-y-4 rounded border border-stone-200 bg-white p-6">
          <div>
            <label className="block text-sm font-medium text-stone-700">Nom</label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => dispatch({ type: 'patch', patch: { name: e.target.value } })}
              placeholder="Bienvenue + relance J+3"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Slug</label>
            <input
              type="text"
              value={state.slug}
              onChange={(e) =>
                dispatch({
                  type: 'patch',
                  patch: { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') },
                })
              }
              placeholder="welcome-flow"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
              disabled={Boolean(state.id)}
            />
            <p className="mt-1 text-xs text-stone-500">
              kebab-case. Immuable après création (sert d'idempotency key).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Déclencheur</label>
            <select
              value={state.triggerType}
              onChange={(e) =>
                dispatch({
                  type: 'patch',
                  patch: { triggerType: e.target.value as WizardState['triggerType'] },
                })
              }
              className="mt-1 rounded border border-stone-300 px-3 py-1.5 text-sm"
            >
              <option value="event">Événement utilisateur (user_event)</option>
              <option value="schedule">Récurrent (cron)</option>
              <option value="subscription">Inscription liste</option>
              <option value="webhook">Webhook externe</option>
            </select>
          </div>
          {triggerNeedsEvent && (
            <div>
              <label htmlFor="trigger-event-name" className="block text-sm font-medium text-stone-700">
                Événement déclencheur
              </label>
              <select
                id="trigger-event-name"
                value={triggerEventName}
                onChange={(e) =>
                  dispatch({
                    type: 'patch',
                    patch: {
                      triggerConfig: { ...state.triggerConfig, eventName: e.target.value },
                    },
                  })
                }
                className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
              >
                <option value="">— Choisir un événement —</option>
                {eventsCatalog.map((ev) => (
                  <option key={ev.name} value={ev.name}>
                    {ev.name} — {ev.description}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-stone-500">
                Le moteur enrôle un destinataire quand cet événement est émis. Obligatoire — sans
                lui l'automation reste inerte.
              </p>
              {triggerEventName.trim().length === 0 && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  Sélectionnez l'événement qui déclenche cette automation.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Step 1 — Étapes */}
      {state.step === 1 && (
        <section className="space-y-4 rounded border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-medium text-stone-700">Étapes de l'automation</h2>
          <StepList
            steps={state.steps}
            onChange={(steps) => dispatch({ type: 'patch', patch: { steps } })}
            eventsCatalog={eventsCatalog}
          />
          {sendWithoutTemplate && (
            <p role="alert" className="text-xs text-red-600">
              Chaque étape « Envoyer email » doit référencer un template (slug non vide).
            </p>
          )}
        </section>
      )}

      {/* Step 2 — Fréquence */}
      {state.step === 2 && (
        <section className="space-y-4 rounded border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-medium text-stone-700">Contrôle de fréquence</h2>
          <FrequencySettings
            value={state.frequency}
            onChange={(frequency) => dispatch({ type: 'patch', patch: { frequency } })}
          />
        </section>
      )}

      {/* Step 3 — Revue */}
      {state.step === 3 && (
        <section className="space-y-4 rounded border border-stone-200 bg-white p-6">
          <h2 className="text-sm font-medium text-stone-700">Récapitulatif</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-32 text-stone-500">Nom</dt>
              <dd className="font-medium text-stone-800">{state.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 text-stone-500">Slug</dt>
              <dd className="font-mono text-xs text-stone-700">{state.slug}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 text-stone-500">Trigger</dt>
              <dd>{state.triggerType}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Étapes ({state.steps.length})</dt>
              <ol className="mt-1 list-decimal pl-6 text-stone-700">
                {state.steps.map((s, i) => (
                  <li key={i}>{stepLabel(s)}</li>
                ))}
              </ol>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 text-stone-500">Cooldown</dt>
              <dd>{state.frequency.cooldownSeconds / 60} min</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 text-stone-500">Quiet hours</dt>
              <dd>
                {state.frequency.quietHoursEnabled
                  ? `${state.frequency.quietHoursStart}–${state.frequency.quietHoursEnd} (${state.frequency.quietHoursTz})`
                  : 'désactivées'}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 text-stone-500">Daily cap</dt>
              <dd>{state.frequency.dailyCap ?? 'illimité'}</dd>
            </div>
          </dl>
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded border border-stone-200 bg-stone-50 p-3">
            <input
              type="checkbox"
              checked={state.active}
              onChange={(e) => dispatch({ type: 'patch', patch: { active: e.target.checked } })}
            />
            <span className="text-sm text-stone-700">
              Activer immédiatement après création
            </span>
          </label>
          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
        </section>
      )}

      {/* Nav buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() =>
            dispatch({ type: 'goto', step: Math.max(0, state.step - 1) as WizardState['step'] })
          }
          disabled={state.step === 0}
          className="rounded border border-stone-300 px-4 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
        >
          ← Retour
        </button>
        {state.step < 3 ? (
          <button
            type="button"
            onClick={() =>
              dispatch({ type: 'goto', step: (state.step + 1) as WizardState['step'] })
            }
            disabled={!canNext}
            className="rounded bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-40"
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? '...' : submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
