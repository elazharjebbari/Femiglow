'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BulkActionBar } from './BulkActionBar';
import type { AdminRitualRow } from '@/lib/db/queries/rituals-admin';
import type { RitualStatus } from '@/lib/db/types';

interface RitualsAdminTableProps {
  rows: AdminRitualRow[];
  totalAll: number;
  surface: 'queue' | 'published' | 'archived';
}

const STATUS_LABEL: Record<RitualStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Publié',
  REJECTED: 'Rejeté',
  HIDDEN: 'Masqué',
};

const ACTIONS_BY_SURFACE = {
  queue: [
    { key: 'approve', label: 'Approuver', variant: 'primary' } as const,
    { key: 'reject', label: 'Rejeter', requiresNote: true, variant: 'destructive' } as const,
  ],
  published: [
    { key: 'feature', label: 'Mettre en avant', variant: 'primary' } as const,
    { key: 'unfeature', label: 'Retirer mise en avant', variant: 'secondary' } as const,
    { key: 'hide', label: 'Masquer', requiresNote: true, variant: 'destructive' } as const,
  ],
  archived: [
    { key: 'restore', label: 'Restaurer', variant: 'primary' } as const,
  ],
};

export function RitualsAdminTable({
  rows,
  totalAll,
  surface,
}: RitualsAdminTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<Set<string>>(
    new Set(),
  );

  const visibleRows = useMemo(
    () => rows.filter((r) => !optimisticallyRemoved.has(r.id)),
    [rows, optimisticallyRemoved],
  );

  const allOnPageChecked = useMemo(
    () => visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id)),
    [visibleRows, selected],
  );

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      if (allOnPageChecked) {
        const next = new Set(prev);
        visibleRows.forEach((r) => next.delete(r.id));
        return next;
      }
      return new Set([...Array.from(prev), ...visibleRows.map((r) => r.id)]);
    });
  };

  const removeOptimistically = (ids: string[]) => {
    setOptimisticallyRemoved((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    return () => {
      // rollback
      setOptimisticallyRemoved((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    };
  };

  return (
    <>
      <BulkActionBar
        selectedIds={Array.from(selected)}
        totalVisible={visibleRows.length}
        totalAll={totalAll}
        onClearSelection={() => setSelected(new Set())}
        onSelectAll={() => {
          // Pour rester simple : sélection page-only ici.
          // Une vraie "sélection globale" nécessiterait un fetch all-ids.
        }}
        onOptimisticRemove={removeOptimistically}
        actions={ACTIONS_BY_SURFACE[surface]}
      />

      {visibleRows.length === 0 ? (
        <div className="border border-stone-200 bg-white p-12 text-center text-sm text-stone-600">
          Aucun rituel à afficher.
        </div>
      ) : (
        <table className="w-full text-sm" role="table">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th scope="col" className="p-2 text-left">
                <input
                  type="checkbox"
                  checked={allOnPageChecked}
                  aria-label="Sélectionner toute la page"
                  onChange={toggleAllOnPage}
                  data-testid="bulk-select-page"
                  className="h-4 w-4 accent-stone-900"
                />
              </th>
              <th scope="col" className="p-2 text-left">Citation</th>
              <th scope="col" className="p-2 text-left">Auteur</th>
              <th scope="col" className="p-2 text-left">Statut</th>
              <th scope="col" className="p-2 text-left">Source</th>
              <th scope="col" className="p-2 text-left">Soumis</th>
              <th scope="col" className="p-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const flags = r.autoFlags;
              const hasFace = flags.includes('face_detected');
              return (
                <tr
                  key={r.id}
                  data-testid="admin-ritual-row"
                  className="border-b border-stone-100 hover:bg-stone-50"
                >
                  <td className="p-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Sélectionner le rituel ${r.publicSlug}`}
                      data-testid={`bulk-select-row-${r.publicSlug}`}
                      className="h-4 w-4 accent-stone-900"
                    />
                  </td>
                  <td className="max-w-md p-2 align-top">
                    {hasFace && (
                      <span className="mr-2 inline-block bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        PRIORITÉ
                      </span>
                    )}
                    {flags.length > 0 && !hasFace && (
                      <span className="mr-2 inline-block bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-700">
                        {flags.length} flag(s)
                      </span>
                    )}
                    <span className="text-stone-900">
                      « {r.body.slice(0, 120)}
                      {r.body.length > 120 ? '…' : ''} »
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-2 align-top text-xs text-stone-600">
                    {r.authorFirstName ?? 'Une initiée'}
                    {r.authorCity ? `, ${r.authorCity}` : ''}
                  </td>
                  <td className="whitespace-nowrap p-2 align-top text-xs text-stone-700">
                    {STATUS_LABEL[r.status]}
                    {r.featured && (
                      <span className="ml-1 text-emerald-700">★</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-2 align-top text-xs text-stone-600">
                    {r.source}
                  </td>
                  <td className="whitespace-nowrap p-2 align-top text-xs text-stone-600">
                    {new Intl.DateTimeFormat('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    }).format(r.createdAt)}
                  </td>
                  <td className="whitespace-nowrap p-2 align-top">
                    <Link
                      href={`/admin/rituals/${r.id}`}
                      prefetch
                      className="text-xs font-medium text-stone-900 underline"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
