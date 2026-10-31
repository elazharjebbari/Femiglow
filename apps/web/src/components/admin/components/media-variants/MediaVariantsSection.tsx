/**
 * MediaVariantsSection — section « Médias par audience » de
 * `/admin/components/[key]` (ancre `#medias-par-audience`).
 *
 * Rendue seulement si le composant déclare `metadata.mediaVariants`.
 * Charge `GET /media-sets` (politique, ensembles, couverture,
 * programmations bloquées) côté client, affiche la barre d'outils
 * (couverture, filtre de slot, publication des brouillons importés), le
 * bandeau des programmations bloquées, la matrice, et ouvre le tiroir
 * d'édition d'une cellule.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaVariantPolicy } from '@/lib/components/registry';
import { mediaSetsApi, type MediaSetsApi } from './api';
import { BulkPublishDialog } from './BulkPublishDialog';
import { CoverageBadge, summarizeCells } from './CoverageBadge';
import { MediaSetEditorDrawer } from './MediaSetEditorDrawer';
import { MediaVariantsMatrix } from './MediaVariantsMatrix';
import { STUCK_REASON_LABEL, cellTitle, formatParis } from './model';
import type { MediaSetsListResponse, MediaSetTuple } from './types';
import { btn } from './ui';

export const MEDIA_VARIANTS_ANCHOR = 'medias-par-audience';

interface Props {
  componentKey: string;
  /** Politique lue côté serveur ; `null` = section masquée. */
  policy: MediaVariantPolicy | null;
  /** Slots `component_media_bindings` actifs (repli niveau 7). */
  activeLegacySlots?: string[];
  /** Page publique de l'aperçu (`kit` pour le hero kit). */
  pagePath?: string;
  /** Injection pour les tests. */
  api?: MediaSetsApi;
}

