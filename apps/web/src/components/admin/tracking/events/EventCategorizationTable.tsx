'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * T29 — Tableau admin de catégorisation Google Ads par event.
 *
 * Charge depuis `GET /api/admin/tracking/events/categorization` et
 * permet d'override / reset chaque event via `PUT`. D-005 + C3.F.* .
 */

interface CategorizationItem {
  name: string;
  category: string;
  description: string;
  defaultCategory: string;
  overrideCategory: string | null;
  resolvedCategory: string;
  overrideUpdatedAt: string | null;
  overrideUpdatedBy: string | null;
  overrideNote: string | null;
}

interface CategorizationResponse {
  events: CategorizationItem[];
  availableCategories: string[];
}

export function EventCategorizationTable() {
  const [items, setItems] = useState<CategorizationItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingByEvent, setPendingByEvent] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tracking/events/categorization', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CategorizationResponse;
      setItems(data.events);
      setCategories(data.availableCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateOverride = useCallback(
    async (eventName: string, googleAdsCategory: string | null) => {
      setPendingByEvent((prev) => new Set(prev).add(eventName));
      setError(null);
      try {
        const res = await fetch('/api/admin/tracking/events/categorization', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventName, googleAdsCategory }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${detail}`.trim());
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur sauvegarde');
      } finally {
        setPendingByEvent((prev) => {
          const next = new Set(prev);
          next.delete(eventName);
          return next;
        });
      }
    },
    [refresh],
  );

  if (loading && items.length === 0) {
    return (
      <p className="text-sm text-stone-500" aria-busy="true">
        Chargement…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table
          className="min-w-full divide-y divide-stone-200 text-sm"
          data-testid="event-categorization-table"
        >
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Event
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Category (catalog)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Default Ads
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Override
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Résolu
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {items.map((item) => {
              const pending = pendingByEvent.has(item.name);
              const hasOverride = !!item.overrideCategory;
              return (
                <tr key={item.name}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-xs text-stone-900">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-stone-500">
                      {item.description}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-stone-700">
                    {item.category}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">
                      {item.defaultCategory}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      data-testid={`override-${item.name}`}
                      disabled={pending}
                      value={item.overrideCategory ?? ''}
                      onChange={(e) =>
                        updateOverride(item.name, e.target.value || null)
                      }
                      className="block rounded-md border border-stone-300 bg-white px-2 py-1 font-mono text-xs shadow-sm focus:border-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 disabled:opacity-50"
                    >
                      <option value="">— aucun —</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        hasOverride
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.resolvedCategory}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      type="button"
                      disabled={pending || !hasOverride}
                      onClick={() => updateOverride(item.name, null)}
                      data-testid={`reset-${item.name}`}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reset au default
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-stone-500">
                  Aucun event conversion dans le catalog.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
