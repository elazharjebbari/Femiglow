/**
 * BulkPublishDialog — « Publier les brouillons importés ».
 *
 * Deux temps : un essai à blanc (`dryRun: true`, filtre `source: import`)
 * liste ce qui sera publié, ce que chaque publication remplace et les
 * avertissements ; puis la confirmation publie EXACTEMENT ce plan revu
 * (`expected` : `setId` + `updatedAt`). Si les brouillons ont changé entre
 * les deux (nouvel import, modification), le serveur refuse sans rien
 * publier (409 `bulk.plan_changed`) : la nouvelle liste est rechargée et
 * doit être confirmée à nouveau. Chaque publication est indépendante : un
 * échec n'arrête pas les autres, le bilan est affiché par cellule.
 */
'use client';

import { useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { MediaSetApiError, type MediaSetsApi } from './api';
import { formatParis, localeLabel, rowLabel } from './model';
import type {
  BulkPublishDryRunResponse,
  BulkPublishFilter,
  BulkPublishResponse,
  BulkPublishSummaryJson,
  MediaVariantDimensionJson,
} from './types';
import { btn } from './ui';

const WARNING_LABEL: Record<string, string> = {
  'items.empty': 'ensemble vide',
  'media.unavailable': 'média supprimé ou pas prêt',
};

const FILTER: BulkPublishFilter = { source: 'import' };

interface Props {
  open: boolean;
  api: MediaSetsApi;
  dimensions: MediaVariantDimensionJson[];
  onClose: () => void;
  /** Appelé après une publication (au moins une réussite) pour rafraîchir. */
  onPublished: (published: number) => void;
}

function tupleText(r: BulkPublishSummaryJson, dimensions: MediaVariantDimensionJson[]): string {
  return `${rowLabel({ variantDim: r.variantDim, variantKey: r.variantKey }, dimensions).title} · ${localeLabel(r.locale)} · ${r.slot}`;
}

export function BulkPublishDialog({ open, api, dimensions, onClose, onPublished }: Props): JSX.Element {
  const [plan, setPlan] = useState<BulkPublishDryRunResponse | null>(null);
  const [result, setResult] = useState<BulkPublishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [planChanged, setPlanChanged] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPlan(null);
    setResult(null);
    setError(null);
    setPlanChanged(false);
    setBusy(true);
    api
      .bulkPublishDryRun(FILTER)
      .then((res) => {
        if (!cancelled) setPlan(res);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, api]);

  async function confirm(): Promise<void> {
    if (!plan) return;
    setBusy(true);
    setError(null);
    setPlanChanged(false);
    try {
      const res = await api.bulkPublish(
        FILTER,
        plan.results.map(({ setId, updatedAt }) => ({ setId, updatedAt })),
      );
      setResult(res);
      if (res.published > 0) onPublished(res.published);
    } catch (e) {
      if (e instanceof MediaSetApiError && e.reason === 'bulk.plan_changed') {
        // La liste a changé : rien n'a été publié. Nouvelle liste à revoir.
        setPlanChanged(true);
        try {
          setPlan(await api.bulkPublishDryRun(FILTER));
        } catch (e2) {
          setPlan(null);
          setError((e2 as Error).message);
        }
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  const count = plan?.results.length ?? 0;

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-stone-900/50" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100vh-48px)] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white shadow-xl focus:outline-none">
          <div className="border-b border-stone-200 px-6 py-4">
            <RadixDialog.Title className="text-lg font-semibold text-stone-900">
              Publier les brouillons importés
            </RadixDialog.Title>
            <RadixDialog.Description className="mt-1 text-sm text-stone-600">
              Brouillons créés par l’import des images générées (<code className="font-mono">source = import</code>).
              Vérifiez la liste avant de publier : chaque cellule remplace son ensemble publié.
            </RadixDialog.Description>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" aria-live="polite">
            {error ? (
              <p role="alert" className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            {planChanged ? (
              <p role="alert" className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                La liste des brouillons importés a changé depuis la vérification : rien n’a été publié.
                Vérifiez la nouvelle liste puis confirmez à nouveau.
              </p>
            ) : null}

            {result ? (
              <>
                <p role="status" className="text-sm text-stone-800">
                  <strong>{result.published}</strong> ensemble{result.published > 1 ? 's' : ''} publié
                  {result.published > 1 ? 's' : ''}
                  {result.failed > 0 ? (
                    <>
                      , <strong className="text-rose-700">{result.failed} en échec</strong>
                    </>
                  ) : null}
                  .
                </p>
                <ul role="list" className="mt-3 flex flex-col gap-1 text-sm">
                  {result.results.map((r) => (
                    <li key={r.setId} className="flex flex-wrap items-baseline gap-2">
                      <span aria-hidden="true">{r.ok ? '✓' : '⚠'}</span>
                      <span className="text-stone-800">{tupleText(r, dimensions)}</span>
                      {r.ok ? (
                        <span className="text-xs text-emerald-700">publié v{r.publishedVersion}</span>
                      ) : (
                        <span className="text-xs text-rose-700">{r.error.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : !plan ? (
              <p className="text-sm text-stone-500">Essai à blanc en cours…</p>
            ) : count === 0 ? (
              <p className="text-sm text-stone-600">Aucun brouillon importé à publier.</p>
            ) : (
              <>
                <p className="text-sm text-stone-800">
                  <strong>{count}</strong> ensemble{count > 1 ? 's' : ''} sera publié{count > 1 ? 's' : ''} :
                  {plan.truncated ? ` (limité aux ${count} premiers sur ${plan.matched})` : ''}
                </p>
                <ul role="list" aria-label="Ensembles qui seront publiés" className="mt-3 flex flex-col divide-y divide-stone-100 text-sm">
                  {plan.results.map((r) => (
                    <li key={r.setId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
                      <span className="font-medium text-stone-900">{tupleText(r, dimensions)}</span>
                      <span className="text-xs text-stone-500">
                        {r.itemCount} image{r.itemCount > 1 ? 's' : ''}
                      </span>
                      {r.replacesPublished ? (
                        <span className="text-xs text-stone-500">remplace v{r.replacesPublished.version}</span>
                      ) : (
                        <span className="text-xs text-emerald-700">nouvelle cellule</span>
                      )}
                      {r.supersedesScheduled ? (
                        <span className="text-xs text-amber-700">
                          annule la programmation
                          {r.supersedesScheduled.scheduledAt ? ` du ${formatParis(r.supersedesScheduled.scheduledAt)}` : ''}
                        </span>
                      ) : null}
                      {r.warnings.map((w) => (
                        <span key={w} className="rounded-full bg-rose-50 px-1.5 text-[11px] font-medium text-rose-800">
                          {WARNING_LABEL[w] ?? w}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
            {result ? (
              <button type="button" className={btn('primary')} onClick={onClose}>
                Fermer
              </button>
            ) : (
              <>
                <button type="button" className={btn('secondary')} onClick={onClose} disabled={busy}>
                  Annuler
                </button>
                <button
                  type="button"
                  className={btn('primary')}
                  onClick={() => void confirm()}
                  disabled={busy || !plan || count === 0}
                >
                  {count > 0 ? `Publier ${count} ensemble${count > 1 ? 's' : ''}` : 'Publier'}
                </button>
              </>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
