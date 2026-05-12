/**
 * Onglet historique pour un form-config. Liste les versions, permet de
 * voir le diff (raw JSON) et de rollback à une version donnée.
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §3.2
 */
'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

import type { FormConfigJson } from '@/lib/checkout/form-config/schema';

interface HistoryItem {
  id: string;
  version: number;
  action: 'create' | 'update' | 'activate' | 'deactivate' | 'rollback';
  description: string | null;
  actorId: string | null;
  createdAt: string;
  config: FormConfigJson;
}

interface FormConfigHistoryProps {
  formKey: string;
  currentVersion: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const ACTION_LABEL: Record<HistoryItem['action'], string> = {
  create: 'Création',
  update: 'Mise à jour',
  activate: 'Activation',
  deactivate: 'Désactivation',
  rollback: 'Rollback',
};

export function FormConfigHistory({
  formKey,
  currentVersion,
}: FormConfigHistoryProps) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollbackPending, setRollbackPending] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/form-config/${formKey}/history`);
      if (!res.ok) {
        setError(`Erreur ${res.status}`);
        return;
      }
      const data = (await res.json()) as { items: HistoryItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [formKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRollback = useCallback(
    async (targetVersion: number) => {
      if (
        !window.confirm(
          `Rollback vers la version ${targetVersion} ? Une nouvelle version sera créée avec ce contenu.`,
        )
      ) {
        return;
      }
      setRollbackPending(targetVersion);
      setError(null);
      try {
        const res = await fetch(`/api/admin/form-config/${formKey}/rollback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': String(currentVersion),
          },
          body: JSON.stringify({ targetVersion }),
        });
        if (res.status === 409) {
          setError('Version stale — recharge la page avant de rollback.');
          return;
        }
        if (!res.ok) {
          setError(`Rollback échoué (${res.status}).`);
          return;
        }
        // Reload puis full reload pour rafraîchir version courante dans l'éditeur.
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau.');
      } finally {
        setRollbackPending(null);
      }
    },
    [formKey, currentVersion],
  );

  if (loading && !items) {
    return <p className="text-sm text-stone-500">Chargement de l'historique…</p>;
  }
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {error}
      </p>
    );
  }
  if (!items || items.length === 0) {
    return <p className="text-sm text-stone-500">Aucune version archivée.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2">Version</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Auteur</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {items.map((item) => {
            const isCurrent = item.version === currentVersion;
            const isExpanded = expanded === item.id;
            return (
              <Fragment key={item.id}>
                <tr className={isCurrent ? 'bg-emerald-50' : undefined}>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    v{item.version}
                    {isCurrent ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-800">
                        courante
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{formatDate(item.createdAt)}</td>
                  <td className="px-3 py-2">{ACTION_LABEL[item.action]}</td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">
                    {item.actorId ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-stone-700">{item.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Masquer' : 'JSON'}
                    </button>
                    {!isCurrent ? (
                      <button
                        type="button"
                        onClick={() => handleRollback(item.version)}
                        disabled={rollbackPending !== null}
                        className="ml-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                        data-testid={`form-config-rollback-${item.version}`}
                      >
                        {rollbackPending === item.version ? '…' : 'Rollback'}
                      </button>
                    ) : null}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="bg-stone-50/50">
                    <td colSpan={6} className="px-3 py-2">
                      <pre className="max-h-64 overflow-auto rounded-md bg-stone-900 p-3 font-mono text-[11px] text-stone-100">
                        {JSON.stringify(item.config, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
