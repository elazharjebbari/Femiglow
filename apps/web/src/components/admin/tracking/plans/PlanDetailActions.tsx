'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { trackingPlanApi, ApiError } from '@/lib/tracking/plan/client';
import type { PlanStatus } from '@/lib/tracking/plan/types';
import { JsonPreview } from '@/components/admin/tracking/plans/JsonPreview';

export interface PlanDetailActionsProps {
  planId: string;
  status: PlanStatus;
  version: number;
  validationOk: boolean | null;
}

export function PlanDetailActions({
  planId,
  status,
  validationOk,
}: PlanDetailActionsProps): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportJson, setExportJson] = useState<unknown | null>(null);

  async function run<T>(fn: () => Promise<T>, after?: () => void): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await fn();
      after?.();
    } catch (e) {
      if (e instanceof ApiError) setError(`${e.code} — ${e.message}`);
      else setError('Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  function activate() {
    if (!confirm('Activer ce plan ? Le plan actif actuel sera archivé.')) return;
    void run(
      () => trackingPlanApi.activate(planId),
      () => router.refresh(),
    );
  }

  function archive() {
    if (!confirm('Archiver ce plan ?')) return;
    void run(
      () => trackingPlanApi.archive(planId),
      () => router.refresh(),
    );
  }

  function restore() {
    if (!confirm('Restaurer ce plan en brouillon ?')) return;
    void run(
      () => trackingPlanApi.restore(planId),
      () => router.refresh(),
    );
  }

  function remove() {
    if (
      !confirm(
        'Supprimer définitivement ce plan ? Cette action est irréversible (l\'audit est conservé).',
      )
    )
      return;
    void run(
      () => trackingPlanApi.delete(planId),
      () => router.push('/admin/tracking/plans'),
    );
  }

  async function doExport() {
    setError(null);
    setBusy(true);
    try {
      const res = await trackingPlanApi.export(planId, 'production');
      setExportJson(res.json);
    } catch (e) {
      if (e instanceof ApiError) setError(`${e.code} — ${e.message}`);
      else setError('Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  // Édition autorisée pour draft + active (concurrence optimiste via
  // expectedVersion côté API). Bloquée seulement pour les plans
  // archivés (passer par "Restaurer en brouillon" d'abord).
  const canEdit = status !== 'archived';
  const canActivate = status === 'draft' && validationOk === true;
  const canArchive = status === 'draft' || status === 'active';
  const canRestore = status === 'archived';
  const canDelete = status !== 'active';
  const canExport = validationOk === true;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Link
            href={`/admin/tracking/plans/${planId}/edit`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Éditer
          </Link>
        )}
        <button
          type="button"
          onClick={activate}
          disabled={busy || !canActivate}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={doExport}
          disabled={busy || !canExport}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Exporter GTM
        </button>
        <button
          type="button"
          onClick={archive}
          disabled={busy || !canArchive}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Archiver
        </button>
        {canRestore && (
          <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Restaurer en brouillon
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Supprimer
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {exportJson !== null && (
        <section className="mt-6 min-w-0">
          <header className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium uppercase tracking-wide text-stone-500">
              Container GTM (production)
            </h3>
            <p className="text-xs text-stone-500">
              Import GTM &rarr; Admin &rarr; Importer un conteneur
            </p>
          </header>
          <JsonPreview data={exportJson} filename={`plan-${planId}.gtm.json`} />
        </section>
      )}
    </div>
  );
}
