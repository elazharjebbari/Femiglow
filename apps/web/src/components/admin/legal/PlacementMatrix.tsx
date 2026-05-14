'use client';

import { useState } from 'react';

interface Zone {
  key: string;
  label: string;
  isRequired: boolean;
  maxItemsRecommended: number;
}

interface Page {
  slug: string;
  title: string;
  status: string;
}

interface Placement {
  pageSlug: string;
  zoneKey: string;
  isVisible: boolean;
  displayOrder: number;
  labelOverride: string | null;
}

interface Props {
  zones: Zone[];
  pages: Page[];
  placements: Placement[];
}

export function PlacementMatrix({ zones, pages, placements: initial }: Props) {
  const [placements, setPlacements] = useState<Placement[]>(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getPlacement(pageSlug: string, zoneKey: string): Placement | null {
    return placements.find((p) => p.pageSlug === pageSlug && p.zoneKey === zoneKey) ?? null;
  }

  function zoneCount(zoneKey: string): number {
    return placements.filter((p) => p.zoneKey === zoneKey && p.isVisible).length;
  }

  async function toggle(pageSlug: string, zoneKey: string) {
    const current = getPlacement(pageSlug, zoneKey);
    const next = !(current && current.isVisible);
    const key = `${pageSlug}:${zoneKey}`;
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/legal/placements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSlug,
          zoneKey,
          isVisible: next,
          displayOrder: current?.displayOrder ?? 0,
          labelOverride: current?.labelOverride ?? null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlacements((prev) => {
        const existing = prev.find((p) => p.pageSlug === pageSlug && p.zoneKey === zoneKey);
        if (existing) {
          return prev.map((p) =>
            p.pageSlug === pageSlug && p.zoneKey === zoneKey ? { ...p, isVisible: next } : p,
          );
        }
        return [
          ...prev,
          {
            pageSlug,
            zoneKey,
            isVisible: next,
            displayOrder: 0,
            labelOverride: null,
          },
        ];
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="border-collapse border border-stone-200 bg-white text-sm">
          <thead className="bg-stone-100 text-left text-xs uppercase tracking-wider text-stone-600">
            <tr>
              <th className="sticky left-0 z-10 bg-stone-100 px-3 py-2">Page</th>
              {zones.map((z) => (
                <th
                  key={z.key}
                  className={`min-w-[140px] px-3 py-2 ${
                    z.isRequired ? 'border-t-2 border-t-red-300' : ''
                  }`}
                  title={z.label}
                >
                  <div className="font-medium">{z.label}</div>
                  <div className="font-mono text-[10px] text-stone-500">
                    {z.key} · {zoneCount(z.key)}/{z.maxItemsRecommended}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.slug} className="border-b border-stone-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <div className="font-medium text-stone-900">{p.title}</div>
                  <div className="font-mono text-xs text-stone-500">
                    /legal/{p.slug} · {p.status}
                  </div>
                </td>
                {zones.map((z) => {
                  const placement = getPlacement(p.slug, z.key);
                  const isPlaced = !!(placement && placement.isVisible);
                  const key = `${p.slug}:${z.key}`;
                  return (
                    <td key={z.key} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(p.slug, z.key)}
                        disabled={savingKey === key}
                        className={`inline-flex h-6 w-6 items-center justify-center border ${
                          isPlaced
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                            : 'border-stone-300 bg-white text-stone-300'
                        } ${savingKey === key ? 'opacity-40' : ''}`}
                        aria-label={`${p.slug} dans ${z.label} : ${isPlaced ? 'visible' : 'non placé'}`}
                      >
                        {isPlaced ? '✓' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
