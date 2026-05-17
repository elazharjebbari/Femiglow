'use client';

import { useState } from 'react';
import type { ContentGenerationRun } from '@/lib/content-studio/types';
import { SectionTitle } from './SectionTitle';
import { getJson } from './api';
import { formatShortDate } from './helpers';

export function BudgetSummary() {
  const [runs, setRuns] = useState<ContentGenerationRun[]>([]);
  const [loaded, setLoaded] = useState(false);

  const totalCents = runs.reduce((sum, r) => sum + r.costCents, 0);
  const succeeded = runs.filter((r) => r.status === 'succeeded').length;
  const failed = runs.filter((r) => r.status === 'failed').length;

  function load() {
    void getJson<{ runs: ContentGenerationRun[] }>('/api/admin/content-studio/generation-runs?limit=50')
      .then((value) => {
        setRuns(value.runs);
        setLoaded(true);
      })
      .catch(() => {
        setRuns([]);
        setLoaded(true);
      });
  }

  if (!loaded) {
    return (
      <section className="rounded-md border border-amber-100 bg-amber-50/40 p-4">
        <SectionTitle
          eyebrow="Budget"
          title="Coûts de génération"
          tone="amber"
          description="Suivre les dépenses IA par run de génération."
        />
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-md bg-amber-900 px-3 py-2 text-sm font-medium text-white"
        >
          Charger les données
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-amber-100 bg-amber-50/40 p-4">
      <SectionTitle
        eyebrow="Budget"
        title="Coûts de génération"
        tone="amber"
        description="Suivre les dépenses IA par run de génération."
      />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded border border-amber-100 bg-white px-3 py-2">
          <p className="text-lg font-semibold text-amber-950">{formatCost(totalCents)}</p>
          <p className="text-[11px] text-amber-800">Coût total</p>
        </div>
        <div className="rounded border border-amber-100 bg-white px-3 py-2">
          <p className="text-lg font-semibold text-emerald-950">{succeeded}</p>
          <p className="text-[11px] text-emerald-800">Réussis</p>
        </div>
        <div className="rounded border border-amber-100 bg-white px-3 py-2">
          <p className="text-lg font-semibold text-red-950">{failed}</p>
          <p className="text-[11px] text-red-800">Échoués</p>
        </div>
      </div>
      {runs.length > 0 && (
        <div className="mt-4 overflow-hidden rounded border border-stone-200 bg-white">
          <div className="grid grid-cols-[1fr_80px_80px_80px] border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600">
            <span>Run</span>
            <span className="text-right">Coût</span>
            <span className="text-center">Statut</span>
            <span className="text-right">Date</span>
          </div>
          {runs.slice(0, 10).map((run) => (
            <div
              key={run.id}
              className="grid grid-cols-[1fr_80px_80px_80px] gap-2 border-b border-stone-100 px-3 py-2 text-xs last:border-b-0"
            >
              <span className="min-w-0 truncate text-stone-900">
                {run.provider}/{run.model}
              </span>
              <span className="text-right text-stone-700">{formatCost(run.costCents)}</span>
              <span className="text-center">
                <RunStatusBadge status={run.status} />
              </span>
              <span className="text-right text-stone-500">{formatShortDate(run.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={load}
        className="mt-3 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-50"
      >
        Rafraîchir
      </button>
    </section>
  );
}

function formatCost(cents: number): string {
  if (cents === 0) return '0 €';
  const euros = cents / 100;
  return `${euros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function RunStatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    succeeded: 'bg-emerald-50 text-emerald-800',
    failed: 'bg-red-50 text-red-800',
    fallback: 'bg-amber-50 text-amber-800',
  };
  const cls = color[status] ?? 'bg-stone-50 text-stone-600';
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}