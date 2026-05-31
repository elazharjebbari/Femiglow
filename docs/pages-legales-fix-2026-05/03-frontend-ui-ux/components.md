# Composants — code complet

## 1. `<CreateVarForm />` (nouveau)

**Fichier** : `apps/web/src/components/admin/legal/CreateVarForm.tsx`

```tsx
'use client';
/**
 * LEGAL-V2 — Formulaire de création d'une nouvelle variable template.
 *
 * UX :
 *  - Validation inline du format KEY (UPPER_SNAKE_CASE)
 *  - Suggestions cliquables (vars utilisées sans définition)
 *  - Toast/status après création
 *  - Revalidate côté server après success
 *
 * Cf. docs/pages-legales-fix-2026-05/03-frontend-ui-ux/components.md
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateVarFormProps {
  /** Suggestions cliquables (vars utilisées sans définition DB). */
  suggestions?: string[];
}

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function CreateVarForm({ suggestions = [] }: CreateVarFormProps): JSX.Element {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const keyValid = KEY_PATTERN.test(key);
  const canSubmit = keyValid && label.length > 0 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/legal/template-vars', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key,
          label,
          description: description || undefined,
          value: value || '',
          isRequired,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'Erreur');
      setSuccess(true);
      setKey('');
      setLabel('');
      setDescription('');
      setValue('');
      setIsRequired(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-stone-700">
            Clé (UPPER_SNAKE_CASE)
          </span>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="MY_NEW_VAR"
            required
            aria-invalid={key.length > 0 && !keyValid}
            className={`mt-1 w-full rounded-md border px-3 py-1.5 font-mono text-sm ${
              key.length > 0 && !keyValid
                ? 'border-rose-400 focus:ring-rose-400'
                : 'border-stone-300 focus:ring-stone-500'
            }`}
          />
          {key.length > 0 && !keyValid && (
            <p className="mt-1 text-xs text-rose-600">
              Format : majuscules + chiffres + _, commence par une lettre
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-stone-700">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé affiché"
            required
            maxLength={100}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-stone-700">
          Description <span className="text-stone-500">(optionnel)</span>
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Aide affichée à l'admin"
          maxLength={500}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-stone-700">
          Valeur par défaut <span className="text-stone-500">(optionnel)</span>
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="h-4 w-4"
        />
        Variable requise (bloque le publish si vide)
      </label>

      {suggestions.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            💡 Suggestions (vars utilisées dans des pages sans définition) :
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setKey(s)}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-mono text-amber-900 hover:bg-amber-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      {success && (
        <div role="status" aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ Variable créée. Disponible dans la liste ci-dessous.
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? 'Création…' : '+ Créer la variable'}
        </button>
      </div>
    </form>
  );
}
```

## 2. `<CleanupE2EButton />` (optionnel — page audit)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CleanupE2EButton(): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<'idle' | 'confirming' | 'done'>('idle');
  const [candidates, setCandidates] = useState(0);
  const [deleted, setDeleted] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function call(dryRun: boolean) {
    const res = await fetch('/api/admin/legal/cleanup-e2e', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun, olderThanDays: 7 }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? 'Erreur');
    return json;
  }

  async function handlePreview() {
    setError(null);
    try {
      const r = await call(true);
      setCandidates(r.candidates);
      setStep('confirming');
    } catch (e) { setError((e as Error).message); }
  }

  async function handleConfirm() {
    setError(null);
    try {
      const r = await call(false);
      setDeleted(r.deleted);
      setStep('done');
      router.refresh();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <h3 className="text-sm font-medium">Cleanup pages E2E orphelines</h3>
      <p className="mt-1 text-xs text-stone-600">
        Supprime les pages `e2e-test-*` en draft de plus de 7 jours.
      </p>
      {error && <div role="alert" className="mt-2 text-sm text-rose-700">{error}</div>}
      {step === 'idle' && (
        <button onClick={handlePreview} className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
          Prévisualiser
        </button>
      )}
      {step === 'confirming' && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            {candidates} page(s) seront supprimées définitivement.
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={handleConfirm} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white">
              Confirmer suppression
            </button>
            <button onClick={() => setStep('idle')} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm">
              Annuler
            </button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div role="status" aria-live="polite" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ {deleted} page(s) supprimée(s).
        </div>
      )}
    </div>
  );
}
```

## 3. Tests composants

```tsx
// CreateVarForm.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateVarForm } from './CreateVarForm';

describe('<CreateVarForm />', () => {
  it('rend les champs requis', () => {
    render(<CreateVarForm />);
    expect(screen.getByPlaceholderText(/MY_NEW_VAR/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Libellé affiché/i)).toBeInTheDocument();
  });

  it('valide format KEY UPPER_SNAKE_CASE', () => {
    render(<CreateVarForm />);
    const keyInput = screen.getByPlaceholderText(/MY_NEW_VAR/i);
    fireEvent.change(keyInput, { target: { value: 'invalid-key' } });
    expect(screen.getByText(/Format/i)).toBeInTheDocument();
  });

  it('affiche les suggestions', () => {
    render(<CreateVarForm suggestions={['CURRENCY', 'SUPPORT_HOURS']} />);
    expect(screen.getByText('CURRENCY')).toBeInTheDocument();
    expect(screen.getByText('SUPPORT_HOURS')).toBeInTheDocument();
  });

  it('remplit KEY au click suggestion', () => {
    render(<CreateVarForm suggestions={['CURRENCY']} />);
    fireEvent.click(screen.getByText('CURRENCY'));
    expect((screen.getByPlaceholderText(/MY_NEW_VAR/i) as HTMLInputElement).value).toBe('CURRENCY');
  });
});
```