export function MediaVariantsSection({
  componentKey,
  policy,
  activeLegacySlots = [],
  pagePath = 'kit',
  api: injectedApi,
}: Props): JSX.Element | null {
  const api = useMemo(() => injectedApi ?? mediaSetsApi(componentKey), [injectedApi, componentKey]);
  const legacy = useMemo(() => new Set(activeLegacySlots), [activeLegacySlots]);
  const [data, setData] = useState<MediaSetsListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [openTuple, setOpenTuple] = useState<MediaSetTuple | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  /**
   * Numéro de la dernière demande de liste : une réponse plus ancienne
   * arrivée après une plus récente est ignorée (pas de retour en arrière
   * de la matrice après une mutation) ; son appelant reçoit le résultat de
   * la demande la plus récente.
   */
  const seqRef = useRef(0);
  const latestRef = useRef<Promise<MediaSetsListResponse | null> | null>(null);

  const refresh = useCallback((): Promise<MediaSetsListResponse | null> => {
    const seq = ++seqRef.current;
    setLoading(true);
    const promise = (async (): Promise<MediaSetsListResponse | null> => {
      try {
        const res = await api.list();
        if (seq !== seqRef.current) return latestRef.current ?? null;
        setData(res);
        setLoadError(null);
        return res;
      } catch (e) {
        if (seq !== seqRef.current) return latestRef.current ?? null;
        setLoadError((e as Error).message);
        return null;
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    })();
    latestRef.current = promise;
    return promise;
  }, [api]);

  useEffect(() => {
    if (policy) void refresh();
  }, [policy, refresh]);

  // Arrivée par l'ancre (raccourci /admin/kit) : faire défiler une fois chargé.
  useEffect(() => {
    if (!data || typeof window === 'undefined') return;
    if (window.location.hash === `#${MEDIA_VARIANTS_ANCHOR}`) {
      document.getElementById(MEDIA_VARIANTS_ANCHOR)?.scrollIntoView?.({ block: 'start' });
    }
    // Une seule fois, au premier chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data !== null]);

  if (!policy) return null;

  const importDrafts = data?.sets.filter((s) => s.status === 'draft' && s.source === 'import').length ?? 0;
  const scopedCells = data
    ? data.coverage.cells.filter((c) => slotFilter === 'all' || c.slot === slotFilter)
    : [];

  return (
    <section id={MEDIA_VARIANTS_ANCHOR} aria-labelledby="hmv-heading" className="mt-10 scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
        <h2 id="hmv-heading" className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Médias par audience
        </h2>
        <span className="text-[11px] text-stone-400">
          · images du composant selon l’angle publicitaire et la langue
        </span>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          {data ? (
            <CoverageBadge
              summary={slotFilter === 'all' ? data.coverage.summary : summarizeCells(scopedCells)}
              scopeLabel={slotFilter === 'all' ? undefined : `slot ${slotFilter}`}
            />
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-stone-600">
              Slot
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
              >
                <option value="all">Tous les slots</option>
                {policy.slots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.key} ({s.kind === 'single' ? 'image unique' : 'liste'})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={btn('secondary')}
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? 'Actualisation…' : 'Actualiser'}
            </button>
            <button
              type="button"
              className={btn('primary')}
              onClick={() => setBulkOpen(true)}
              disabled={!data || importDrafts === 0}
              title={importDrafts === 0 ? 'Aucun brouillon importé en attente' : undefined}
            >
              Publier les brouillons importés{importDrafts > 0 ? ` (${importDrafts})` : ''}
            </button>
          </div>
        </div>

        {data && data.stuckScheduled.length > 0 ? (
          <div role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            <p className="font-medium">
              {data.stuckScheduled.length === 1
                ? '1 publication programmée est bloquée'
                : `${data.stuckScheduled.length} publications programmées sont bloquées`}
            </p>
            <ul role="list" className="mt-1 space-y-1">
              {data.stuckScheduled.map((s) => (
                <li key={s.setId} className="flex flex-wrap items-center gap-2 text-xs">
                  <span>
                    {cellTitle(s, s.locale, s.slot, data.dimensions)} — prévue le {formatParis(s.scheduledAt, 'long')} :{' '}
                    {STUCK_REASON_LABEL[s.reason]}
                  </span>
                  <button
                    type="button"
                    className="font-medium underline hover:no-underline"
                    onClick={() =>
                      setOpenTuple({ slot: s.slot, variantDim: s.variantDim, variantKey: s.variantKey, locale: s.locale })
                    }
                  >
                    Ouvrir la cellule
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loadError && !data ? (
          <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Impossible de charger les médias par audience : {loadError}{' '}
            <button type="button" className="font-medium underline" onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        ) : !data ? (
          <p className="text-sm text-stone-500" aria-live="polite">
            Chargement de la matrice…
          </p>
        ) : (
          <>
            {loadError ? (
              <p role="alert" className="mb-2 text-xs text-rose-700">
                Actualisation impossible : {loadError}
              </p>
            ) : null}
            <MediaVariantsMatrix
              data={data}
              slotFilter={slotFilter}
              activeLegacySlots={legacy}
              activeTuple={openTuple}
              onOpenCell={setOpenTuple}
            />
            {data.coverage.skippedDimensions.length > 0 ? (
              <p className="mt-2 text-[11px] text-stone-500">
                Dimensions non affichées (valeurs dynamiques) : {data.coverage.skippedDimensions.join(', ')}.
              </p>
            ) : null}
          </>
        )}
      </div>

      {data ? (
        <>
          <MediaSetEditorDrawer
            tuple={openTuple}
            data={data}
            api={api}
            pagePath={pagePath}
            activeLegacySlots={legacy}
            onClose={() => setOpenTuple(null)}
            onRefresh={refresh}
          />
          <BulkPublishDialog
            open={bulkOpen}
            api={api}
            dimensions={data.dimensions}
            onClose={() => setBulkOpen(false)}
            onPublished={() => void refresh()}
          />
        </>
      ) : null}
    </section>
  );
}
