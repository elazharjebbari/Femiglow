/**
 * MediaSetPreviewDialog — aperçu brouillon d'une cellule + diagnostic.
 *
 *  - Aperçu : iframe `/{locale}/kit?angle=<k>&hmv_preview=draft` (locale
 *    `fr` pour la colonne `*`). `hmv_preview=draft` n'est honoré qu'avec une
 *    session admin et n'émet aucun événement serveur ; le middleware
 *    autorise le cadrage same-origin pour cette URL. Bascule mobile/desktop
 *    (largeurs de `preview-protocol`, comme `PreviewFrame`).
 *  - Diagnostic : `GET resolve` pour la même audience — niveau de repli
 *    atteint par slot, ensemble retenu, valeur `hero_media_variant`.
 *    Bascule brouillon (ce que montre l'aperçu) / public (cache réel).
 */
'use client';

import { useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { PREVIEW_WIDTH_PX, type PreviewWidth } from '../preview-protocol';
import type { MediaSetsApi } from './api';
import {
  cellTitle,
  levelLabel,
  previewLocale,
  previewUrl,
  resolveVariants,
  shortVariantLabel,
} from './model';
import type {
  MatrixRow,
  MediaSetResolveResponse,
  MediaSetTuple,
  MediaVariantDimensionJson,
} from './types';
import { Thumb, btn } from './ui';

const WIDTHS: { id: Extract<PreviewWidth, 'mobile' | 'desktop'>; label: string }[] = [
  { id: 'mobile', label: 'Mobile (375 px)' },
  { id: 'desktop', label: 'Desktop' },
];

interface Props {
  open: boolean;
  tuple: MediaSetTuple | null;
  api: MediaSetsApi;
  dimensions: MediaVariantDimensionJson[];
  pagePath: string;
  onClose: () => void;
}

export function MediaSetPreviewDialog({ open, tuple, api, dimensions, pagePath, onClose }: Props): JSX.Element {
  const [width, setWidth] = useState<'mobile' | 'desktop'>('mobile');
  const [draft, setDraft] = useState(true);
  const [diag, setDiag] = useState<MediaSetResolveResponse | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  const row: MatrixRow | null = tuple ? { variantDim: tuple.variantDim, variantKey: tuple.variantKey } : null;
  const src = row && tuple ? previewUrl(row, tuple.locale, pagePath) : '';

  useEffect(() => {
    if (!open || !row || !tuple) return;
    let cancelled = false;
    setDiag(null);
    setDiagError(null);
    api
      .resolve({ locale: previewLocale(tuple.locale), variants: resolveVariants(row), draft })
      .then((res) => {
        if (!cancelled) setDiag(res);
      })
      .catch((e: Error) => {
        if (!cancelled) setDiagError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, api, tuple?.slot, tuple?.variantDim, tuple?.variantKey, tuple?.locale, draft, frameKey]);

  const px = PREVIEW_WIDTH_PX[width];

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-stone-900/50" />
        <RadixDialog.Content className="fixed inset-2 z-[60] flex flex-col overflow-hidden rounded-lg bg-white shadow-xl focus:outline-none sm:inset-6">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
            <div className="min-w-0">
              <RadixDialog.Title className="text-base font-semibold text-stone-900">
                Aperçu — {tuple ? cellTitle(row!, tuple.locale, tuple.slot, dimensions) : ''}
              </RadixDialog.Title>
              <RadixDialog.Description className="mt-0.5 text-xs text-stone-500">
                Brouillons inclus (session admin). Page :{' '}
                <code className="break-all font-mono">{src}</code>
                {row && row.variantDim === 'default'
                  ? ' — sans angle dans l’URL : un angle mémorisé dans ce navigateur (cookie fg_angle) peut s’appliquer.'
                  : ''}
              </RadixDialog.Description>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Largeur de l’aperçu" className="inline-flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-xs">
                {WIDTHS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={width === w.id}
                    onClick={() => setWidth(w.id)}
                    className={`rounded px-2.5 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                      width === w.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <button type="button" className={btn('secondary')} onClick={() => setFrameKey((k) => k + 1)}>
                Recharger
              </button>
              <a href={src} target="_blank" rel="noreferrer" className={btn('secondary')}>
                Ouvrir dans un onglet
              </a>
              <RadixDialog.Close asChild>
                <button type="button" className={btn('primary')}>
                  Fermer
                </button>
              </RadixDialog.Close>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="flex min-h-[420px] flex-1 justify-center overflow-auto bg-stone-100 p-3">
              {open && src ? (
                <iframe
                  key={frameKey}
                  src={src}
                  title="Aperçu de la page avec les brouillons"
                  className="h-full min-h-[600px] rounded-md border border-stone-200 bg-white"
                  style={px ? { width: `${px}px`, maxWidth: '100%' } : { width: '100%' }}
                />
              ) : null}
            </div>

            <aside
              aria-labelledby="hmv-diag-title"
              className="w-full shrink-0 overflow-y-auto border-t border-stone-200 p-4 lg:w-80 lg:border-l lg:border-t-0"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 id="hmv-diag-title" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Diagnostic
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-stone-700">
                  <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
                  Inclure les brouillons
                </label>
              </div>
              {diagError ? (
                <p role="alert" className="mt-2 text-sm text-rose-700">
                  {diagError}
                </p>
              ) : !diag ? (
                <p className="mt-2 text-sm text-stone-500" aria-live="polite">
                  Résolution en cours…
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-3 text-sm" aria-live="polite">
                  <p className="text-xs text-stone-600">
                    <span className="font-medium">hero_media_variant</span> :{' '}
                    <code className="font-mono text-stone-900">{diag.trackingValue}</code>
                  </p>
                  <ul role="list" className="flex flex-col gap-2">
                    {diag.slots.map((s) => (
                      <li key={s.slot} className="rounded-md border border-stone-200 p-2">
                        <p className="flex items-center justify-between gap-2">
                          <code className="font-mono text-xs text-stone-500">{s.slot}</code>
                          <span
                            className={`rounded-full px-1.5 text-[10px] font-semibold ${
                              s.level <= 3
                                ? 'bg-emerald-50 text-emerald-800'
                                : s.level <= 6
                                  ? 'bg-sky-50 text-sky-800'
                                  : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            niveau {s.level}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-stone-700">{levelLabel(s.level)}</p>
                        {s.trace && s.trace.variantDim ? (
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            Ensemble : {shortVariantLabel(s.trace.variantDim, s.trace.variantKey ?? '*')} ·{' '}
                            {s.trace.locale} · v{s.trace.version}
                          </p>
                        ) : null}
                        {s.images && s.images.length > 0 ? (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {s.images.map((img) => (
                              <Thumb key={img.id} src={img.src} alt={img.alt} size="xs" />
                            ))}
                          </span>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            Délégué au composant (liaisons existantes, puis image produit).
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
