'use client';

import { useEffect, useMemo, useState } from 'react';

interface ScannedComponent {
  name: string;
  path: string;
  category: string;
  description?: string;
  events?: string[];
}

interface ScannedPage {
  route: string;
  title: string;
  category: string;
  filePath: string;
}

interface DiffSummary {
  componentsToCreate: number;
  componentsToUpdate: number;
  componentsToDelete: number;
  pagesToCreate: number;
  pagesToUpdate: number;
  pagesToDelete: number;
  isEmpty: boolean;
  summary: string;
}

interface InventoryResponse {
  manifest: {
    generatedAt: string;
    components: ScannedComponent[];
    pages: ScannedPage[];
  };
  diff: DiffSummary;
  existing: { componentsCount: number; pagesCount: number };
}

export function InventoryPanel() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<'components' | 'pages'>('components');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/admin/tracking/inventory', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as InventoryResponse;
      })
      .then((j) => {
        if (alive) setData(j);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Erreur');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const components = useMemo(() => {
    if (!data) return [];
    const f = filter.toLowerCase().trim();
    if (!f) return data.manifest.components;
    return data.manifest.components.filter(
      (c) =>
        c.name.toLowerCase().includes(f) ||
        c.path.toLowerCase().includes(f) ||
        c.category.toLowerCase().includes(f),
    );
  }, [data, filter]);

  const pages = useMemo(() => {
    if (!data) return [];
    const f = filter.toLowerCase().trim();
    if (!f) return data.manifest.pages;
    return data.manifest.pages.filter(
      (p) =>
        p.route.toLowerCase().includes(f) ||
        p.title.toLowerCase().includes(f) ||
        p.category.toLowerCase().includes(f),
    );
  }, [data, filter]);

  if (loading) {
    return <p className="text-sm text-stone-500">Chargement de l’inventaire…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-700">Erreur : {error}</p>;
  }
  if (!data) return null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DiffCard
          label="À créer"
          count={data.diff.componentsToCreate + data.diff.pagesToCreate}
          tone="positive"
        />
        <DiffCard
          label="À mettre à jour"
          count={data.diff.componentsToUpdate + data.diff.pagesToUpdate}
          tone="warn"
        />
        <DiffCard
          label="À supprimer"
          count={data.diff.componentsToDelete + data.diff.pagesToDelete}
          tone="danger"
        />
      </div>
      <div className="mt-2 text-xs text-stone-500">
        Manifest généré le {new Date(data.manifest.generatedAt).toLocaleString()}.
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 border-b border-stone-200">
          <button
            type="button"
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === 'components'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
            onClick={() => setTab('components')}
          >
            Composants ({data.manifest.components.length})
          </button>
          <button
            type="button"
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === 'pages'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
            onClick={() => setTab('pages')}
          >
            Pages ({data.manifest.pages.length})
          </button>
        </div>
        <input
          type="search"
          placeholder="Rechercher…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-auto w-64 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-stone-900 focus:outline-none"
        />
      </div>

      {tab === 'components' ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Catégorie</th>
                <th className="px-3 py-2 font-medium">Chemin</th>
                <th className="px-3 py-2 font-medium">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {components.map((c) => (
                <tr key={c.path}>
                  <td className="px-3 py-2 font-medium text-stone-900">{c.name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-700">
                      {c.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">{c.path}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {(c.events ?? []).join(', ') || '—'}
                  </td>
                </tr>
              ))}
              {components.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-stone-500">
                    Aucun composant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Titre</th>
                <th className="px-3 py-2 font-medium">Catégorie</th>
                <th className="px-3 py-2 font-medium">Fichier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pages.map((p) => (
                <tr key={p.route}>
                  <td className="px-3 py-2 font-mono text-xs text-stone-900">{p.route}</td>
                  <td className="px-3 py-2 text-stone-700">{p.title}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-700">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-600">{p.filePath}</td>
                </tr>
              ))}
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-stone-500">
                    Aucune page.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiffCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'positive' | 'warn' | 'danger';
}) {
  const cls =
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-rose-200 bg-rose-50 text-rose-900';
  return (
    <div className={`rounded-md border px-4 py-3 ${cls}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
    </div>
  );
}
