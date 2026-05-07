'use client';

import { useMemo, useState } from 'react';
import {
  GTM_ENVS,
  type GtmConfigVersion,
  type GtmEnv,
  type GtmEnvConfigDTO,
} from '@/lib/tracking/gtm/config-schema';

interface Props {
  a: GtmConfigVersion;
  b: GtmConfigVersion;
  /** Étiquettes affichées en header (par défaut "v3 (active)" et "v2"). */
  labelA?: string;
  labelB?: string;
}

interface DiffRow {
  env: GtmEnv;
  field: string;
  valueA: string;
  valueB: string;
  changed: boolean;
}

const FIELDS: Array<{ key: keyof GtmEnvConfigDTO | string; label: string }> = [
  { key: 'ga4MeasurementId', label: 'GA4 Measurement ID' },
  { key: 'metaPixelId', label: 'Meta Pixel ID' },
  { key: 'tiktokPixelId', label: 'TikTok Pixel ID' },
  { key: 'snapPixelId', label: 'Snap Pixel ID' },
  { key: 'pinterestTagId', label: 'Pinterest Tag ID' },
  { key: 'googleAdsCustomerId', label: 'Ads Customer ID' },
  { key: 'googleAdsConvLabels.purchase', label: 'Ads Conv — Purchase' },
  { key: 'googleAdsConvLabels.lead', label: 'Ads Conv — Lead' },
  { key: 'googleAdsConvLabels.signup', label: 'Ads Conv — Sign Up' },
  { key: 'googleAdsConvLabels.initCheckout', label: 'Ads Conv — Init Checkout' },
  { key: 'defaultCurrency', label: 'Currency' },
  { key: 'cookieDomain', label: 'Cookie domain' },
  { key: 'enabledProviders', label: 'Providers activés' },
];

function getValue(cfg: GtmEnvConfigDTO, key: string): string {
  if (key === 'enabledProviders') {
    return [...(cfg.enabledProviders ?? [])].sort().join(', ') || '∅';
  }
  if (key.startsWith('googleAdsConvLabels.')) {
    const sub = key.slice('googleAdsConvLabels.'.length) as keyof NonNullable<
      GtmEnvConfigDTO['googleAdsConvLabels']
    >;
    return cfg.googleAdsConvLabels?.[sub] ?? '';
  }
  const v = cfg[key as keyof GtmEnvConfigDTO];
  if (typeof v === 'string') return v;
  return '';
}

function diffOf(a: GtmConfigVersion, b: GtmConfigVersion): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const env of GTM_ENVS) {
    for (const f of FIELDS) {
      const va = getValue(a.perEnv[env], String(f.key));
      const vb = getValue(b.perEnv[env], String(f.key));
      rows.push({
        env,
        field: f.label,
        valueA: va,
        valueB: vb,
        changed: va !== vb,
      });
    }
  }
  return rows;
}

export function GtmConfigDiff({ a, b, labelA, labelB }: Props) {
  const [diffOnly, setDiffOnly] = useState(true);
  const rows = useMemo(() => diffOf(a, b), [a, b]);
  const visible = diffOnly ? rows.filter((r) => r.changed) : rows;
  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-900">
            Comparaison : <span className="font-mono">{labelA ?? a.name}</span> ↔{' '}
            <span className="font-mono">{labelB ?? b.name}</span>
          </p>
          <p className="text-xs text-stone-500">
            {changedCount} champ(s) modifié(s) sur {rows.length}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-stone-700">
          <input
            type="checkbox"
            checked={diffOnly}
            onChange={(e) => setDiffOnly(e.target.checked)}
            className="rounded border-stone-300"
          />
          Différences seulement
        </label>
      </header>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
          Aucune différence entre ces deux versions.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-left">
              <tr className="border-b border-stone-200 text-stone-600">
                <th className="sticky left-0 bg-stone-50 px-3 py-2 font-medium">env</th>
                <th className="px-3 py-2 font-medium">Variable</th>
                <th className="px-3 py-2 font-medium">{labelA ?? a.name}</th>
                <th className="px-3 py-2 font-medium">{labelB ?? b.name}</th>
                <th className="px-3 py-2 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((r, i) => (
                <tr
                  key={i}
                  className={r.changed ? 'bg-[#A8C4A6]/15' : ''}
                  data-changed={r.changed ? '1' : '0'}
                >
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-mono text-[11px] text-stone-700">
                    {r.env}
                  </td>
                  <td className="px-3 py-1.5 text-stone-900">{r.field}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-stone-800">
                    {r.valueA || <span className="text-stone-400">∅</span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-stone-800">
                    {r.valueB || <span className="text-stone-400">∅</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    {r.changed ? (
                      <span className="text-[#3F5B41]" aria-label="modifié">●</span>
                    ) : (
                      <span className="text-stone-300" aria-label="identique">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
