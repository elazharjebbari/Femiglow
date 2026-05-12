'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { SeoOverride, SeoScope } from '@/lib/seo/types';
import { OG_TEMPLATES, SEO_SCOPES } from '@/lib/seo/types';
import { seoOverrideUpsertSchema } from '@/lib/seo/schemas';
import type { AuditReport } from '@/lib/seo/rules/types';
import { SeoLinterPanel } from '@/components/admin/seo/SeoLinterPanel';
import { SerpPreview } from '@/components/admin/seo/previews/SerpPreview';
import { FacebookPreview } from '@/components/admin/seo/previews/FacebookPreview';
import { TwitterPreview } from '@/components/admin/seo/previews/TwitterPreview';
import { SeoHistoryPanel } from '@/components/admin/seo/SeoHistoryPanel';

interface SeoOverrideEditorProps {
  initial: SeoOverride | null;
  /** Si null, mode création. */
  mode: 'create' | 'edit';
  /**
   * Verrouille le triplet (scope, targetKey, locale) — utilisé par les éditeurs
   * dédiés (ex. SEO d'un produit). Quand fourni :
   *  - le state initial reprend ces valeurs si `initial === null`
   *  - les champs scope/targetKey/locale deviennent en lecture seule
   *  - après suppression, redirection vers `backHref` plutôt que `/admin/seo`.
   */
  lockedTarget?: { scope: SeoScope; targetKey: string; locale: string };
  /** Lien de retour affiché en breadcrumb / après suppression. */
  backHref?: string;
  backLabel?: string;
}

interface FormState {
  scope: SeoOverride['scope'];
  targetKey: string;
  locale: string;
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImageMediaId: string;
  ogImageTemplate: SeoOverride['ogImageTemplate'] | '';
  twitterCard: SeoOverride['twitterCard'];
  canonical: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  structuredData: string;
}

function fromOverride(
  o: SeoOverride | null,
  locked?: { scope: SeoScope; targetKey: string; locale: string },
): FormState {
  return {
    scope: o?.scope ?? locked?.scope ?? 'page',
    targetKey: o?.targetKey ?? locked?.targetKey ?? '',
    locale: o?.locale ?? locked?.locale ?? 'fr-MA',
    title: o?.title ?? '',
    description: o?.description ?? '',
    keywords: (o?.keywords ?? []).join(', '),
    ogTitle: o?.ogTitle ?? '',
    ogDescription: o?.ogDescription ?? '',
    ogImageMediaId: o?.ogImageMediaId ?? '',
    ogImageTemplate: o?.ogImageTemplate ?? '',
    twitterCard: o?.twitterCard ?? 'summary_large_image',
    canonical: o?.canonical ?? '',
    robotsIndex: o?.robotsIndex ?? true,
    robotsFollow: o?.robotsFollow ?? true,
    structuredData: o?.structuredData ? JSON.stringify(o.structuredData, null, 2) : '',
  };
}

