/**
 * `KitVideoEditor` — formulaire singleton pour `/admin/kit/video`.
 *
 *  - Champs : `youtubeUrl`, `provenance`, `durationDisplay`, `accentColor`,
 *    chapitres (liste {key, label, startSeconds}). `posterCustom` reporté
 *    en phase ultérieure (intégration MediaPicker).
 *  - Validation Zod live à chaque touch — erreurs affichées sous chaque champ.
 *  - Boutons : Save (PATCH), Publier (POST /publish), Reset (POST /reset
 *    avec saisie de confirmation `RESET-VIDEO`).
 *  - Pas de toast lib — feedback inline via state local (`success` / `error`).
 *
 * cf. docs/video-gestes-optim-2026-05/06-admin-ui-ux-design.md §1-3
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

import { kitVideoOverrideUpsertSchema } from '@/lib/kit/video/schemas';
import type {
  KitVideoOverride,
  KitVideoOverridePatch,
} from '@/lib/kit/video/types';
import type { VideoChapter } from '@/lib/schemas';

const ACCENT_COLORS = ['sauge', 'petale', 'ciel', 'champagne'] as const;
type AccentColor = (typeof ACCENT_COLORS)[number];

interface KitVideoEditorProps {
  initial: KitVideoOverride | null;
  /** Source résolue (pour information : « mock » / « override-draft » / « override-published »). */
  source: 'mock' | 'override-draft' | 'override-published';
}

interface FormState {
  youtubeUrl: string;
  provenance: string;
  durationDisplay: string;
  accentColor: AccentColor | '';
  chapters: VideoChapter[];
}

function fromOverride(o: KitVideoOverride | null): FormState {
  return {
    youtubeUrl: o?.youtubeUrl ?? '',
    provenance: o?.provenance ?? '',
    durationDisplay: o?.durationDisplay ?? '',
    accentColor: (o?.accentColor as AccentColor | undefined) ?? '',
    chapters: o?.chapters ? (o.chapters as VideoChapter[]).slice() : [],
  };
}

function toPatch(state: FormState): KitVideoOverridePatch {
  return {
    youtubeUrl: state.youtubeUrl.trim() === '' ? null : state.youtubeUrl.trim(),
    provenance: state.provenance.trim() === '' ? null : state.provenance.trim(),
    durationDisplay:
      state.durationDisplay.trim() === '' ? null : state.durationDisplay.trim(),
    accentColor: state.accentColor === '' ? null : state.accentColor,
    chapters: state.chapters.length === 0 ? null : state.chapters,
  };
}

