'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'review', label: 'En revue' },
  { value: 'published', label: 'Publié' },
  { value: 'archived', label: 'Archivé' },
];

export function LegalListFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [pending, startTransition] = useTransition();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set('q', search);
      else next.delete('q');
      if (status) next.set('status', status);
      else next.delete('status');
      startTransition(() => {
        router.replace(`/admin/legal${next.toString() ? `?${next}` : ''}`);
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="flex-1 min-w-[200px]">
        <span className="sr-only">Rechercher une page</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (titre, slug, description)…"
          className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          aria-label="Rechercher une page légale"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-stone-600">Statut</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          aria-label="Filtrer par statut"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {pending ? (
        <span aria-live="polite" className="text-xs text-stone-500">
          Filtrage…
        </span>
      ) : null}
    </div>
  );
}
