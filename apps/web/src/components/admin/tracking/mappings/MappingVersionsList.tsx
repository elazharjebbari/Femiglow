'use client';

import { useCallback, useEffect, useState } from 'react';
import { mappingsClient, MappingApiError } from '@/lib/admin/mappings-client';
import type { MappingVersionListItem } from '@/lib/tracking/mappings/types';
import { DEFAULT_VERSION_ID } from '@/lib/tracking/mappings/types';
import { MappingCreateWizard } from './MappingCreateWizard';

/**
 * Liste des versions de mappings. Affiche active, drafts, archived, deleted.
 * Actions par version : éditer, activer, archiver, supprimer, restaurer, exporter GTM.
 * cf. docs/event-mappings/50-ui-ux-design/wireframes/list-versions.txt
 */
export function MappingVersionsList() {
  const [data, setData] = useState<{
    versions: MappingVersionListItem[];
    activeId: string | null;
    defaultId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingByVersion, setPendingByVersion] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await mappingsClient.list();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markPending = (id: string, pending: boolean) => {
    setPendingByVersion((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleActivate = async (id: string, name: string) => {
    if (!confirm(`Activer "${name}" ? La version active courante sera archivée.`)) return;
    markPending(id, true);
    try {
      await mappingsClient.activate(id);
      await refresh();
    } catch (err) {
      setError(err instanceof MappingApiError ? err.message : 'Erreur');
    } finally {
      markPending(id, false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" (soft-delete) ?`)) return;
    markPending(id, true);
    try {
      await mappingsClient.softDelete(id);
      await refresh();
    } catch (err) {
      if (err instanceof MappingApiError) {
        if (err.code === 'cannot_delete_active') alert("Impossible de supprimer la version active. Active une autre version d'abord.");
        else if (err.code === 'cannot_delete_default') alert("La version __default__ ne peut pas être supprimée.");
        else setError(err.message);
      }
    } finally {
      markPending(id, false);
    }
  };

  const handleResetDefault = async () => {
    if (!confirm("Revenir au mapping par défaut FemiGlow ? La version active courante sera archivée.")) return;
    try {
      await mappingsClient.resetToDefault();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  if (loading) {
    return <p className="text-sm text-stone-500" aria-busy="true">Chargement…</p>;
  }
  if (!data) {
    return <p className="text-sm text-red-700">{error ?? 'Erreur'}</p>;
  }

  const visible = data.versions.filter((v) => showDeleted || v.status !== 'deleted');

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          data-testid="btn-create-version"
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
        >
          + Créer une version
        </button>
        {data.activeId && data.activeId !== DEFAULT_VERSION_ID ? (
          <button
            type="button"
            onClick={handleResetDefault}
            data-testid="btn-reset-default"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ↩ Reset au default
          </button>
        ) : null}
        <label className="ml-auto flex items-center gap-2 text-xs text-stone-600">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Inclure les supprimées
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm" data-testid="mapping-versions-table">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Version</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Status</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">Events</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Créé par</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Date</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {visible.map((v) => {
              const isPending = pendingByVersion.has(v.id);
              return (
                <tr key={v.id} data-testid={`version-row-${v.id}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-stone-900">{v.name}</div>
                    {v.notes ? <div className="mt-0.5 text-[11px] text-stone-500">{v.notes}</div> : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {v.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">ACTIVE</span>
                    ) : v.isDefault ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">DEFAULT</span>
                    ) : v.status === 'draft' ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">DRAFT</span>
                    ) : v.status === 'archived' ? (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">archived</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">supprimée</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono">{v.eventsCount}</td>
                  <td className="px-3 py-2 text-xs">{v.createdBy}</td>
                  <td className="px-3 py-2 text-xs">{new Date(v.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <a
                        href={`/admin/tracking/events/mappings/${v.id}`}
                        className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-50"
                      >
                        Voir
                      </a>
                      {!v.isDefault ? (
                        <a
                          href={`/admin/tracking/events/mappings/${v.id}/edit`}
                          data-testid={`btn-edit-${v.id}`}
                          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-50"
                        >
                          Éditer
                        </a>
                      ) : null}
                      {!v.isActive && v.status !== 'deleted' ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleActivate(v.id, v.name)}
                          data-testid={`btn-activate-${v.id}`}
                          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Activer
                        </button>
                      ) : null}
                      {!v.isActive && !v.isDefault && v.status !== 'deleted' ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(v.id, v.name)}
                          data-testid={`btn-delete-${v.id}`}
                          className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-stone-500">
                  Aucune version. Crée la première version pour démarrer.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showWizard ? (
        <MappingCreateWizard
          existingVersions={data.versions}
          onClose={() => setShowWizard(false)}
          onCreated={async () => {
            setShowWizard(false);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}
