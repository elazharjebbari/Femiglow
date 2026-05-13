'use client';

import { useEffect, useState } from 'react';
import type { MappingAuditEntry, MappingAuditAction } from '@/lib/tracking/mappings/types';

const ACTION_LABEL: Record<MappingAuditAction, string> = {
  create: 'Création',
  edit: 'Édition',
  activate: 'Activation',
  archive: 'Archivage',
  delete: 'Suppression',
  restore: 'Restauration',
  duplicate: 'Duplication',
  reset_to_default: 'Reset au default',
  export_gtm: 'Export GTM',
  test_event: 'Test dispatch',
};

const ACTION_COLOR: Record<MappingAuditAction, string> = {
  create: 'bg-blue-100 text-blue-800',
  edit: 'bg-amber-100 text-amber-800',
  activate: 'bg-emerald-100 text-emerald-800',
  archive: 'bg-stone-100 text-stone-700',
  delete: 'bg-red-100 text-red-800',
  restore: 'bg-emerald-100 text-emerald-800',
  duplicate: 'bg-purple-100 text-purple-800',
  reset_to_default: 'bg-yellow-100 text-yellow-800',
  export_gtm: 'bg-indigo-100 text-indigo-800',
  test_event: 'bg-stone-100 text-stone-600',
};

/**
 * MappingAuditTimeline — timeline historique d'une version (B2/B3).
 */
export function MappingAuditTimeline({ versionId }: { versionId: string }) {
  const [entries, setEntries] = useState<MappingAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `/api/admin/tracking/events/mappings/${encodeURIComponent(versionId)}/audit`;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { entries: MappingAuditEntry[] };
        setEntries(data.entries ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur chargement'))
      .finally(() => setLoading(false));
  }, [versionId]);

  if (loading) return <p className="text-sm text-stone-500" aria-busy="true">Chargement…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (entries.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Aucune action n'a été enregistrée pour cette version. Les actions futures
        (édition, activation, export, etc.) apparaîtront ici.
      </p>
    );
  }

  return (
    <ol className="space-y-2" data-testid="audit-timeline">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex items-start gap-3 rounded-md border border-stone-200 bg-white px-3 py-2"
        >
          <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-stone-400" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[e.action]}`}>
                {ACTION_LABEL[e.action]}
              </span>
              <span className="text-xs text-stone-500">
                {new Date(e.createdAt).toLocaleString('fr-FR')}
              </span>
              <span className="text-xs text-stone-500">par {e.actorId}</span>
            </div>
            {Object.keys(e.meta).length > 0 ? (
              <div className="mt-1 font-mono text-[11px] text-stone-600">
                {JSON.stringify(e.meta, null, 0)}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
