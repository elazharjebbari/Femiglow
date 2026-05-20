/**
 * `KitPackEditor` — formulaire admin pour la section pack `/kit`.
 *
 * Singleton (`/admin/kit/pack`). Pattern miroir de `KitVideoEditor` et
 * `KitCompositionEditor`. Édite les champs clés du hero pack :
 *  - `kicker / title / lead / pricePrefix / ctaLabel / ctaMicrocopy`
 *  - `priceCompareAt / priceCompareAtAriaLabel`
 *  - `perUsageHint`
 *  - `ctaAccent` (radio sauge-dark / champagne / terracotta)
 *  - `countLabelGeo` (sur socialProof)
 *
 * Note : `valueBreakdown` n'est pas éditable dans cette version
 * (édition liste complexe — TODO itération suivante). En attendant,
 * un reset au mock permet de revenir au breakdown par défaut.
 *
 * Boutons : Save (PATCH), Publish (POST /publish), Reset (POST /reset
 * gardée derrière une modale + saisie `RESET-PACK`).
 *
 * cf. docs/pack-section-optim-2026-05/06-admin-ui-ux-design.md
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

import { kitPackOverrideUpsertSchema } from '@/lib/kit/pack/schemas';
import type {
  KitPackOverride,
  KitPackOverridePatch,
  KitPackSource,
} from '@/lib/kit/pack/types';

const ACCENTS = ['sauge-dark', 'champagne', 'terracotta'] as const;
type Accent = (typeof ACCENTS)[number];

interface KitPackEditorProps {
  initial: KitPackOverride | null;
  source: KitPackSource;
}

interface FormState {
  kicker: string;
  title: string;
  lead: string;
  pricePrefix: string;
  ctaLabel: string;
  ctaMicrocopy: string;
  priceCompareAt: string;
  priceCompareAtAriaLabel: string;
  perUsageHint: string;
  ctaAccent: Accent | '';
  countLabelGeo: string;
}

function fromOverride(o: KitPackOverride | null): FormState {
  return {
    kicker: o?.kicker ?? '',
    title: o?.title ?? '',
    lead: o?.lead ?? '',
    pricePrefix: o?.pricePrefix ?? '',
    ctaLabel: o?.ctaLabel ?? '',
    ctaMicrocopy: o?.ctaMicrocopy ?? '',
    priceCompareAt: o?.priceCompareAt ?? '',
    priceCompareAtAriaLabel: o?.priceCompareAtAriaLabel ?? '',
    perUsageHint: o?.perUsageHint ?? '',
    ctaAccent: (o?.ctaAccent as Accent | undefined) ?? '',
    countLabelGeo: o?.countLabelGeo ?? '',
  };
}

function emptyToNull(s: string): string | null {
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
}

function toPatch(state: FormState): KitPackOverridePatch {
  return {
    kicker: emptyToNull(state.kicker),
    title: emptyToNull(state.title),
    lead: emptyToNull(state.lead),
    pricePrefix: emptyToNull(state.pricePrefix),
    ctaLabel: emptyToNull(state.ctaLabel),
    ctaMicrocopy: emptyToNull(state.ctaMicrocopy),
    priceCompareAt: emptyToNull(state.priceCompareAt),
    priceCompareAtAriaLabel: emptyToNull(state.priceCompareAtAriaLabel),
    perUsageHint: emptyToNull(state.perUsageHint),
    ctaAccent: state.ctaAccent === '' ? null : state.ctaAccent,
    countLabelGeo: emptyToNull(state.countLabelGeo),
  };
}

export function KitPackEditor({
  initial,
  source,
}: KitPackEditorProps): JSX.Element {
  const [state, setState] = useState<FormState>(() => fromOverride(initial));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<Date | null>(
    initial?.publishedAt ?? null,
  );
  const [draftedAt, setDraftedAt] = useState<Date | null>(
    initial?.draftedAt ?? null,
  );

  const patch = useMemo(() => toPatch(state), [state]);
  const validation = useMemo(
    () => kitPackOverrideUpsertSchema.safeParse(patch),
    [patch],
  );

  const baseFieldClasses =
    'mt-1 block w-full rounded-sm border border-encre/15 bg-creme px-3 py-2 text-sm focus:border-encre/40 focus:outline-none';

  const isDirty = useMemo(() => {
    return JSON.stringify(fromOverride(initial)) !== JSON.stringify(state);
  }, [initial, state]);

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setState((s) => ({ ...s, [key]: value }));
      setSuccess(null);
      setError(null);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!validation.success) {
      setError('Formulaire invalide — corriger les champs en rouge.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/kit/pack', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as { override: KitPackOverride };
      setSuccess('Brouillon enregistré.');
      setDraftedAt(data.override.draftedAt ?? null);
      setPublishedAt(data.override.publishedAt ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  }, [validation.success, patch]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/kit/pack/publish', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            `HTTP ${res.status}`,
        );
      }
      const data = (await res.json()) as { override: KitPackOverride };
      setSuccess('Publié sur /kit.');
      setPublishedAt(data.override.publishedAt ?? null);
      setDraftedAt(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setPublishing(false);
    }
  }, []);

  const handleReset = useCallback(async () => {
    setResetting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/kit/pack/reset', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            `HTTP ${res.status}`,
        );
      }
      setSuccess('Override supprimé — la section revient au mock.');
      setState(fromOverride(null));
      setPublishedAt(null);
      setDraftedAt(null);
      setResetOpen(false);
      setResetInput('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setResetting(false);
    }
  }, []);

  const statusLabel: string = useMemo(() => {
    if (source === 'mock') return 'Mock par défaut';
    if (publishedAt) return 'Publié';
    return 'Brouillon';
  }, [source, publishedAt]);

  const canPublish = !isDirty && (draftedAt !== null || publishedAt !== null);

  return (
    <div data-testid="kit-pack-editor" className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-encre">Pack /kit</h1>
        <p className="text-sm text-encre/60">
          Statut :{' '}
          <span data-testid="kit-pack-status" className="font-medium text-encre">
            {statusLabel}
          </span>
        </p>
      </header>

      <fieldset className="space-y-4" disabled={saving || publishing || resetting}>
        <Field label="Kicker" htmlFor="kicker">
          <input
            id="kicker"
            value={state.kicker}
            onChange={(e) => set('kicker', e.target.value)}
            placeholder="Le pack"
            className={baseFieldClasses}
          />
        </Field>

        <Field label="Titre" htmlFor="title">
          <input
            id="title"
            value={state.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Le rituel s’installe en deux gestes…"
            className={baseFieldClasses}
          />
        </Field>

        <Field label="Lead (description courte)" htmlFor="lead">
          <textarea
            id="lead"
            value={state.lead}
            onChange={(e) => set('lead', e.target.value)}
            rows={3}
            placeholder="Trois objets dans la main, deux gestes dans la soirée…"
            className={baseFieldClasses}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Préfixe prix" htmlFor="pricePrefix">
            <input
              id="pricePrefix"
              value={state.pricePrefix}
              onChange={(e) => set('pricePrefix', e.target.value)}
              placeholder="Tout compris :"
              className={baseFieldClasses}
            />
          </Field>
          <Field label="Prix barré « non packagé »" htmlFor="priceCompareAt">
            <input
              id="priceCompareAt"
              value={state.priceCompareAt}
              onChange={(e) => set('priceCompareAt', e.target.value)}
              placeholder="49 €"
              className={baseFieldClasses}
            />
          </Field>
        </div>

        <Field label="Aria-label prix barré" htmlFor="priceCompareAtAriaLabel">
          <input
            id="priceCompareAtAriaLabel"
            value={state.priceCompareAtAriaLabel}
            onChange={(e) => set('priceCompareAtAriaLabel', e.target.value)}
            placeholder="Prix non packagé 49 €"
            className={baseFieldClasses}
          />
        </Field>

        <Field label="Libellé CTA" htmlFor="ctaLabel">
          <input
            id="ctaLabel"
            value={state.ctaLabel}
            onChange={(e) => set('ctaLabel', e.target.value)}
            placeholder="Commander le rituel"
            className={baseFieldClasses}
          />
        </Field>

        <Field label="Microcopy CTA (≥ 8 mots)" htmlFor="ctaMicrocopy">
          <textarea
            id="ctaMicrocopy"
            value={state.ctaMicrocopy}
            onChange={(e) => set('ctaMicrocopy', e.target.value)}
            rows={2}
            placeholder="Paste · Powder · Polissoir · Livraison offerte…"
            className={baseFieldClasses}
          />
        </Field>

        <Field label="Microcopy coût/usage" htmlFor="perUsageHint">
          <input
            id="perUsageHint"
            value={state.perUsageHint}
            onChange={(e) => set('perUsageHint', e.target.value)}
            placeholder="≈ 0,75 € par soin sur 30 jours"
            className={baseFieldClasses}
          />
        </Field>

        <Field label="Libellé géo social proof" htmlFor="countLabelGeo">
          <input
            id="countLabelGeo"
            value={state.countLabelGeo}
            onChange={(e) => set('countLabelGeo', e.target.value)}
            placeholder="287 maisons en France"
            className={baseFieldClasses}
          />
        </Field>

        <div>
          <span className="text-sm font-medium text-encre">Accent CTA</span>
          <div className="mt-2 flex gap-3">
            {(['', ...ACCENTS] as const).map((value) => (
              <label
                key={value || 'default'}
                className="inline-flex items-center gap-2 text-sm text-encre"
              >
                <input
                  type="radio"
                  name="ctaAccent"
                  value={value}
                  checked={state.ctaAccent === value}
                  onChange={() => set('ctaAccent', value as Accent | '')}
                />
                {value === '' ? 'défaut (mock)' : value}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {!validation.success && (
        <p data-testid="kit-pack-validation-error" className="text-sm text-[#A03A2C]">
          Formulaire invalide :{' '}
          {validation.error.issues
            .slice(0, 3)
            .map((i) => i.path.join('.') || '<root>')
            .join(', ')}
        </p>
      )}

      {error && (
        <p data-testid="kit-pack-error" className="text-sm text-[#A03A2C]">
          {error}
        </p>
      )}
      {success && (
        <p data-testid="kit-pack-success" className="text-sm text-sauge-dark">
          {success}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-4">
        <button
          data-testid="kit-pack-save"
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty || !validation.success}
          className="inline-flex h-11 items-center justify-center rounded-sm bg-encre px-5 text-sm font-medium text-creme disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          data-testid="kit-pack-publish"
          type="button"
          onClick={handlePublish}
          disabled={publishing || !canPublish || source === 'mock'}
          className="inline-flex h-11 items-center justify-center rounded-sm bg-sauge-dark px-5 text-sm font-medium text-creme disabled:opacity-40"
        >
          {publishing ? 'Publication…' : 'Publier sur /kit'}
        </button>
        <button
          data-testid="kit-pack-reset-open"
          type="button"
          onClick={() => setResetOpen(true)}
          disabled={source === 'mock'}
          className="inline-flex h-11 items-center justify-center rounded-sm border border-encre/30 px-5 text-sm font-medium text-encre disabled:opacity-40"
        >
          Reset au mock
        </button>
      </div>

      {resetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="kit-pack-reset-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-encre/40 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-md bg-creme p-6">
            <h2 className="font-display text-xl text-encre">
              Confirmer le reset
            </h2>
            <p className="text-sm text-encre/70">
              Cette action efface définitivement l’override pack. Tape{' '}
              <code className="font-mono text-encre">RESET-PACK</code> pour
              confirmer.
            </p>
            <input
              data-testid="kit-pack-reset-input"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              className={baseFieldClasses}
              placeholder="RESET-PACK"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetOpen(false);
                  setResetInput('');
                }}
                className="h-10 rounded-sm border border-encre/30 px-4 text-sm text-encre"
              >
                Annuler
              </button>
              <button
                data-testid="kit-pack-reset-confirm"
                type="button"
                onClick={handleReset}
                disabled={resetting || resetInput !== 'RESET-PACK'}
                className="h-10 rounded-sm bg-[#A03A2C] px-4 text-sm font-medium text-creme disabled:opacity-40"
              >
                {resetting ? 'Reset…' : 'Confirmer le reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-encre">
      {label}
      {children}
    </label>
  );
}
