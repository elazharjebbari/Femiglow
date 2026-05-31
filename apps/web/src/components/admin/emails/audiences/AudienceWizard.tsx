'use client';

/**
 * AudienceWizard — 3 steps : Métadonnées / Critères / Récap (M5.3.8).
 *
 * Pattern useReducer pour le state, persistance en sessionStorage pour
 * recover si l'admin reload. Submit POST /api/admin/emails/audiences à
 * la fin → redirect /admin/emails/audiences/[id].
 */
import { useReducer } from 'react';
import { useRouter } from 'next/navigation';
import type { ExclusionFlags, RulesGroup } from '@/lib/mail/audiences/rules-types';
import { AudienceRulesBuilder } from './AudienceRulesBuilder';
import { AudiencePreview } from './AudiencePreview';

type State = {
  step: number;
  slug: string;
  name: string;
  description: string;
  rules: RulesGroup;
  exclusionFlags: ExclusionFlags;
  evaluationMode: 'static' | 'dynamic';
  errors: Record<string, string>;
  submitting: boolean;
  submitError: string | null;
};

type Action =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET'; field: keyof State; value: unknown }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'SET_ERRORS'; errors: Record<string, string> };

const initialState: State = {
  step: 1,
  slug: '',
  name: '',
  description: '',
  rules: { kind: 'all', conditions: [] },
  exclusionFlags: {
    hard_bounce: true,
    unsubscribe: true,
    manual_suppression: true,
    marketing_optout: false,
  },
  evaluationMode: 'dynamic',
  errors: {},
  submitting: false,
  submitError: null,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT':
      return { ...state, step: Math.min(state.step + 1, 3), errors: {} };
    case 'PREV':
      return { ...state, step: Math.max(state.step - 1, 1), errors: {} };
    case 'SET': {
      const next = { ...state, [action.field]: action.value };
      // Auto-slug from name on step 1 (until user manually edits slug)
      if (action.field === 'name' && state.slug === slugify(state.name)) {
        next.slug = slugify(String(action.value));
      }
      return next;
    }
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SUBMIT_START':
      return { ...state, submitting: true, submitError: null };
    case 'SUBMIT_ERROR':
      return { ...state, submitting: false, submitError: action.error };
  }
}

