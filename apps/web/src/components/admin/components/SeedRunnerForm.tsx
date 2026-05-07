'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SeedReport {
  components: { synced: number };
  animations: { synced: number };
  images: {
    total: number;
    seeded: number;
    skipped: number;
    activated: number;
    unmapped: string[];
    errors: Array<{ path: string; error: string }>;
  };
  durationMs: number;
}

type SeedPhase = 'registry' | 'animations' | 'images';

type SeedEvent =
  | { type: 'phase'; phase: SeedPhase; total: number; message: string }
  | {
      type: 'item';
      phase: SeedPhase;
      current: number;
      total: number;
      item: string;
      status: 'seeded' | 'forced' | 'skipped' | 'error' | 'unmapped' | 'synced';
      message?: string;
    }
  | { type: 'done'; report: SeedReport }
  | { type: 'error'; error: string };

const PAGE_GROUPS = ['', 'home', 'rituel', 'kit', 'maison', 'journal', 'shared'];

const PHASE_LABEL: Record<SeedPhase, string> = {
  registry: 'Registre des composants',
  animations: 'Profils d’animation',
  images: 'Images & variantes',
};

interface ProgressState {
  phase: SeedPhase;
  phaseMessage: string;
  current: number;
  total: number;
  lastItem: string | null;
  lastStatus:
    | 'seeded'
    | 'forced'
    | 'skipped'
    | 'error'
    | 'unmapped'
    | 'synced'
    | null;
  errors: number;
}

const INITIAL_PROGRESS: ProgressState = {
  phase: 'registry',
  phaseMessage: '',
  current: 0,
  total: 0,
  lastItem: null,
  lastStatus: null,
  errors: 0,
};

