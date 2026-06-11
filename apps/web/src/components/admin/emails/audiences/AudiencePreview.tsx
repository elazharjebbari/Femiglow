'use client';

/**
 * AudiencePreview — preview live de count + sample (M5.3.8).
 *
 * Hook + composant qui debounce les changements de rules (800ms) puis
 * appelle `/api/admin/emails/audiences/preview-size`. Affiche count +
 * bouton "Voir 10 exemples" qui fetch /preview-sample.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ExclusionFlags, RulesGroup } from '@/lib/mail/audiences/rules-types';

export type AudiencePreviewProps = {
  rules: RulesGroup;
  exclusionFlags?: ExclusionFlags;
  /** ms de debounce avant fetch (default 800ms). */
  debounceMs?: number;
  fetchImpl?: typeof fetch;
};

type Sample = { email: string; name: string | null; createdAt: string };
type Breakdown = { matched: number; excluded: number; deliverable: number };

function isRulesValid(g: RulesGroup): boolean {
  // Empty all → matches everyone → on évite, c'est inutile
  if (g.kind === 'all' && g.conditions.length === 0) return false;
  // Au moins une condition non-vide (tag pas vide, value renseignée, etc.)
  return g.conditions.length > 0;
}

export function AudiencePreview({
  rules,
  exclusionFlags,
  debounceMs = 800,
  fetchImpl = fetch,
}: AudiencePreviewProps) {
  const [size, setSize] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [showSamples, setShowSamples] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const fetchSize = useCallback(async () => {
    if (!isRulesValid(rules)) {
      setSize(null);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchImpl('/api/admin/emails/audiences/preview-size', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules, exclusionFlags }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { size: number; durationMs: number };
      setSize(body.size);
      setDurationMs(body.durationMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSize(null);
    } finally {
      setIsLoading(false);
    }
  }, [rules, exclusionFlags, fetchImpl]);

  // Debounce on rules change
  useEffect(() => {
    const id = setTimeout(fetchSize, debounceMs);
    return () => clearTimeout(id);
  }, [fetchSize, debounceMs]);

  const fetchSamples = useCallback(async () => {
    try {
      const res = await fetchImpl('/api/admin/emails/audiences/preview-sample', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules, exclusionFlags, limit: 10 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { samples: Sample[] };
      setSamples(body.samples);
      setShowSamples(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [rules, exclusionFlags, fetchImpl]);

  // UX-AUD-011 — détail santé du ciblage : ciblés − exclus = envoyables.
  const fetchBreakdown = useCallback(async () => {
    setBreakdownLoading(true);
    setError(null);
    try {
      const res = await fetchImpl('/api/admin/emails/audiences/preview-breakdown', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rules, exclusionFlags }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Breakdown;
      setBreakdown(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBreakdownLoading(false);
    }
  }, [rules, exclusionFlags, fetchImpl]);

  return (
    <div
      data-testid="audience-preview"
      className="rounded-md border border-stone-200 bg-white p-4"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-stone-700">Aperçu</h3>
        <button
          type="button"
          onClick={fetchSize}
          aria-label="Rafraîchir"
          data-testid="preview-refresh"
          className="text-xs text-stone-500 underline-offset-2 hover:underline"
        >
          ↻ Rafraîchir
        </button>
      </div>

      <div className="mt-2 min-h-[2.5rem]">
        {error && (
          <p className="text-sm text-red-700" role="alert" data-testid="preview-error">
            Erreur : {error}
          </p>
        )}
        {!error && isLoading && (
          <p className="text-sm text-stone-500" data-testid="preview-loading">
            Calcul en cours…
          </p>
        )}
        {!error && !isLoading && size === null && (
          <p className="text-sm italic text-stone-400" data-testid="preview-empty">
            Ajoute des critères pour voir l&apos;aperçu.
          </p>
        )}
        {!error && !isLoading && size !== null && (
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-semibold tabular-nums text-stone-900" data-testid="preview-count">
              🎯 {size.toLocaleString('fr-FR')} contact{size !== 1 ? 's' : ''}
            </p>
            {durationMs !== null && durationMs > 1000 && (
              <span className="text-xs text-stone-500">en {(durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>

      {/* UX-AUD-011 — drill-down ciblés / exclus / envoyables. */}
      {size !== null && (
        <div className="mt-2">
          {breakdown === null ? (
            <button
              type="button"
              onClick={fetchBreakdown}
              disabled={breakdownLoading}
              data-testid="show-breakdown"
              className="text-xs text-sage-700 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {breakdownLoading ? 'Calcul…' : '▾ Détailler ciblés / exclus / envoyables'}
            </button>
          ) : (
            <p className="text-xs text-stone-600" data-testid="breakdown">
              <span data-testid="breakdown-matched">
                {breakdown.matched.toLocaleString('fr-FR')} ciblé
                {breakdown.matched !== 1 ? 's' : ''}
              </span>
              {' − '}
              <span className="text-rose-700" data-testid="breakdown-excluded">
                {breakdown.excluded.toLocaleString('fr-FR')} exclu
                {breakdown.excluded !== 1 ? 's' : ''}
              </span>
              {' = '}
              <span className="font-semibold text-emerald-700" data-testid="breakdown-deliverable">
                {breakdown.deliverable.toLocaleString('fr-FR')} envoyable
                {breakdown.deliverable !== 1 ? 's' : ''}
              </span>
            </p>
          )}
        </div>
      )}

      {size !== null && size > 0 && !showSamples && (
        <button
          type="button"
          onClick={fetchSamples}
          data-testid="show-samples"
          className="mt-2 block text-xs text-sage-700 underline-offset-2 hover:underline"
        >
          ▾ Voir 10 exemples
        </button>
      )}

      {showSamples && samples.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-stone-600" data-testid="samples-list">
          {samples.map((s) => (
            <li key={s.email} className="flex items-center gap-2">
              <span className="font-mono">{s.email}</span>
              {s.name && <span className="text-stone-400">— {s.name}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
