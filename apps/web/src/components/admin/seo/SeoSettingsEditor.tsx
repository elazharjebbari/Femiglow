'use client';

import { useMemo, useState } from 'react';
import type { KnownPage, SeoSettings } from '@/lib/seo/types';
import { seoSettingsUpsertSchema } from '@/lib/seo/schemas';

interface SeoSettingsEditorProps {
  initial: SeoSettings;
}

interface FormState {
  siteName: string;
  defaultDescription: string;
  defaultOgImageMediaId: string;
  twitterHandle: string;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  organizationJsonLd: string;
  knownPages: KnownPage[];
}

function fromSettings(s: SeoSettings): FormState {
  return {
    siteName: s.siteName,
    defaultDescription: s.defaultDescription ?? '',
    defaultOgImageMediaId: s.defaultOgImageMediaId ?? '',
    twitterHandle: s.twitterHandle ?? '',
    defaultRobotsIndex: s.defaultRobotsIndex,
    defaultRobotsFollow: s.defaultRobotsFollow,
    organizationJsonLd: s.organizationJsonLd
      ? JSON.stringify(s.organizationJsonLd, null, 2)
      : '',
    knownPages: [...s.knownPages],
  };
}

export function SeoSettingsEditor({ initial }: SeoSettingsEditorProps) {
  const [state, setState] = useState<FormState>(() => fromSettings(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(fromSettings(initial)),
    [state, initial],
  );

  type BuildResult =
    | { ok: true; data: ReturnType<typeof seoSettingsUpsertSchema.parse> }
    | { ok: false; error: string };

  function buildPayload(): BuildResult {
    let organizationJsonLd: unknown = null;
    if (state.organizationJsonLd.trim()) {
      try {
        organizationJsonLd = JSON.parse(state.organizationJsonLd);
      } catch {
        return { ok: false, error: 'JSON-LD Organization invalide.' };
      }
    }
    const data = {
      siteName: state.siteName,
      defaultDescription: state.defaultDescription || null,
      defaultOgImageMediaId: state.defaultOgImageMediaId || null,
      twitterHandle: state.twitterHandle || null,
      organizationJsonLd,
      defaultRobotsIndex: state.defaultRobotsIndex,
      defaultRobotsFollow: state.defaultRobotsFollow,
      knownPages: state.knownPages,
    };
    const parsed = seoSettingsUpsertSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        ok: false,
        error: issue ? `${issue.path.join('.')} : ${issue.message}` : 'Validation en échec.',
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
      const res = await fetch('/api/admin/seo/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur serveur.');
        return;
      }
      setSuccess('Settings mis à jour — cache global invalidé.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  function addKnownPage() {
    setState((s) => ({
      ...s,
      knownPages: [...s.knownPages, { key: '', label: '', path: '/', scope: 'page' }],
    }));
  }

  function updateKnownPage(idx: number, field: keyof KnownPage, value: string) {
    setState((s) => ({
      ...s,
      knownPages: s.knownPages.map((p, i) =>
        i === idx ? ({ ...p, [field]: value } as KnownPage) : p,
      ),
    }));
  }

  function removeKnownPage(idx: number) {
    setState((s) => ({ ...s, knownPages: s.knownPages.filter((_, i) => i !== idx) }));
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Settings SEO
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Defaults globaux + pages connues. Modifié{' '}
            <time dateTime={initial.updatedAt.toISOString()}>
              {new Date(initial.updatedAt).toLocaleString('fr-FR')}
            </time>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
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

      <section className="mb-6 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Identité</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Site name">
            <input
              type="text"
              value={state.siteName}
              onChange={(e) => setState((s) => ({ ...s, siteName: e.target.value }))}
              className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Twitter handle">
            <input
              type="text"
              value={state.twitterHandle}
              onChange={(e) => setState((s) => ({ ...s, twitterHandle: e.target.value }))}
              placeholder="@femiglow"
              className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Default description" full>
            <textarea
              rows={2}
              value={state.defaultDescription}
              onChange={(e) =>
                setState((s) => ({ ...s, defaultDescription: e.target.value }))
              }
              className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
            />
          </Field>
          <Field label="OG image par défaut — média ID">
            <input
              type="text"
              value={state.defaultOgImageMediaId}
              onChange={(e) =>
                setState((s) => ({ ...s, defaultOgImageMediaId: e.target.value }))
              }
              placeholder="med_..."
              className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-sm font-mono"
            />
          </Field>
          <Field label="Robots par défaut">
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={state.defaultRobotsIndex}
                  onChange={(e) =>
                    setState((s) => ({ ...s, defaultRobotsIndex: e.target.checked }))
                  }
                />
                index
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={state.defaultRobotsFollow}
                  onChange={(e) =>
                    setState((s) => ({ ...s, defaultRobotsFollow: e.target.checked }))
                  }
                />
                follow
              </label>
            </div>
          </Field>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">JSON-LD Organization</h2>
        <textarea
          rows={10}
          value={state.organizationJsonLd}
          onChange={(e) =>
            setState((s) => ({ ...s, organizationJsonLd: e.target.value }))
          }
          placeholder='{"@context":"https://schema.org","@type":"Organization",...}'
          className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs"
        />
        <p className="mt-2 text-xs text-stone-500">
          Doit contenir <code>@context: https://schema.org</code> et <code>@type: Organization</code>.
        </p>
      </section>

      <section className="rounded-md border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">
            Pages connues ({state.knownPages.length})
          </h2>
          <button
            type="button"
            onClick={addKnownPage}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs hover:bg-stone-50"
          >
            + Ajouter
          </button>
        </div>
        {state.knownPages.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune page connue.</p>
        ) : (
          <div className="space-y-2">
            {state.knownPages.map((p, idx) => (
              <div
                key={`${idx}-${p.key}`}
                className="grid grid-cols-12 items-center gap-2 rounded-md border border-stone-200 px-2 py-1.5"
              >
                <input
                  type="text"
                  value={p.key}
                  onChange={(e) => updateKnownPage(idx, 'key', e.target.value)}
                  placeholder="key"
                  className="col-span-3 rounded border border-stone-200 bg-white px-2 py-1 text-xs font-mono"
                />
                <input
                  type="text"
                  value={p.label}
                  onChange={(e) => updateKnownPage(idx, 'label', e.target.value)}
                  placeholder="Label"
                  className="col-span-4 rounded border border-stone-200 bg-white px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  value={p.path}
                  onChange={(e) => updateKnownPage(idx, 'path', e.target.value)}
                  placeholder="/path"
                  className="col-span-4 rounded border border-stone-200 bg-white px-2 py-1 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeKnownPage(idx)}
                  className="col-span-1 rounded border border-stone-200 px-1 py-1 text-xs text-stone-500 hover:text-red-700"
                  aria-label={`Supprimer ${p.key}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? 'lg:col-span-2' : ''}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}
