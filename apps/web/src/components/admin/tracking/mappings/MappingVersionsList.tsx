'use client';

import { useCallback, useEffect, useState } from 'react';
import { mappingsClient, MappingApiError } from '@/lib/admin/mappings-client';
import type { MappingVersionListItem } from '@/lib/tracking/mappings/types';
import { DEFAULT_VERSION_ID } from '@/lib/tracking/mappings/types';
import { MappingCreateWizard } from './MappingCreateWizard';
import { useConfirm } from './useConfirm';
import { CloneAndEditButton } from './CloneAndEditButton';

/**
 * Liste des versions de mappings. Affiche active, drafts, archived, deleted.
 * Actions par version : éditer, activer, archiver, supprimer, restaurer, exporter GTM.
 * cf. docs/event-mappings/50-ui-ux-design/wireframes/list-versions.txt
 */
function formatActiveSince(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'aujourd\'hui';
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days}j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)}mo`;
  return `il y a ${Math.floor(days / 365)}an`;
}

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
  const { confirm, ConfirmHost } = useConfirm();

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
    const ok = await confirm({
      title: `Activer "${name}" ?`,
      message: 'La version active courante sera automatiquement archivée. Le dispatcher utilisera ce mapping immédiatement (cache invalidé en 30s).',
      confirmLabel: '✓ Activer',
      variant: 'success',
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: `Supprimer "${name}" ?`,
      message: 'La version sera masquée de la liste mais conservée en DB pour audit. Tu pourras la restaurer plus tard.',
      details: '⚠️ Cette action n\'est pas définitive (soft-delete).',
      confirmLabel: '🗑 Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    markPending(id, true);
    try {
      await mappingsClient.softDelete(id);
      await refresh();
    } catch (err) {
      if (err instanceof MappingApiError) {
        if (err.code === 'cannot_delete_active') setError("Impossible de supprimer la version active. Active une autre version d'abord.");
        else if (err.code === 'cannot_delete_default') setError("La version __default__ ne peut pas être supprimée.");
        else setError(err.message);
      }
    } finally {
      markPending(id, false);
    }
  };

  const handleResetDefault = async () => {
    const ok = await confirm({
      title: 'Revenir au mapping par défaut FemiGlow ?',
      message: 'La version active courante sera archivée. Le mapping factory FemiGlow (__default__) deviendra actif.',
      details: '⚠️ Aucune donnée n\'est perdue : la version courante reste archivée et réactivable plus tard.',
      confirmLabel: '↩ Revenir au default factory',
      variant: 'danger',
    });
    if (!ok) return;
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
        <form action="/api/admin/tracking/events/mappings/seed-defaults" method="POST">
          <button
            type="submit"
            data-testid="btn-seed-defaults"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
            title="Charge le factory mapping (70 events × 6 vendors) depuis docs/event-mappings/20-data/default-mapping.json. Idempotent : UPDATE si __default__ existe."
          >
            ⚙ Seed factory mapping (70 events)
          </button>
        </form>
        <a
          href="/admin/tracking/gtm"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
          title="Configurer les Pixel IDs / Conv labels"
        >
          ↗ GTM configs
        </a>
        <a
          href="/admin/tracking/events/categorization"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
          title="Catégorisation Google Ads par event"
        >
          ↗ Catégorisation Ads
        </a>
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
              const activeSince = v.isActive ? formatActiveSince(v.activatedAt ?? v.createdAt) : null;
              return (
                <tr key={v.id} data-testid={`version-row-${v.id}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-stone-900">{v.name}</div>
                    {v.notes ? <div className="mt-0.5 text-[11px] text-stone-500">{v.notes}</div> : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {v.isActive ? (
                      <div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">ACTIVE</span>
                        {activeSince ? <div className="mt-0.5 text-[10px] text-emerald-700">depuis {activeSince}</div> : null}
                      </div>
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
                      <a
                        href={`/admin/tracking/events/mappings/${v.id}/audit`}
                        className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-50"
                        data-testid={`btn-audit-${v.id}`}
                      >
                        Historique
                      </a>
                      {!v.isDefault && !v.isActive ? (
                        <a
                          href={`/admin/tracking/events/mappings/${v.id}/edit`}
                          data-testid={`btn-edit-${v.id}`}
                          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-50"
                        >
                          Éditer
                        </a>
                      ) : null}
                      {/* D-001 : __default__ et active immutables → workflow clone-and-edit en 1 click */}
                      {(v.isDefault || v.isActive) ? (
                        <CloneAndEditButton sourceId={v.id} sourceName={v.name} label="✏ Cloner & éditer" variant="secondary" />
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
      <ConfirmHost />
    </div>
  );
}
