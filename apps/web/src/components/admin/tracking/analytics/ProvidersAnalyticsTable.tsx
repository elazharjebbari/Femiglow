'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * T33 — Tableau ROI / health par provider sur 7 jours.
 * Refresh auto toutes les 30s (C4.T.2).
 */

interface ProviderAnalyticsRow {
  kind: string;
  total7d: number;
  sent7d: number;
  failed7d: number;
  errors24h: number;
  successRate7d: number;
  avgLatencyMs: number | null;
  conversions7d: number;
}

interface AnalyticsResponse {
  providers: ProviderAnalyticsRow[];
  generatedAt: string;
}

const REFRESH_MS = 30_000;

function StatusBadge({ rate, errors }: { rate: number; errors: number }) {
  if (errors > 20) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        ❌ critique
      </span>
    );
  }
  if (rate < 0.95) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        ⚠ dégradé
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      ✅ ok
    </span>
  );
}

export function ProvidersAnalyticsTable() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/tracking/analytics/providers', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as AnalyticsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handle = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(handle);
  }, [refresh]);

  if (loading && !data) {
    return (
      <p className="text-sm text-stone-500" aria-busy="true">
        Chargement…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      {data?.providers.length === 0 ? (
        <p className="text-sm text-stone-500">
          Aucune donnée provider sur les 7 derniers jours.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table
          className="min-w-full divide-y divide-stone-200 text-sm"
          data-testid="providers-analytics-table"
        >
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Provider
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Total 7j
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Sent
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Failed
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Success
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Errors 24h
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Latency avg
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-stone-500">
                Conv. 7j
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                Statut
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {data?.providers.map((p) => (
              <tr key={p.kind}>
                <td className="px-3 py-2 font-mono text-xs text-stone-900">{p.kind}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.total7d}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-emerald-700">
                  {p.sent7d}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-red-700">
                  {p.failed7d}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {(p.successRate7d * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.errors24h}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {p.avgLatencyMs != null ? `${Math.round(p.avgLatencyMs)}ms` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{p.conversions7d}</td>
                <td className="px-3 py-2">
                  <StatusBadge rate={p.successRate7d} errors={p.errors24h} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.generatedAt ? (
        <p className="text-[11px] text-stone-400">
          Généré à {new Date(data.generatedAt).toLocaleString('fr-FR')} —
          refresh auto 30s.
        </p>
      ) : null}
    </div>
  );
}
