'use client';

import { useState, useMemo } from 'react';
import {
  parseCsvImport,
  type CsvImportResult,
} from '@/lib/tracking/gtm/csv-import';
import type { GtmConfigPerEnv } from '@/lib/tracking/gtm/config-schema';
import { GtmFullscreenPreview } from './GtmFullscreenPreview';
import { IconAlert } from './GtmIcons';

interface Props {
  base?: GtmConfigPerEnv;
  onApply: (result: CsvImportResult) => void;
}

const SAMPLE = `env,variable,value
production,ga4MeasurementId,G-PROD0000
production,metaPixelId,11111111111
production,googleAdsConvLabels.purchase,AW-XXX/abc123
stage,ga4MeasurementId,G-STAGE000
preview,ga4MeasurementId,G-PREV0000`;

export function GtmCsvImport({ base, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');

  const preview: CsvImportResult | null = useMemo(() => {
    if (!csv.trim()) return null;
    try {
      return parseCsvImport(csv, base);
    } catch (err) {
      return null;
    }
  }, [csv, base]);

  function apply() {
    if (!preview) return;
    onApply(preview);
    setOpen(false);
    setCsv('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
      >
        Importer un CSV
      </button>

      <GtmFullscreenPreview
        open={open}
        onClose={() => {
          setOpen(false);
          setCsv('');
        }}
        title="Importer un CSV de variables GTM"
      >
        <div className="mx-auto flex h-full max-w-4xl flex-col gap-5 overflow-auto p-6">
          <header>
            <h2 className="text-lg font-semibold text-stone-900">Format attendu</h2>
            <p className="mt-1 text-sm text-stone-600">
              Trois colonnes : <code className="rounded bg-stone-100 px-1 font-mono text-xs">env,variable,value</code>.
              Header optionnel. Les variables inconnues sont ignorées avec un warning.
            </p>
          </header>

          <details className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
            <summary className="cursor-pointer font-medium">Exemple</summary>
            <pre className="mt-2 overflow-auto rounded bg-white p-2 font-mono text-[11px] text-stone-800">
{SAMPLE}
            </pre>
            <button
              type="button"
              onClick={() => setCsv(SAMPLE)}
              className="mt-2 text-xs text-stone-700 underline-offset-2 hover:underline"
            >
              Copier l’exemple dans le textarea
            </button>
          </details>

          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={12}
            placeholder="Colle ton CSV ici…"
            aria-label="CSV à importer"
            className="block w-full rounded-md border border-stone-300 bg-white p-3 font-mono text-xs shadow-sm focus:border-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
          />

          {preview ? (
            <section className="rounded-md border border-stone-200 bg-white px-4 py-3">
              <header className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-sm font-medium text-stone-900">Aperçu</h3>
                <span className="text-xs text-stone-600">
                  {preview.appliedCount} variable(s) appliquée(s) · {preview.skippedCount} ignorée(s)
                </span>
              </header>

              {preview.warnings.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {preview.warnings.slice(0, 8).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-amber-800">
                      <IconAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                      <span>{w}</span>
                    </li>
                  ))}
                  {preview.warnings.length > 8 ? (
                    <li className="text-[11px] text-stone-500">
                      … {preview.warnings.length - 8} autres
                    </li>
                  ) : null}
                </ul>
              ) : null}

              {preview.rows.length > 0 ? (
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="pb-1 pr-3">env</th>
                      <th className="pb-1 pr-3">variable</th>
                      <th className="pb-1">value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {preview.rows.slice(0, 12).map((r, i) => (
                      <tr key={i} className="font-mono text-[11px]">
                        <td className="py-1 pr-3 text-stone-700">{r.env}</td>
                        <td className="py-1 pr-3 text-stone-900">{r.variable}</td>
                        <td className="py-1 text-stone-600">{r.value || '∅'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={apply}
              disabled={!preview || preview.appliedCount === 0}
              className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCsv('');
              }}
              className="text-sm text-stone-600 hover:text-stone-900"
            >
              Annuler
            </button>
          </div>
        </div>
      </GtmFullscreenPreview>
    </>
  );
}