export function SeoOverrideEditor({
  initial,
  mode,
  lockedTarget,
  backHref,
  backLabel,
}: SeoOverrideEditorProps) {
  const [state, setState] = useState<FormState>(() => fromOverride(initial, lockedTarget));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(initial?.id ?? null);
  const [publishedAt, setPublishedAt] = useState<string | null>(
    initial?.publishedAt ? new Date(initial.publishedAt).toISOString() : null,
  );
  const [report, setReport] = useState<AuditReport | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [previewTab, setPreviewTab] = useState<'serp' | 'facebook' | 'twitter'>('serp');
  const formRef = useRef<HTMLDivElement | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(fromOverride(initial, lockedTarget)),
    [state, initial, lockedTarget],
  );

  type BuildResult =
    | { ok: true; data: ReturnType<typeof seoOverrideUpsertSchema.parse> }
    | { ok: false; error: string };

  function buildPayload(): BuildResult {
    const keywords = state.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    let structuredData: unknown = null;
    if (state.structuredData.trim()) {
      try {
        structuredData = JSON.parse(state.structuredData);
      } catch {
        return { ok: false, error: 'JSON-LD invalide.' };
      }
    }
    const data = {
      scope: state.scope,
      targetKey: state.targetKey,
      locale: state.locale,
      title: state.title || null,
      description: state.description || null,
      keywords,
      ogTitle: state.ogTitle || null,
      ogDescription: state.ogDescription || null,
      ogImageMediaId: state.ogImageMediaId || null,
      ogImageTemplate: state.ogImageTemplate === '' ? null : state.ogImageTemplate,
      twitterCard: state.twitterCard,
      canonical: state.canonical || null,
      robotsIndex: state.robotsIndex,
      robotsFollow: state.robotsFollow,
      structuredData,
    };
    const parsed = seoOverrideUpsertSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Validation en échec.',
      };
    }
    return { ok: true, data: parsed.data };
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const built = buildPayload();
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setSaving(true);
    try {
      const url = overrideId ? `/api/admin/seo/${overrideId}` : '/api/admin/seo';
      const res = await fetch(url, {
        method: overrideId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur serveur.');
        return;
      }
      const data = await res.json();
      const saved = data.override as SeoOverride;
      setOverrideId(saved.id);
      setSuccess(mode === 'create' ? 'Override créé.' : 'Override mis à jour.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    if (!overrideId) return;
    if (!confirm('Dépublier cet override ? Le resolver public retombera sur les settings/defaults.')) return;
    setUnpublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/seo/${overrideId}/unpublish`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur dépublication.');
        return;
      }
      const data = await res.json();
      setSuccess('Override dépublié — cache invalidé.');
      const o = data.override as SeoOverride;
      setPublishedAt(o.publishedAt ? new Date(o.publishedAt).toISOString() : null);
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleDelete() {
    if (!overrideId) return;
    if (
      !confirm(
        'Supprimer définitivement cet override SEO ? Cette action est irréversible.',
      )
    )
      return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/seo/${overrideId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur suppression.');
        return;
      }
      window.location.assign(backHref ?? '/admin/seo');
    } finally {
      setDeleting(false);
    }
  }

  async function handlePublish() {
    if (!overrideId) {
      setError('Enregistre avant de publier.');
      return;
    }
    if (dirty) {
      setError('Sauvegarde tes changements avant de publier.');
      return;
    }
    if (report && report.errors > 0) {
      setError('Corrige les erreurs audit avant de publier.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seo/${overrideId}/publish`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur publication.');
        return;
      }
      const data = await res.json();
      setSuccess('Override publié — cache invalidé.');
      const o = data.override as SeoOverride;
      setPublishedAt(o.publishedAt ? new Date(o.publishedAt).toISOString() : null);
    } finally {
      setPublishing(false);
    }
  }

  // ---- Audit live (debounced) -------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      const built = buildPayload();
      if (!built.ok) {
        setReport(null);
        return;
      }
      setAuditing(true);
      void (async () => {
        try {
          const res = await fetch('/api/admin/seo/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate: built.data }),
          });
          if (!res.ok) return;
          const data = await res.json();
          setReport(data.report as AuditReport);
        } finally {
          setAuditing(false);
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state)]);

  function focusField(field: string | undefined) {
    if (!field) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = el.querySelector<HTMLElement>('input, textarea, select');
      focusable?.focus();
    }
  }

  // Preview values used by SerpPreview / FacebookPreview / TwitterPreview
  const previewUrl = state.canonical || `https://femiglow-maroc.com/${state.targetKey || ''}`;
  let previewHost = 'femiglow-maroc.com';
  try {
    previewHost = new URL(previewUrl).host;
  } catch {
    // ignore
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          {backHref ? (
            <div className="mb-1 flex items-center gap-2 text-xs">
              <Link
                href={backHref}
                className="text-stone-500 underline-offset-2 hover:underline"
              >
                ← {backLabel ?? 'Retour'}
              </Link>
              <span className="text-stone-400">/</span>
              <span className="font-mono text-stone-600">SEO</span>
            </div>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {mode === 'create' ? 'Nouvel override SEO' : `Override · ${state.targetKey}`}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {publishedAt ? (
              <>
                Publié{' '}
                <time dateTime={publishedAt}>
                  {new Date(publishedAt).toLocaleString('fr-FR')}
                </time>
              </>
            ) : (
              'Draft, non visible côté public.'
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-40"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!overrideId || dirty || publishing}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
          >
            {publishing ? 'Publication…' : 'Publier'}
          </button>
          {publishedAt ? (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={!overrideId || unpublishing}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
            >
              {unpublishing ? 'Dépublication…' : 'Dépublier'}
            </button>
          ) : null}
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={!overrideId || deleting}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-40"
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={formRef} className="grid gap-4 lg:grid-cols-2">
        <Field label="Scope" field="scope">
          <select
            value={state.scope}
            disabled={!!lockedTarget}
            onChange={(e) =>
              setState((s) => ({ ...s, scope: e.target.value as SeoOverride['scope'] }))
            }
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
          >
            {SEO_SCOPES.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
          {lockedTarget ? (
            <Hint>Verrouillé par contexte (édition produit).</Hint>
          ) : null}
        </Field>
        <Field label="Target key" field="targetKey">
          <input
            type="text"
            value={state.targetKey}
            readOnly={!!lockedTarget}
            onChange={(e) => setState((s) => ({ ...s, targetKey: e.target.value }))}
            placeholder="home"
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm read-only:cursor-not-allowed read-only:bg-stone-100 read-only:text-stone-500"
          />
        </Field>
        <Field label="Locale" field="locale">
          <input
            type="text"
            value={state.locale}
            readOnly={!!lockedTarget}
            onChange={(e) => setState((s) => ({ ...s, locale: e.target.value }))}
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm read-only:cursor-not-allowed read-only:bg-stone-100 read-only:text-stone-500"
          />
        </Field>
        <Field label="Canonical (URL)" field="canonical">
          <input
            type="text"
            value={state.canonical}
            onChange={(e) => setState((s) => ({ ...s, canonical: e.target.value }))}
            placeholder="https://femiglow-maroc.com/page"
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Title" field="title">
          <input
            type="text"
            maxLength={120}
            value={state.title}
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
          <Hint>{state.title.length}/60 idéal · 120 max</Hint>
        </Field>
        <Field label="Description" field="description">
          <textarea
            rows={2}
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
          <Hint>{state.description.length}/160 idéal</Hint>
        </Field>
        <Field label="Keywords (séparés par virgule)" field="keywords">
          <input
            type="text"
            value={state.keywords}
            onChange={(e) => setState((s) => ({ ...s, keywords: e.target.value }))}
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </Field>
        <Field label="OG title" field="ogTitle">
          <input
            type="text"
            value={state.ogTitle}
            onChange={(e) => setState((s) => ({ ...s, ogTitle: e.target.value }))}
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </Field>
        <Field label="OG description" field="ogDescription">
          <textarea
            rows={2}
            value={state.ogDescription}
            onChange={(e) => setState((s) => ({ ...s, ogDescription: e.target.value }))}
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </Field>
        <Field label="OG image — média ID" field="ogImageMediaId">
          <input
            type="text"
            value={state.ogImageMediaId}
            onChange={(e) => setState((s) => ({ ...s, ogImageMediaId: e.target.value }))}
            placeholder="med_..."
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm font-mono"
          />
        </Field>
        <Field label="OG image — template" field="ogImageTemplate">
          <select
            value={state.ogImageTemplate ?? ''}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                ogImageTemplate:
                  e.target.value === ''
                    ? ''
                    : (e.target.value as SeoOverride['ogImageTemplate']),
              }))
            }
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          >
            <option value="">— aucun —</option>
            {OG_TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Twitter card" field="twitterCard">
          <select
            value={state.twitterCard}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                twitterCard: e.target.value as SeoOverride['twitterCard'],
              }))
            }
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          >
            <option value="summary">summary</option>
            <option value="summary_large_image">summary_large_image</option>
          </select>
        </Field>
        <Field label="Robots" field="robotsIndex">
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={state.robotsIndex}
                onChange={(e) => setState((s) => ({ ...s, robotsIndex: e.target.checked }))}
              />
              index
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={state.robotsFollow}
                onChange={(e) => setState((s) => ({ ...s, robotsFollow: e.target.checked }))}
              />
              follow
            </label>
          </div>
        </Field>
        <Field label="JSON-LD (override partiel)" field="structuredData" full>
          <textarea
            rows={6}
            value={state.structuredData}
            onChange={(e) => setState((s) => ({ ...s, structuredData: e.target.value }))}
            placeholder='{"@context":"https://schema.org",...}'
            className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs"
          />
        </Field>
        </div>

        <div className="space-y-4">
          <SeoLinterPanel
            report={report}
            loading={auditing}
            onIssueClick={focusField}
          />
          <div className="rounded-md border border-stone-200 bg-white p-3">
            <header className="mb-3 flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Preview
              </h2>
              <div className="ml-auto flex gap-1 text-xs">
                {(['serp', 'facebook', 'twitter'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPreviewTab(t)}
                    className={`rounded px-2 py-0.5 ${
                      previewTab === t
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </header>
            {previewTab === 'serp' ? (
              <SerpPreview
                url={previewUrl}
                title={state.title}
                description={state.description}
              />
            ) : null}
            {previewTab === 'facebook' ? (
              <FacebookPreview
                ogTitle={state.ogTitle || state.title}
                ogDescription={state.ogDescription || state.description}
                urlHost={previewHost}
              />
            ) : null}
            {previewTab === 'twitter' ? (
              <TwitterPreview
                card={state.twitterCard}
                title={state.ogTitle || state.title}
                description={state.ogDescription || state.description}
                domain={previewHost}
              />
            ) : null}
          </div>
          {overrideId ? <SeoHistoryPanel overrideId={overrideId} /> : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
  field,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  field?: string;
}) {
  return (
    <label
      data-field={field}
      className={`flex flex-col gap-1 ${full ? 'lg:col-span-2' : ''}`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-stone-500">{children}</span>;
}