export function AudienceWizard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};
    if (state.name.trim().length < 2) errors.name = 'Au moins 2 caractères';
    if (!/^[a-z][a-z0-9-]+$/.test(state.slug)) errors.slug = 'Slug invalide (kebab-case)';
    dispatch({ type: 'SET_ERRORS', errors });
    return Object.keys(errors).length === 0;
  }

  function validateStep2(): boolean {
    if (state.rules.conditions.length === 0) {
      dispatch({ type: 'SET_ERRORS', errors: { rules: 'Ajoute au moins un critère' } });
      return false;
    }
    dispatch({ type: 'SET_ERRORS', errors: {} });
    return true;
  }

  async function handleSubmit() {
    dispatch({ type: 'SUBMIT_START' });
    try {
      const res = await fetch('/api/admin/emails/audiences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: state.slug,
          name: state.name,
          description: state.description || undefined,
          rules: state.rules,
          exclusionFlags: state.exclusionFlags,
          evaluationMode: state.evaluationMode,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const created = (await res.json()) as { id: string };
      router.push(`/admin/emails/audiences/${created.id}`);
    } catch (err) {
      dispatch({ type: 'SUBMIT_ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div data-testid="audience-wizard" className="max-w-3xl">
      {/* Step indicator */}
      <ol className="mb-6 flex items-center gap-2 text-xs">
        {[1, 2, 3].map((s) => (
          <li
            key={s}
            data-testid={`step-${s}`}
            className={`flex items-center gap-2 rounded px-2 py-1 ${
              state.step === s ? 'bg-stone-900 text-white' : 'text-stone-500'
            }`}
          >
            <span>{s}</span>
            <span>{['Métadonnées', 'Critères', 'Récap'][s - 1]}</span>
          </li>
        ))}
      </ol>

      {/* Step 1 — Métadonnées */}
      {state.step === 1 && (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-700">
              Nom *
            </label>
            <input
              id="name"
              type="text"
              value={state.name}
              onChange={(e) => dispatch({ type: 'SET', field: 'name', value: e.target.value })}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              data-testid="name-input"
            />
            {state.errors.name && (
              <p className="mt-1 text-xs text-red-600">{state.errors.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-stone-700">
              Slug
            </label>
            <input
              id="slug"
              type="text"
              value={state.slug}
              onChange={(e) =>
                dispatch({ type: 'SET', field: 'slug', value: slugify(e.target.value) })
              }
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
              data-testid="slug-input"
            />
            {state.errors.slug && (
              <p className="mt-1 text-xs text-red-600">{state.errors.slug}</p>
            )}
            <p className="mt-1 text-xs text-stone-500">
              ℹ Auto-généré depuis le nom. Immutable après création.
            </p>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-stone-700">
              Description
            </label>
            <textarea
              id="description"
              value={state.description}
              onChange={(e) =>
                dispatch({ type: 'SET', field: 'description', value: e.target.value })
              }
              rows={2}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Step 2 — Critères */}
      {state.step === 2 && (
        <div className="space-y-4">
          <AudienceRulesBuilder
            value={state.rules}
            onChange={(rules) => dispatch({ type: 'SET', field: 'rules', value: rules })}
          />
          {state.errors.rules && (
            <p className="text-sm text-red-600" data-testid="rules-error">
              {state.errors.rules}
            </p>
          )}
          <AudiencePreview rules={state.rules} exclusionFlags={state.exclusionFlags} />
        </div>
      )}

      {/* Step 3 — Récap */}
      {state.step === 3 && (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-stone-900">Récapitulatif</h3>
          <dl className="text-sm">
            <div className="flex gap-2 py-1">
              <dt className="w-32 text-stone-500">Nom</dt>
              <dd className="text-stone-900">{state.name}</dd>
            </div>
            <div className="flex gap-2 py-1">
              <dt className="w-32 text-stone-500">Slug</dt>
              <dd className="font-mono text-stone-900">{state.slug}</dd>
            </div>
            {state.description && (
              <div className="flex gap-2 py-1">
                <dt className="w-32 text-stone-500">Description</dt>
                <dd className="text-stone-700">{state.description}</dd>
              </div>
            )}
            <div className="flex gap-2 py-1">
              <dt className="w-32 text-stone-500">Critères</dt>
              <dd className="text-stone-700">
                {state.rules.conditions.length} critère{state.rules.conditions.length > 1 ? 's' : ''} (
                {state.rules.kind === 'all' ? 'tous' : 'au moins un'})
              </dd>
            </div>
          </dl>

          <fieldset className="mt-4 rounded border border-stone-200 p-3">
            <legend className="px-2 text-sm font-medium text-stone-700">
              Comportement à l&apos;envoi
            </legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="evalMode"
                checked={state.evaluationMode === 'dynamic'}
                onChange={() =>
                  dispatch({ type: 'SET', field: 'evaluationMode', value: 'dynamic' })
                }
              />
              Re-évaluer au moment de l&apos;envoi (recommandé)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="evalMode"
                checked={state.evaluationMode === 'static'}
                onChange={() =>
                  dispatch({ type: 'SET', field: 'evaluationMode', value: 'static' })
                }
              />
              Figer la liste maintenant (snapshot statique)
            </label>
          </fieldset>

          {state.submitError && (
            <p className="text-sm text-red-700" role="alert" data-testid="submit-error">
              Erreur : {state.submitError}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => dispatch({ type: 'PREV' })}
          disabled={state.step === 1 || state.submitting}
          data-testid="prev-btn"
          className="rounded px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-30"
        >
          ← Retour
        </button>
        {state.step < 3 && (
          <button
            type="button"
            onClick={() => {
              if (state.step === 1 && !validateStep1()) return;
              if (state.step === 2 && !validateStep2()) return;
              dispatch({ type: 'NEXT' });
            }}
            data-testid="next-btn"
            className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Continuer →
          </button>
        )}
        {state.step === 3 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={state.submitting}
            data-testid="submit-btn"
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {state.submitting ? 'Création…' : '✓ Créer l\'audience'}
          </button>
        )}
      </div>
    </div>
  );
}
