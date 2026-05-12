'use client';

/**
 * SeedersRunner — UI client pour /admin/settings/seeders.
 *
 * Fonctionnalités :
 * 1. Liste des 16 seeders, regroupés par groupe (core/commerce/content/chat/tracking)
 * 2. Cases à cocher pour sélectionner / désélectionner
 * 3. Boutons « Tout cocher / Tout décocher »
 * 4. Bouton « Lancer » → POST /api/admin/seeders/run, ouvre flux SSE
 * 5. Barre de progression globale (ETA) + barre par seeder en cours
 * 6. Liste des étapes (label + fraction) live
 * 7. Bouton « Annuler » durant l'exécution
 * 8. État de résultat final (succeeded / failed / skipped)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  JobStatus,
  SeederEvent,
  SeederGroup,
  SeederResult,
} from '@/lib/seeders/types';

interface SeederSummary {
  id: string;
  group: SeederGroup;
  label: string;
  description: string;
  estimatedDurationMs: number;
  idempotent: boolean;
}

interface PerSeederState {
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  progressLabel?: string;
  progressFraction?: number;
  durationMs?: number;
  resultSummary?: string;
  errorMessage?: string;
  stats?: Record<string, number | string>;
}

interface SeedersRunnerProps {
  seeders: SeederSummary[];
}

const GROUP_LABEL: Record<SeederGroup, string> = {
  core: 'Cœur (sections app_config)',
  commerce: 'Commerce',
  content: 'Contenu éditorial',
  chat: 'Chat conversationnel',
  tracking: 'Analytics & tracking',
};

const GROUP_COLOR: Record<SeederGroup, string> = {
  core: 'bg-stone-100 text-stone-700',
  commerce: 'bg-emerald-100 text-emerald-800',
  content: 'bg-violet-100 text-violet-800',
  chat: 'bg-rose-100 text-rose-800',
  tracking: 'bg-sky-100 text-sky-800',
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export function SeedersRunner({ seeders }: SeedersRunnerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(seeders.map((s) => s.id)),
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | 'idle'>('idle');
  const [perSeeder, setPerSeeder] = useState<Record<string, PerSeederState>>({});
  const [currentSeederId, setCurrentSeederId] = useState<string | null>(null);
  const [globalEta, setGlobalEta] = useState<number>(0);
  const [globalElapsed, setGlobalElapsed] = useState<number>(0);
  const [finalReport, setFinalReport] = useState<{
    succeeded: number;
    failed: number;
    skipped: number;
    durationMs: number;
  } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const groups = useMemo(() => {
    const map = new Map<SeederGroup, SeederSummary[]>();
    for (const s of seeders) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return Array.from(map.entries());
  }, [seeders]);

  const selectedEta = useMemo(() => {
    return seeders
      .filter((s) => selected.has(s.id))
      .reduce((sum, s) => sum + s.estimatedDurationMs, 0);
  }, [seeders, selected]);

  const isRunning = status === 'running' || status === 'pending';

  // Ticker pour rafraîchir l'ETA toutes les 200ms pendant le job.
  useEffect(() => {
    if (!isRunning || !startedAt) return;
    tickerRef.current = setInterval(() => {
      setGlobalElapsed(Date.now() - startedAt);
    }, 200);
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      tickerRef.current = null;
    };
  }, [isRunning, startedAt]);

  // Cleanup à l'unmount.
  useEffect(() => {
    return () => {
      if (esRef.current) esRef.current.close();
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const handleEvent = useCallback(
    (ev: SeederEvent) => {
      switch (ev.type) {
        case 'job.start':
          setGlobalEta(ev.etaMs);
          break;
        case 'seeder.start':
          setCurrentSeederId(ev.id);
          setPerSeeder((prev) => ({
            ...prev,
            [ev.id]: { ...(prev[ev.id] ?? {}), status: 'running' },
          }));
          break;
        case 'seeder.progress':
          setPerSeeder((prev) => ({
            ...prev,
            [ev.id]: {
              ...(prev[ev.id] ?? { status: 'running' }),
              status: 'running',
              progressLabel: ev.stepLabel,
              progressFraction: ev.fraction,
            },
          }));
          break;
        case 'seeder.complete': {
          const result = ev.result as SeederResult;
          setPerSeeder((prev) => ({
            ...prev,
            [ev.id]: {
              ...(prev[ev.id] ?? {}),
              status: 'done',
              durationMs: ev.durationMs,
              resultSummary: result.summary,
              stats: result.stats,
              progressFraction: 1,
            },
          }));
          break;
        }
        case 'seeder.error':
          setPerSeeder((prev) => ({
            ...prev,
            [ev.id]: {
              ...(prev[ev.id] ?? {}),
              status: 'failed',
              durationMs: ev.durationMs,
              errorMessage: ev.message,
            },
          }));
          break;
        case 'seeder.skipped':
          setPerSeeder((prev) => ({
            ...prev,
            [ev.id]: {
              ...(prev[ev.id] ?? {}),
              status: 'skipped',
              errorMessage: ev.reason,
            },
          }));
          break;
        case 'job.complete':
          setStatus('completed');
          setFinalReport({
            succeeded: ev.succeeded,
            failed: ev.failed,
            skipped: ev.skipped,
            durationMs: ev.durationMs,
          });
          setCurrentSeederId(null);
          break;
        case 'job.cancelled':
          setStatus('cancelled');
          setCurrentSeederId(null);
          break;
      }
    },
    [],
  );

  const startStream = useCallback(
    (newJobId: string) => {
      const es = new EventSource(
        `/api/admin/seeders/jobs/${newJobId}/stream`,
        { withCredentials: true },
      );
      esRef.current = es;

      const eventTypes = [
        'job.start',
        'seeder.start',
        'seeder.progress',
        'seeder.complete',
        'seeder.error',
        'seeder.skipped',
        'job.complete',
        'job.cancelled',
      ] as const;

      for (const t of eventTypes) {
        es.addEventListener(t, (raw: MessageEvent) => {
          try {
            const parsed = JSON.parse(raw.data) as SeederEvent;
            handleEvent(parsed);
          } catch {
            /* skip */
          }
        });
      }
      es.addEventListener('done', () => {
        es.close();
        esRef.current = null;
      });
      es.onerror = () => {
        // SSE peut couper : on laisse onerror gérer la retentative implicite
        // d'EventSource (3s par défaut).
      };
    },
    [handleEvent],
  );

  const handleRun = useCallback(async () => {
    if (selected.size === 0) return;
    setSubmitError(null);
    setFinalReport(null);
    setPerSeeder(
      Object.fromEntries(
        Array.from(selected).map((id) => [id, { status: 'pending' }]),
      ),
    );
    setStatus('pending');
    setStartedAt(Date.now());
    setGlobalElapsed(0);

    try {
      const res = await fetch('/api/admin/seeders/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = (await res.json()) as {
        jobId: string;
        etaMs: number;
      };
      setJobId(data.jobId);
      setGlobalEta(data.etaMs);
      setStatus('running');
      startStream(data.jobId);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Erreur réseau inconnue',
      );
      setStatus('idle');
    }
  }, [selected, startStream]);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/admin/seeders/jobs/${jobId}/cancel`, {
      method: 'POST',
      credentials: 'include',
    });
  }, [jobId]);

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelected(new Set(seeders.map((s) => s.id)));
      else setSelected(new Set());
    },
    [seeders],
  );

  const toggleOne = useCallback(
    (id: string, checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [],
  );

  const globalProgressPercent = useMemo(() => {
    if (!isRunning && status !== 'completed' && status !== 'cancelled') return 0;
    if (status === 'completed' || status === 'cancelled') return 100;
    if (globalEta <= 0) return 0;
    return Math.min(99, Math.round((globalElapsed / globalEta) * 100));
  }, [isRunning, status, globalElapsed, globalEta]);

  const etaRemaining = Math.max(0, globalEta - globalElapsed);

  return (
    <div className="space-y-6">
      {/* En-tête + bouton lancer */}
      <div className="rounded-md border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              Sélection
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              <span className="font-medium tabular-nums">{selected.size}</span>{' '}
              / {seeders.length} feeds sélectionnés · ETA total estimé{' '}
              <span className="font-medium tabular-nums">
                {fmtDuration(selectedEta)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => toggleAll(true)}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-400 disabled:opacity-50"
            >
              Tout cocher
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => toggleAll(false)}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-400 disabled:opacity-50"
            >
              Tout décocher
            </button>
            {!isRunning ? (
              <button
                type="button"
                onClick={handleRun}
                disabled={selected.size === 0}
                data-testid="seeders-run-button"
                className="rounded bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Lancer ({selected.size})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancel}
                data-testid="seeders-cancel-button"
                className="rounded bg-rose-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-rose-800"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        {submitError ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {submitError}
          </p>
        ) : null}

        {/* Progression globale */}
        {(isRunning || status === 'completed' || status === 'cancelled') && (
          <div className="mt-5 space-y-2" data-testid="seeders-global-progress">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium uppercase tracking-wide text-stone-600">
                {status === 'completed'
                  ? '✓ Terminé'
                  : status === 'cancelled'
                    ? '⚠ Annulé'
                    : currentSeederId
                      ? `En cours : ${seeders.find((s) => s.id === currentSeederId)?.label ?? currentSeederId}`
                      : 'Démarrage…'}
              </span>
              <span className="tabular-nums text-stone-500">
                {fmtDuration(globalElapsed)}
                {isRunning && ` · reste ~${fmtDuration(etaRemaining)}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className={`h-full transition-all duration-500 ${
                  status === 'completed'
                    ? 'bg-emerald-500'
                    : status === 'cancelled'
                      ? 'bg-amber-500'
                      : 'bg-stone-700'
                }`}
                style={{ width: `${globalProgressPercent}%` }}
              />
            </div>
            {finalReport && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-800">
                  ✓ {finalReport.succeeded} réussis
                </span>
                {finalReport.failed > 0 && (
                  <span className="rounded bg-rose-100 px-2 py-1 font-medium text-rose-800">
                    ✗ {finalReport.failed} échoués
                  </span>
                )}
                {finalReport.skipped > 0 && (
                  <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-800">
                    ⊘ {finalReport.skipped} ignorés
                  </span>
                )}
                <span className="rounded bg-stone-100 px-2 py-1 font-medium text-stone-700">
                  ⏱ {fmtDuration(finalReport.durationMs)} total
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liste par groupe */}
      {groups.map(([group, items]) => (
        <section
          key={group}
          className="rounded-md border border-stone-200 bg-white p-5"
        >
          <header className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${GROUP_COLOR[group]}`}
            >
              {group}
            </span>
            <h2 className="text-sm font-semibold text-stone-900">
              {GROUP_LABEL[group]}
            </h2>
            <span className="ml-auto text-xs text-stone-500">
              {items.length} feed{items.length > 1 ? 's' : ''}
            </span>
          </header>
          <ul className="divide-y divide-stone-100">
            {items.map((s) => {
              const state = perSeeder[s.id];
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start"
                  data-testid={`seeder-row-${s.id}`}
                >
                  <label className="flex flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      disabled={isRunning}
                      onChange={(e) => toggleOne(s.id, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500 disabled:opacity-50"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-stone-900">
                          {s.label}
                        </span>
                        <code className="text-[11px] text-stone-500">
                          {s.id}
                        </code>
                        <span className="text-[11px] text-stone-500">
                          ~{fmtDuration(s.estimatedDurationMs)}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{s.description}</p>
                      {/* État live */}
                      {state && (
                        <div className="mt-2 space-y-1">
                          {state.status === 'running' &&
                          state.progressLabel ? (
                            <p className="text-xs text-stone-600">
                              ⟳ {state.progressLabel}
                              {state.progressFraction != null &&
                                ` (${Math.round(state.progressFraction * 100)}%)`}
                            </p>
                          ) : null}
                          {state.status === 'done' && (
                            <p className="text-xs text-emerald-700">
                              ✓ {state.resultSummary}{' '}
                              {state.durationMs != null && (
                                <span className="text-stone-500">
                                  · {fmtDuration(state.durationMs)}
                                </span>
                              )}
                            </p>
                          )}
                          {state.status === 'failed' && (
                            <p className="text-xs text-rose-700">
                              ✗ {state.errorMessage ?? 'erreur'}
                            </p>
                          )}
                          {state.status === 'skipped' && (
                            <p className="text-xs text-amber-700">
                              ⊘ ignoré ({state.errorMessage ?? 'cancelled'})
                            </p>
                          )}
                          {state.status === 'pending' && (
                            <p className="text-xs text-stone-500">⌛ en attente</p>
                          )}
                          {/* Barre individuelle (running ou done) */}
                          {(state.status === 'running' ||
                            state.status === 'done') && (
                            <div className="h-1 overflow-hidden rounded-full bg-stone-100">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  state.status === 'done'
                                    ? 'bg-emerald-500'
                                    : 'bg-stone-700'
                                }`}
                                style={{
                                  width: `${Math.round(
                                    (state.progressFraction ?? 0) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
