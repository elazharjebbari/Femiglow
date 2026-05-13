'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Redirect {
  old_slug: string;
  new_slug: string;
  created_at: string;
  created_by: string | null;
}

interface Props {
  initial: Redirect[];
}

export function SlugRedirectsManager({ initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Redirect[]>(initial);
  const [oldSlug, setOldSlug] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/legal/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSlug, newSlug }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      }
      const row = (await res.json()) as Redirect;
      setRows((prev) => [row, ...prev]);
      setOldSlug('');
      setNewSlug('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Supprimer le redirect /legal/${slug} ?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/legal/redirects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSlug: slug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((prev) => prev.filter((r) => r.old_slug !== slug));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="rounded-md border border-stone-200 bg-white p-4"
        aria-label="Ajouter un redirect"
      >
        <h2 className="text-sm font-medium text-stone-900">Ajouter un redirect 301</h2>
        <p className="mt-1 text-xs text-stone-500">
          Toute requête sur <code>/legal/&lt;old&gt;</code> redirigera de façon
          permanente vers <code>/legal/&lt;new&gt;</code>. La nouvelle slug doit
          correspondre à une page publiée existante.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-stone-600">
              Ancien slug
            </span>
            <input
              type="text"
              value={oldSlug}
              onChange={(e) => setOldSlug(e.target.value)}
              required
              placeholder="conditions-vente"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-stone-600">
              Nouveau slug
            </span>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              required
              placeholder="cgv"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy || !oldSlug || !newSlug}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
            >
              {busy ? 'En cours…' : 'Créer'}
            </button>
          </div>
        </div>
      </form>

      <section>
        <h2 className="text-sm font-medium text-stone-900">
          Redirects existants ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
            Aucun redirect configuré.
          </p>
        ) : (
          <table className="mt-3 w-full border-collapse border border-stone-200 bg-white text-sm">
            <thead className="bg-stone-100 text-left text-xs uppercase tracking-wider text-stone-600">
              <tr>
                <th className="px-3 py-2">Ancien slug</th>
                <th className="px-3 py-2">→</th>
                <th className="px-3 py-2">Nouveau slug</th>
                <th className="px-3 py-2">Créé le</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.old_slug}>
                  <td className="px-3 py-2 font-mono text-xs">
                    /legal/{r.old_slug}
                  </td>
                  <td className="px-3 py-2 text-stone-500">→</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    /legal/{r.new_slug}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.old_slug)}
                      disabled={busy}
                      className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