export function SeedRunnerForm() {
  const router = useRouter();
  const [autoActivate, setAutoActivate] = useState(false);
  const [force, setForce] = useState(false);
  const [forceAlt, setForceAlt] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [filterPageGroup, setFilterPageGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SeedReport | null>(null);
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const abortRef = useRef<AbortController | null>(null);

  // Quand un rapport arrive en mode "réel" (non dry-run), on rafraîchit
  // les données serveur. Effet dédié → pas de mutation routeur en plein
  // rendu.
  useEffect(() => {
    if (report && !dryRun) router.refresh();
  }, [report, dryRun, router]);

  const handleEvent = useCallback((event: SeedEvent) => {
    if (event.type === 'phase') {
      setProgress((prev) => ({
        ...prev,
        phase: event.phase,
        phaseMessage: event.message,
        current: 0,
        total: event.total,
        // ne réinitialise pas `errors` : on cumule sur tout le run.
      }));
    } else if (event.type === 'item') {
      setProgress((prev) => ({
        ...prev,
        phase: event.phase,
        current: event.current,
        total: event.total,
        lastItem: event.item,
        lastStatus: event.status,
        errors: prev.errors + (event.status === 'error' ? 1 : 0),
      }));
    } else if (event.type === 'done') {
      setReport(event.report);
    } else if (event.type === 'error') {
      setError(event.error);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setProgress(INITIAL_PROGRESS);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/admin/components/seed-from-docs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          autoActivate,
          force,
          forceAlt,
          dryRun,
          ...(filterPageGroup ? { filterPageGroup } : {}),
        }),
      });

      // Erreur synchrone (auth, rate-limit, validation) — réponse JSON
      // classique, pas de stream.
      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok && !contentType.includes('x-ndjson')) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(json.error?.message ?? `Erreur ${res.status}`);
        return;
      }
      if (!res.body) {
        setError('Réponse vide du serveur');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // NDJSON : on découpe sur \n et on garde la dernière ligne (incomplète)
        // dans le buffer.
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const event = JSON.parse(line) as SeedEvent;
            handleEvent(event);
          } catch {
            // ligne corrompue : on ignore silencieusement
          }
        }
      }
      // Drain : si une dernière ligne n'avait pas de \n
      const tail = buffer.trim();
      if (tail) {
        try {
          handleEvent(JSON.parse(tail) as SeedEvent);
        } catch {
          /* ignore */
        }
      }

      // Si on a reçu un rapport ET qu'on n'était pas en dry-run, le
      // `router.refresh()` est déclenché par l'effet ci-dessous (on évite
      // d'appeler une mutation routeur depuis un updater de setState).
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleAbort() {
    abortRef.current?.abort();
  }

  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  // Message d'état final (succès / échec / partiel)
  const finalState: 'success' | 'partial' | 'error' | null = report
    ? report.images.errors.length === 0
      ? 'success'
      : 'partial'
    : error
      ? 'error'
      : null;

  return (
    <section
      aria-labelledby="seed-form-heading"
      className="rounded-lg border border-stone-200 bg-white p-5"
    >
      <h2
        id="seed-form-heading"
        className="text-sm font-semibold uppercase tracking-wider text-stone-700"
      >
        Lancer le seed
      </h2>
      <p className="mt-1 text-xs text-stone-500">
        Activez le mode <em>Dry-run</em> pour simuler le run sans modifier la DB.
        Si tout est OK, désactivez-le et relancez.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="sr-only">Options</legend>

          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300"
            />
            <span>
              <span className="font-medium">Dry-run</span>
              <span className="block text-xs text-stone-500">
                Simule sans toucher à la DB ni aux fichiers stockés.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={autoActivate}
              onChange={(e) => setAutoActivate(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300"
            />
            <span>
              <span className="font-medium">Auto-activer les bindings</span>
              <span className="block text-xs text-stone-500">
                Par défaut, les bindings sont créés <code>isActive=false</code>{' '}
                (rollback safe).
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300"
            />
            <span>
              <span className="font-medium">Régénérer les variants</span>
              <span className="block text-xs text-stone-500">
                Force <code>optimizeImage</code> même si le slug existe.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={forceAlt}
              onChange={(e) => setForceAlt(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300"
            />
            <span>
              <span className="font-medium">Sur-écrire les alt</span>
              <span className="block text-xs text-stone-500">
                Remplace les alt existants par ceux de <code>seed-alt.ts</code>.
              </span>
            </span>
          </label>
        </fieldset>

        <label className="block text-sm">
          <span className="text-stone-700">Filtrer par page</span>
          <select
            value={filterPageGroup}
            onChange={(e) => setFilterPageGroup(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 disabled:opacity-60"
          >
            {PAGE_GROUPS.map((g) => (
              <option key={g || 'all'} value={g}>
                {g === '' ? 'Toutes les pages' : g}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Spinner /> : null}
            {busy
              ? 'Exécution…'
              : dryRun
                ? 'Lancer le dry-run'
                : 'Lancer le seed'}
          </button>
          {busy && (
            <button
              type="button"
              onClick={handleAbort}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Annuler
            </button>
          )}
          {!dryRun && !busy && (
            <span className="text-xs text-amber-700">
              ⚠ Mode réel : la DB et le storage seront modifiés.
            </span>
          )}
        </div>
      </form>

      {(busy || progress.total > 0) && !report && !error && (
        <ProgressPanel progress={progress} percent={percent} dryRun={dryRun} />
      )}

      {finalState === 'error' && error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <div className="flex items-center gap-2">
            <CrossIcon />
            <strong className="font-semibold">Échec du seed</strong>
          </div>
          <p className="mt-1 text-rose-700">{error}</p>
        </div>
      )}

      {report && (
        <ReportCard report={report} state={finalState ?? 'success'} />
      )}
    </section>
  );
}

// -- Sous-composants ---------------------------------------------------------

function Spinner(): JSX.Element {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      className="h-5 w-5 text-emerald-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.59a1 1 0 0 1-1.42.005l-3.5-3.5a1 1 0 1 1 1.42-1.41l2.79 2.79 6.79-6.88a1 1 0 0 1 1.414-.009Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CrossIcon(): JSX.Element {
  return (
    <svg
      className="h-5 w-5 text-rose-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L8.586 10l-3.775 3.775a1 1 0 1 0 1.414 1.414L10 11.414l3.775 3.775a1 1 0 0 0 1.414-1.414L11.414 10l3.775-3.775a1 1 0 1 0-1.414-1.414L10 8.586 6.225 4.811Z" />
    </svg>
  );
}

function WarningIcon(): JSX.Element {
  return (
    <svg
      className="h-5 w-5 text-amber-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495a1.75 1.75 0 0 1 3.03 0l6.28 10.875A1.75 1.75 0 0 1 16.28 16H3.72a1.75 1.75 0 0 1-1.515-2.63l6.28-10.875ZM10 7a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 10 7Zm0 6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StatusDot({
  status,
}: {
  status: ProgressState['lastStatus'];
}): JSX.Element {
  const map: Record<NonNullable<ProgressState['lastStatus']>, string> = {
    seeded: 'bg-emerald-500',
    forced: 'bg-sky-500',
    skipped: 'bg-stone-400',
    error: 'bg-rose-500',
    unmapped: 'bg-amber-500',
    synced: 'bg-emerald-500',
  };
  const color = status ? map[status] : 'bg-stone-300';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden="true" />;
}

function ProgressPanel({
  progress,
  percent,
  dryRun,
}: {
  progress: ProgressState;
  percent: number;
  dryRun: boolean;
}): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mt-4 rounded-md border border-stone-200 bg-gradient-to-b from-stone-50 to-white p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          {PHASE_LABEL[progress.phase]}
          {dryRun && (
            <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-normal tracking-normal text-stone-500">
              dry-run
            </span>
          )}
        </p>
        <p className="font-mono text-xs text-stone-700" aria-label="Progression">
          {progress.current}/{progress.total || '…'}
          <span className="ml-2 text-stone-500">{percent}%</span>
        </p>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-stone-600 via-stone-700 to-stone-900 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(percent, progress.total > 0 ? 4 : 0)}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <StatusDot status={progress.lastStatus} />
        <span
          className="truncate font-mono text-stone-600"
          title={progress.lastItem ?? ''}
        >
          {progress.lastItem ?? progress.phaseMessage ?? 'En cours…'}
        </span>
      </div>

      {progress.errors > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-rose-700">
          <WarningIcon />
          {progress.errors} erreur{progress.errors > 1 ? 's' : ''} en cours
          d’exécution
        </p>
      )}
    </div>
  );
}

function ReportCard({
  report,
  state,
}: {
  report: SeedReport;
  state: 'success' | 'partial' | 'error';
}): JSX.Element {
  const palette =
    state === 'success'
      ? {
          border: 'border-emerald-200',
          bg: 'bg-emerald-50/50',
          icon: <CheckIcon />,
          title: 'Seed terminé avec succès',
          tone: 'text-emerald-800',
        }
      : state === 'partial'
        ? {
            border: 'border-amber-200',
            bg: 'bg-amber-50/50',
            icon: <WarningIcon />,
            title: 'Seed terminé avec des erreurs',
            tone: 'text-amber-800',
          }
        : {
            border: 'border-rose-200',
            bg: 'bg-rose-50/50',
            icon: <CrossIcon />,
            title: 'Seed échoué',
            tone: 'text-rose-800',
          };

  return (
    <article
      aria-label="Rapport de seed"
      className={`mt-4 rounded-md border ${palette.border} ${palette.bg} p-4`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {palette.icon}
          <h3 className={`text-sm font-semibold ${palette.tone}`}>
            {palette.title}
          </h3>
        </div>
        <span className="font-mono text-xs text-stone-500">
          {(report.durationMs / 1000).toFixed(1)} s
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-700 sm:grid-cols-3">
        <Stat label="Composants" value={report.components.synced} />
        <Stat label="Animations" value={report.animations.synced} />
        <Stat label="Images vues" value={report.images.total} />
        <Stat
          label="Seedées"
          value={report.images.seeded}
          tone="text-emerald-700"
        />
        <Stat label="Ignorées" value={report.images.skipped} />
        <Stat label="Activées" value={report.images.activated} />
      </dl>

      {report.images.unmapped.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-stone-700">
            Non mappées ({report.images.unmapped.length})
          </summary>
          <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-stone-600">
            {report.images.unmapped.map((p) => (
              <li key={p} className="break-all">
                {p}
              </li>
            ))}
          </ul>
        </details>
      )}
      {report.images.errors.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-xs text-rose-700">
            Erreurs ({report.images.errors.length})
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-rose-700">
            {report.images.errors.map((err, idx) => (
              <li key={idx} className="break-all">
                <span className="text-rose-600">{err.path}</span> — {err.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}): JSX.Element {
  return (
    <div className="flex justify-between gap-1">
      <dt className="text-stone-500">{label}</dt>
      <dd className={`font-mono ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}
