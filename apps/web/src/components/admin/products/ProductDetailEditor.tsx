'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/products/types';
import { productPatchSchema } from '@/lib/products/schemas';

interface ProductDetailEditorProps {
  product: Product;
}

interface FormState {
  title: string;
  tagline: string;
  description: string;
  category: string;
  tagsRaw: string;
  position: number;
  featured: boolean;
}

function fromProduct(p: Product): FormState {
  return {
    title: p.title,
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    category: p.category ?? '',
    tagsRaw: (p.tags ?? []).join(', '),
    position: p.position,
    featured: p.featured,
  };
}

type BuildResult =
  | { ok: true; data: ReturnType<typeof productPatchSchema.parse> }
  | { ok: false; error: string };

export function ProductDetailEditor({ product }: ProductDetailEditorProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => fromProduct(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(fromProduct(product)),
    [state, product],
  );

  function buildPayload(): BuildResult {
    const tags = state.tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const data = {
      title: state.title.trim(),
      tagline: state.tagline.trim() ? state.tagline.trim() : null,
      description: state.description.trim() ? state.description.trim() : null,
      category: state.category.trim() ? state.category.trim() : null,
      tags,
      position: state.position,
      featured: state.featured,
    };
    const parsed = productPatchSchema.safeParse(data);
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
      const res = await fetch(`/api/admin/products/${product.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.data),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur sauvegarde.');
        return;
      }
      setSuccess('Modifications enregistrées.');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (
      !confirm(
        'Archiver ce produit ? Il ne sera plus listé en boutique mais restera en base.',
      )
    )
      return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.slug}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur archivage.');
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <Field label="Titre">
        <input
          type="text"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Tagline (optionnel)">
        <input
          type="text"
          value={state.tagline}
          onChange={(e) => setState((s) => ({ ...s, tagline: e.target.value }))}
          maxLength={180}
          placeholder="Une phrase courte qui résume le produit"
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
        />
        <span className="text-xs text-stone-500">{state.tagline.length}/180</span>
      </Field>

      <Field label="Description">
        <textarea
          value={state.description}
          onChange={(e) =>
            setState((s) => ({ ...s, description: e.target.value }))
          }
          maxLength={5000}
          rows={6}
          placeholder="Description riche (markdown light), max 5000 caractères."
          className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs"
        />
        <span className="text-xs text-stone-500">
          {state.description.length}/5000
        </span>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie">
          <input
            type="text"
            value={state.category}
            onChange={(e) =>
              setState((s) => ({ ...s, category: e.target.value }))
            }
            placeholder="kit"
            maxLength={40}
            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Position (tri)">
          <input
            type="number"
            value={state.position}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                position: Number.isFinite(e.target.valueAsNumber)
                  ? e.target.valueAsNumber
                  : 0,
              }))
            }
            min={0}
            max={9999}
            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
          />
        </Field>
      </div>

      <Field label="Tags (séparés par virgules)">
        <input
          type="text"
          value={state.tagsRaw}
          onChange={(e) => setState((s) => ({ ...s, tagsRaw: e.target.value }))}
          placeholder="kit, intime, ph"
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.featured}
          onChange={(e) =>
            setState((s) => ({ ...s, featured: e.target.checked }))
          }
        />
        <span>Mettre en avant (featured)</span>
      </label>

      <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <span className="text-xs text-stone-500">
          {dirty ? 'Modifications non sauvegardées.' : 'À jour.'}
        </span>
        <div className="ml-auto">
          {product.status !== 'archived' ? (
            <button
              type="button"
              onClick={handleArchive}
              disabled={saving}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Archiver
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}