export function KitVideoEditor({ initial, source }: KitVideoEditorProps): JSX.Element {
  const [state, setState] = useState<FormState>(() => fromOverride(initial));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<Date | null>(initial?.publishedAt ?? null);
  const [draftedAt, setDraftedAt] = useState<Date | null>(initial?.draftedAt ?? null);

  const validation = useMemo(
    () => kitVideoOverrideUpsertSchema.safeParse(toPatch(state)),
    [state],
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
    () => JSON.stringify(state) !== JSON.stringify(fromOverride(initial)),
    [state, initial],
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
      const res = await fetch('/api/admin/kit/video', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPatch(state)),
      });
      const body = (await res.json()) as
        | { override: KitVideoOverride }
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
  }, [isValid, state]);

  const handlePublish = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setPublishing(true);
    try {
      const res = await fetch('/api/admin/kit/video/publish', { method: 'POST' });
      const body = (await res.json()) as
        | { override: KitVideoOverride }
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
  }, []);

  const handleReset = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (resetInput !== 'RESET-VIDEO') {
      setError('Tapez exactement RESET-VIDEO pour confirmer.');
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/admin/kit/video/reset', { method: 'POST' });
      if (!res.ok) {
        setError('Erreur lors du reset');
        return;
      }
      setSuccess('Override supprimé, retour au mock');
      setState(fromOverride(null));
      setPublishedAt(null);
      setDraftedAt(null);
      setResetOpen(false);
      setResetInput('');
    } catch {
      setError('Erreur réseau');
    } finally {
      setResetting(false);
    }
  }, [resetInput]);

  const updateChapter = (index: number, patch: Partial<VideoChapter>) => {
    setState((prev) => {
      const chapters = prev.chapters.slice();
      chapters[index] = { ...chapters[index]!, ...patch };
      return { ...prev, chapters };
    });
  };

  const addChapter = () => {
    setState((prev) => {
      const last = prev.chapters[prev.chapters.length - 1];
      const next: VideoChapter = {
        key: `chapter-${prev.chapters.length + 1}`,
        label: `Chapitre ${prev.chapters.length + 1}`,
        startSeconds: (last?.startSeconds ?? 0) + 30,
      };
      return { ...prev, chapters: [...prev.chapters, next] };
    });
  };

  const removeChapter = (index: number) => {
    setState((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((_, i) => i !== index),
    }));
  };

  return (
    <form
      data-testid="kit-video-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-8"
    >
      <header className="rounded-md border border-encre/10 bg-creme-warm/40 p-4 text-sm">
        <p>
          <strong>Statut :</strong>{' '}
          <span data-testid="kit-video-status">
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
          data-testid="kit-video-error"
          className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          data-testid="kit-video-success"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {success}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg">Source vidéo</h2>
        <label className="block text-sm">
          URL YouTube
          <input
            type="url"
            value={state.youtubeUrl}
            onChange={(e) => setState({ ...state, youtubeUrl: e.target.value })}
            className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 text-sm"
            placeholder="https://youtube.com/shorts/…"
          />
          {fieldError('youtubeUrl') ? (
            <span className="mt-1 block text-xs text-rose-700" data-testid="error-youtubeUrl">
              {fieldError('youtubeUrl')}
            </span>
          ) : null}
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg">Identité éditoriale</h2>
        <label className="block text-sm">
          Provenance (italique sous le sous-titre)
          <input
            type="text"
            value={state.provenance}
            onChange={(e) => setState({ ...state, provenance: e.target.value })}
            className="mt-1 block w-full rounded-md border border-encre/20 px-3 py-2 text-sm"
            placeholder="Filmé à l'atelier, mars 2026."
            maxLength={120}
          />
          {fieldError('provenance') ? (
            <span className="mt-1 block text-xs text-rose-700" data-testid="error-provenance">
              {fieldError('provenance')}
            </span>
          ) : null}
        </label>

        <label className="block text-sm">
          Durée affichée (badge en bas-gauche du poster)
          <input
            type="text"
            value={state.durationDisplay}
            onChange={(e) =>
              setState({ ...state, durationDisplay: e.target.value })
            }
            className="mt-1 block w-full max-w-[160px] rounded-md border border-encre/20 px-3 py-2 text-sm"
            placeholder="90″"
            maxLength={8}
          />
          {fieldError('durationDisplay') ? (
            <span className="mt-1 block text-xs text-rose-700" data-testid="error-durationDisplay">
              {fieldError('durationDisplay')}
            </span>
          ) : null}
        </label>

        <fieldset className="block text-sm">
          <legend>Couleur d'accent</legend>
          <div className="mt-2 flex gap-3">
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

      <section className="space-y-3" data-testid="kit-video-chapters-section">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Chapitres ({state.chapters.length})</h2>
          <button
            type="button"
            onClick={addChapter}
            disabled={state.chapters.length >= 6}
            className="rounded-md border border-encre/20 px-2 py-1 text-xs disabled:opacity-40"
            data-testid="kit-video-chapter-add"
          >
            + Ajouter chapitre
          </button>
        </div>
        {fieldError('chapters') ? (
          <span className="block text-xs text-rose-700" data-testid="error-chapters">
            {fieldError('chapters')}
          </span>
        ) : null}
        <ol className="space-y-2">
          {state.chapters.map((chapter, index) => (
            <li
              key={`${chapter.key}-${index}`}
              data-testid={`kit-video-chapter-${index}`}
              className="grid grid-cols-[60px_1fr_1fr_100px_40px] gap-2 items-center rounded-md border border-encre/10 bg-creme-warm/30 p-2 text-sm"
            >
              <span className="font-display text-encre/60">
                {String(index + 1).padStart(2, '0')}
              </span>
              <input
                type="text"
                value={chapter.key}
                onChange={(e) => updateChapter(index, { key: e.target.value })}
                placeholder="slug"
                className="rounded border border-encre/20 px-2 py-1"
                aria-label={`Slug du chapitre ${index + 1}`}
              />
              <input
                type="text"
                value={chapter.label}
                onChange={(e) => updateChapter(index, { label: e.target.value })}
                placeholder="Label visible"
                maxLength={24}
                className="rounded border border-encre/20 px-2 py-1"
                aria-label={`Label du chapitre ${index + 1}`}
              />
              <input
                type="number"
                value={chapter.startSeconds}
                onChange={(e) =>
                  updateChapter(index, { startSeconds: Number(e.target.value) || 0 })
                }
                min={0}
                max={600}
                className="rounded border border-encre/20 px-2 py-1"
                aria-label={`Démarrage (s) du chapitre ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeChapter(index)}
                aria-label={`Supprimer le chapitre ${index + 1}`}
                className="rounded border border-encre/20 px-2 py-1 text-xs"
                data-testid={`kit-video-chapter-remove-${index}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap items-center gap-3 border-t border-encre/10 pt-4">
        <button
          type="submit"
          disabled={!dirty || !isValid || saving}
          data-testid="kit-video-save"
          className="rounded-md bg-encre px-4 py-2 text-sm font-medium text-creme disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={dirty || publishing || source === 'mock'}
          data-testid="kit-video-publish"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-creme disabled:opacity-40"
        >
          {publishing ? 'Publication…' : 'Publier sur /kit'}
        </button>
        <button
          type="button"
          onClick={() => setResetOpen((v) => !v)}
          data-testid="kit-video-reset-open"
          className="ml-auto rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700"
        >
          Reset au mock…
        </button>
      </footer>

      {resetOpen ? (
        <div
          data-testid="kit-video-reset-dialog"
          className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm"
        >
          <p>
            Cette action supprime l'override et fait retomber `/kit` sur le mock.
            Tape <code className="font-mono">RESET-VIDEO</code> pour confirmer.
          </p>
          <input
            type="text"
            value={resetInput}
            onChange={(e) => setResetInput(e.target.value)}
            className="mt-2 block w-full max-w-xs rounded border border-encre/20 px-2 py-1"
            data-testid="kit-video-reset-input"
            aria-label="Confirmation reset (taper RESET-VIDEO)"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={resetInput !== 'RESET-VIDEO' || resetting}
              data-testid="kit-video-reset-confirm"
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
