'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { productCreateSchema } from '@/lib/products/schemas';

export function ProductCreateForm() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = productCreateSchema.safeParse({
      slug: slug.toLowerCase().trim(),
      title: title.trim(),
      ...(category.trim() ? { category: category.trim() } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Validation en échec.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur création.');
        return;
      }
      const data = await res.json();
      router.push(`/admin/products/${data.product.slug}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Slug
        </span>
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="kit-femiglow"
          className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-sm"
        />
        <span className="text-xs text-stone-500">
          Lowercase kebab-case, 2–80 chars.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Titre
        </span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Le Kit FemiGlow"
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Catégorie (optionnel)
        </span>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="kit"
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
      >
        {submitting ? 'Création…' : 'Créer le produit'}
      </button>
    </form>
  );
}
