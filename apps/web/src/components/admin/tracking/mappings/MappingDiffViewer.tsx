'use client';

import { useEffect, useState } from 'react';
import type { MappingCell } from '@/lib/tracking/mappings/types';

/**
 * MappingDiffViewer — affiche le diff entre 2 versions (B4/B5).
 * cf. docs/event-mappings/50-ui-ux-design/wireframes/diff-view.txt
 */

interface DiffItem {
  event: string;
  provider: string;
  before: MappingCell | null;
  after: MappingCell | null;
}

interface DiffResponse {
  added: DiffItem[];
  removed: DiffItem[];
  changed: DiffItem[];
}

function CellPreview({ cell }: { cell: MappingCell | null }) {
  if (!cell || !cell.mappedName) return <span className="text-stone-400">—</span>;
  return (
    <span className="font-mono text-xs">
      {cell.mappedName}
      {cell.isCustom ? <span className="ml-1 text-amber-700">(custom)</span> : null}
      {!cell.isEnabled ? <span className="ml-1 text-stone-400">(disabled)</span> : null}
    </span>
  );
}

export function MappingDiffViewer({ aId, bId, aName, bName }: { aId: string; bId: string; aName: string; bName: string }) {
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterChangesOnly, setFilterChangesOnly] = useState(true);

  useEffect(() => {
    const url = `/api/admin/tracking/events/mappings/${encodeURIComponent(aId)}/diff/${encodeURIComponent(bId)}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DiffResponse>;
      })
      .then(setDiff)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [aId, bId]);

  if (loading) return <p className="text-sm text-stone-500" aria-busy="true">Calcul du diff…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!diff) return null;

  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

  return (
    <div className="space-y-3" data-testid="mapping-diff-viewer">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
        <div className="text-sm">
          <span className="font-medium">Comparaison :</span>{' '}
          <span className="font-mono text-xs">{aName}</span>
          <span className="mx-2 text-stone-400">↔</span>
          <span className="font-mono text-xs">{bName}</span>
        </div>
        <div className="text-xs text-stone-600">
          {totalChanges} modification(s) ·{' '}
          <span className="text-emerald-700">🟢 +{diff.added.length} ajout(s)</span> ·{' '}
          <span className="text-red-700">🔴 -{diff.removed.length} suppression(s)</span> ·{' '}
          <span className="text-amber-700">🟡 ±{diff.changed.length} modif(s)</span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={filterChangesOnly}
          onChange={(e) => setFilterChangesOnly(e.target.checked)}
          data-testid="diff-filter-changes-only"
        />
        Modifications uniquement
      </label>

      {totalChanges === 0 ? (
        <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">
          Aucune différence entre ces deux versions.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200 text-sm" data-testid="diff-table">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Δ</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Event × Provider</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">{aName}</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">{bName}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {diff.added.map((d, i) => (
                <tr key={`a-${i}`}>
                  <td className="px-3 py-2"><span className="text-emerald-700">🟢 Ajouté</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{d.event} × {d.provider}</td>
                  <td className="px-3 py-2 text-stone-400">—</td>
                  <td className="px-3 py-2"><CellPreview cell={d.after} /></td>
                </tr>
              ))}
              {diff.removed.map((d, i) => (
                <tr key={`r-${i}`}>
                  <td className="px-3 py-2"><span className="text-red-700">🔴 Supprimé</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{d.event} × {d.provider}</td>
                  <td className="px-3 py-2"><CellPreview cell={d.before} /></td>
                  <td className="px-3 py-2 text-stone-400">—</td>
                </tr>
              ))}
              {diff.changed.map((d, i) => (
                <tr key={`c-${i}`}>
                  <td className="px-3 py-2"><span className="text-amber-700">🟡 Modifié</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{d.event} × {d.provider}</td>
                  <td className="px-3 py-2"><CellPreview cell={d.before} /></td>
                  <td className="px-3 py-2"><CellPreview cell={d.after} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
