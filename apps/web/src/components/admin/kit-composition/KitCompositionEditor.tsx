/**
 * `KitCompositionEditor` — formulaire admin pour un sous-produit de la
 * section composition `/kit`.
 *
 * Mode singleton par sous-produit (`/admin/kit/composition/[id]`). Pattern
 * identique à `KitVideoEditor` (admin/kit-video).
 *
 * Champs éditables (Phase 5) :
 *  - `narrative` (intro voix maison)
 *  - `usageHint` (mention gestuelle inline)
 *  - `accentColor` (radio sauge/petale/ciel/champagne)
 *  - `certifications[]` (label/body, add/remove, max 8)
 *  - `ingredients[]` (partial : reset au mock ou liste éditée)
 *
 * Boutons : Enregistrer (PATCH), Publier sur /kit (POST /publish),
 * Reset au mock (modale + saisie `RESET-COMPOSITION-{ID}`).
 *
 * cf. docs/ingredients-detail-optim-2026-05/06-admin-ui-ux-design.md
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

import { kitCompositionOverrideUpsertSchema } from '@/lib/kit/composition/schemas';
import type {
  KitCompositionOverride,
  KitCompositionOverridePatch,
  KitCompositionSubProductId,
} from '@/lib/kit/composition/types';
import type {
  Certification,
  SubProduct,
  SubProductAccentColor,
} from '@/lib/schemas';

const ACCENT_COLORS = ['sauge', 'petale', 'ciel', 'champagne'] as const;
type AccentColor = (typeof ACCENT_COLORS)[number];

interface KitCompositionEditorProps {
  subProductId: KitCompositionSubProductId;
  initial: KitCompositionOverride | null;
  baseSubProduct: SubProduct;
  source: 'mock' | 'override-draft' | 'override-published';
}

interface FormState {
  narrative: string;
  usageHint: string;
  accentColor: AccentColor | '';
  certifications: Certification[];
}

function fromOverride(
  o: KitCompositionOverride | null,
  base: SubProduct,
): FormState {
  return {
    narrative: o?.narrative ?? '',
    usageHint: o?.usageHint ?? '',
    accentColor: (o?.accentColor as AccentColor | undefined) ?? '',
    certifications: o?.certifications ? [...o.certifications] : [...base.certifications],
  };
}

function toPatch(
  subProductId: KitCompositionSubProductId,
  state: FormState,
): KitCompositionOverridePatch {
  return {
    subProductId,
    narrative: state.narrative.trim() === '' ? null : state.narrative.trim(),
    usageHint: state.usageHint.trim() === '' ? null : state.usageHint.trim(),
    accentColor: state.accentColor === '' ? null : state.accentColor,
    certifications:
      state.certifications.length === 0 ? null : state.certifications,
  };
}

export function KitCompositionEditor({
  subProductId,
  initial,
  baseSubProduct,
  source,
}: KitCompositionEditorProps): JSX.Element {
  const [state, setState] = useState<FormState>(() =>
    fromOverride(initial, baseSubProduct),
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<Date | null>(
    initial?.publishedAt ?? null,
  );
  const [draftedAt, setDraftedAt] = useState<Date | null>(initial?.draftedAt ?? null);

  const validation = useMemo(
    () => kitCompositionOverrideUpsertSchema.safeParse(toPatch(subProductId, state)),
    [state, subProductId],
  );
  const isValid = validation.success;
  const fieldError = useCallback(
    (path: string): string | null => {
      if (validation.success) return null;
      const issue = validation.error.issues.find((i) => i.path.join('.') === path);
      return issue?.message ?? null;
    },
    [validation],
  );

  const dirty = useMemo(
    () =>
      JSON.stringify(state) !== JSON.stringify(fromOverride(initial, baseSubProduct)),
    [state, initial, baseSubProduct],
  );

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (!isValid) {
      setError('Le formulaire contient des erreurs.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/kit/composition/${subProductId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPatch(subProductId, state)),
      });
      const body = (await res.json()) as
        | { override: KitCompositionOverride }
        | { error: { message: string } };
      if (!res.ok || !('override' in body)) {
        setError('error' in body ? body.error.message : 'Erreur serveur');
        return;
      }
      setSuccess('Brouillon enregistré');
      setPublishedAt(body.override.publishedAt);
      setDraftedAt(body.override.draftedAt);
    } catch {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  }, [isValid, state, subProductId]);

  const handlePublish = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setPublishing(true);
    try {
      const res = await fetch(
        `/api/admin/kit/composition/${subProductId}/publish`,
        { method: 'POST' },
      );
      const body = (await res.json()) as
        | { override: KitCompositionOverride }
        | { error: { message: string } };
      if (!res.ok || !('override' in body)) {
        setError('error' in body ? body.error.message : 'Erreur serveur');
        return;
      }
      setSuccess('Publié sur /kit');
      setPublishedAt(body.override.publishedAt);
      setDraftedAt(body.override.draftedAt);
    } catch {
      setError('Erreur réseau');
    } finally {
      setPublishing(false);
    }
  }, [subProductId]);

  const resetMagicWord = `RESET-COMPOSITION-${subProductId.toUpperCase()}`;

  const handleReset = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (resetInput !== resetMagicWord) {
      setError(`Tapez exactement ${resetMagicWord} pour confirmer.`);
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/kit/composition/${subProductId}/reset`, {
        method: 'POST',
      });
      if (!res.ok) {
        setError('Erreur lors du reset');
        return;
      }
      setSuccess('Override supprimé, retour au mock');
      setState(fromOverride(null, baseSubProduct));
      setPublishedAt(null);
      setDraftedAt(null);
      setResetOpen(false);
      setResetInput('');
    } catch {
      setError('Erreur réseau');
    } finally {
      setResetting(false);
    }
  }, [baseSubProduct, resetInput, resetMagicWord, subProductId]);

  return (
    <form
      data-testid="kit-composition-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-8"
    >
      <header className="rounded-md border border-encre/10 bg-creme-warm/40 p-4 text-sm">
        <p>
          <strong>Sous-produit :</strong> {baseSubProduct.name} —{' '}
          {baseSubProduct.volume}
        </p>
        <p>
          <strong>Statut :</strong>{' '}
          <span data-testid="kit-composition-status">
            {source === 'override-published' && !draftedAt
              ? 'Publié'
              : source === 'mock'
                ? 'Mock par défaut'
                : 'Brouillon'}
          </span>
        </p>
        {publishedAt ? (
          <p className="text-xs text-encre/60">
            Publié le {new Date(publishedAt).toLocaleString('fr-FR')}
          </p>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          data-testid="kit-composition-error"
          className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          data-testid="kit-composition-success"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {success}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg">Identité éditoriale</h2>
        <label className="block text-sm">
          Mention gestuelle (« usageHint », clausule inline dans le titre)
          <input
            type="text"
            value={state.usageHint}
            onChange={(e) => setState({ ...state, usageHint: e.target.value })}
            placeholder="une noisette filme dix doigts"
            maxLength={60}
            className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 text-sm"
          />
          {fieldError('usageHint') ? (
            <span
              className="mt-1 block text-xs text-rose-700"
              data-testid="error-usageHint"
            >
              {fieldError('usageHint')}
            </span>
          ) : null}
        </label>

        <label className="block text-sm">
          Intro narrative (italique sous le titre, voix maison)
          <textarea
            value={state.narrative}
            onChange={(e) => setState({ ...state, narrative: e.target.value })}
            placeholder="12 % de cire fondue à basse température…"
            rows={3}
            maxLength={320}
            className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-encre/60">
            Doit se terminer par . ! ? ou ». Max 320 caractères.
          </span>
          {fieldError('narrative') ? (
            <span
              className="mt-1 block text-xs text-rose-700"
              data-testid="error-narrative"
            >
              {fieldError('narrative')}
            </span>
          ) : null}
        </label>

        <fieldset className="block text-sm">
          <legend>Couleur d'accent</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {ACCENT_COLORS.map((c) => (
              <label key={c} className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="accentColor"
                  value={c}
                  checked={state.accentColor === c}
                  onChange={() => setState({ ...state, accentColor: c })}
                />
                <span className="capitalize">{c}</span>
              </label>
            ))}
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="accentColor"
                value=""
                checked={state.accentColor === ''}
                onChange={() => setState({ ...state, accentColor: '' })}
              />
              <span className="text-encre/60">Aucune (mock)</span>
            </label>
          </div>
        </fieldset>
      </section>

      <section className="space-y-3" data-testid="kit-composition-certifications">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">
            Certifications ({state.certifications.length})
          </h2>
          <button
            type="button"
            onClick={() =>
              setState({
                ...state,
                certifications: [
                  ...state.certifications,
                  { label: '', body: '' },
                ],
              })
            }
            disabled={state.certifications.length >= 8}
            className="rounded-md border border-encre/20 px-2 py-1 text-xs disabled:opacity-40"
            data-testid="kit-composition-cert-add"
          >
            + Ajouter
          </button>
        </div>
        <ul className="space-y-2">
          {state.certifications.map((cert, i) => (
            <li
              key={i}
              data-testid={`kit-composition-cert-${i}`}
              className="grid grid-cols-[1fr_1fr_40px] gap-2 items-center rounded-md border border-encre/10 bg-creme-warm/30 p-2 text-sm"
            >
              <input
                type="text"
                value={cert.label}
                onChange={(e) => {
                  const next = [...state.certifications];
                  next[i] = { ...next[i]!, label: e.target.value };
                  setState({ ...state, certifications: next });
                }}
                placeholder="Label (ex. Cosmos Organic)"
                maxLength={60}
                className="rounded border border-encre/20 px-2 py-1"
                aria-label={`Label certification ${i + 1}`}
              />
              <input
                type="text"
                value={cert.body}
                onChange={(e) => {
                  const next = [...state.certifications];
                  next[i] = { ...next[i]!, body: e.target.value };
                  setState({ ...state, certifications: next });
                }}
                placeholder="Body (ex. Ecocert)"
                maxLength={60}
                className="rounded border border-encre/20 px-2 py-1"
                aria-label={`Body certification ${i + 1}`}
              />
              <button
                type="button"
                onClick={() =>
                  setState({
                    ...state,
                    certifications: state.certifications.filter(
                      (_, j) => j !== i,
                    ),
                  })
                }
                aria-label={`Supprimer la certification ${i + 1}`}
                className="rounded border border-encre/20 px-2 py-1 text-xs"
                data-testid={`kit-composition-cert-remove-${i}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center gap-3 border-t border-encre/10 pt-4">
        <button
          type="submit"
          disabled={!dirty || !isValid || saving}
          data-testid="kit-composition-save"
          className="rounded-md bg-encre px-4 py-2 text-sm font-medium text-creme disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={dirty || publishing || source === 'mock'}
          data-testid="kit-composition-publish"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-creme disabled:opacity-40"
        >
          {publishing ? 'Publication…' : 'Publier sur /kit'}
        </button>
        <button
          type="button"
          onClick={() => setResetOpen((v) => !v)}
          data-testid="kit-composition-reset-open"
          className="ml-auto rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700"
        >
          Reset au mock…
        </button>
      </footer>

      {resetOpen ? (
        <div
          data-testid="kit-composition-reset-dialog"
          className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm"
        >
          <p>
            Cette action supprime l'override et fait retomber `/kit` sur le mock
            pour ce sous-produit. Tape{' '}
            <code className="font-mono">{resetMagicWord}</code> pour confirmer.
          </p>
          <input
            type="text"
            value={resetInput}
            onChange={(e) => setResetInput(e.target.value)}
            className="mt-2 block w-full max-w-md rounded border border-encre/20 px-2 py-1"
            data-testid="kit-composition-reset-input"
            aria-label="Confirmation reset"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={resetInput !== resetMagicWord || resetting}
              data-testid="kit-composition-reset-confirm"
              className="rounded bg-rose-700 px-3 py-1 text-creme disabled:opacity-40"
            >
              {resetting ? 'Reset…' : 'Confirmer reset'}
            </button>
            <button
              type="button"
              onClick={() => {
                setResetOpen(false);
                setResetInput('');
              }}
              className="rounded border border-encre/20 px-3 py-1"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
