/**
 * CHA-133 / CHA-134 / CHA-135 — Dashboard système live.
 *
 * Combine le `<PipelineGraph>` avec :
 * - une carte par provider (santé + latence + breaker state),
 * - une carte « base de connaissance » (sources actives, freshness),
 * - un compteur live d'événements (SSE /api/admin/chat/visualisation/stream).
 */
'use client';

import { useEffect, useState } from 'react';

import { PipelineGraph } from './PipelineGraph';

interface ProviderHealth {
  id: string;
  label: string;
  kind: string;
  enabled: boolean;
  consumedEur: number;
  quotaEur?: number | null;
  state: 'ok' | 'degraded' | 'down';
}

interface KnowledgeStat {
  totalSources: number;
  totalChunks: number;
  staleSources: number;
}

interface SystemDashboardProps {
  providers: ProviderHealth[];
  knowledge: KnowledgeStat;
}

interface PulseEvent {
  edge: string;
  latencyMs?: number;
}

export function SystemDashboard({ providers, knowledge }: SystemDashboardProps) {
  const [pulseQueue, setPulseQueue] = useState<PulseEvent[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<'live' | 'replay'>('live');
  const [replaySessionId, setReplaySessionId] = useState('');
  const [replayActiveSession, setReplayActiveSession] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const url =
      mode === 'replay' && replayActiveSession
        ? `/api/admin/chat/visualisation/replay?sessionId=${encodeURIComponent(replayActiveSession)}`
        : '/api/admin/chat/visualisation/stream';
    if (mode === 'replay' && !replayActiveSession) {
      return () => {
        alive = false;
        ctrl.abort();
      };
    }
    setCounters({});
    setPulseQueue([]);
    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (alive) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataMatch = /data: (.+)/.exec(block);
            if (!dataMatch) continue;
            try {
              const json = JSON.parse(dataMatch[1]!) as PulseEvent & {
                node?: string;
              };
              setPulseQueue((q) => [...q.slice(-30), json]);
              if (json.node) {
                setCounters((c) => ({ ...c, [json.node!]: (c[json.node!] ?? 0) + 1 }));
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch {
        /* aborted */
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [mode, replayActiveSession]);

  async function* pulseAsyncIterable(): AsyncIterable<PulseEvent> {
    let i = 0;
    while (true) {
      while (i < pulseQueue.length) {
        yield pulseQueue[i]!;
        i++;
      }
      await new Promise<void>((r) => setTimeout(r, 200));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-stone-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('live');
                setReplayActiveSession(null);
              }}
              className={`rounded-full px-3 py-1 ${
                mode === 'live'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setMode('replay')}
              className={`rounded-full px-3 py-1 ${
                mode === 'replay'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Replay
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="/api/admin/chat/visualisation/export?format=svg"
              className="rounded-md border border-stone-200 px-2 py-1 hover:bg-stone-100"
              download
            >
              Export SVG
            </a>
            <a
              href="/api/admin/chat/visualisation/export?format=mermaid"
              className="rounded-md border border-stone-200 px-2 py-1 hover:bg-stone-100"
              download
            >
              Export Mermaid
            </a>
          </div>
        </div>
        {mode === 'replay' && (
          <form
            className="mb-3 flex flex-wrap items-center gap-2 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (replaySessionId.trim()) {
                setReplayActiveSession(replaySessionId.trim());
              }
            }}
          >
            <label htmlFor="replay-session" className="text-stone-600">
              Session ID :
            </label>
            <input
              id="replay-session"
              value={replaySessionId}
              onChange={(e) => setReplaySessionId(e.target.value)}
              placeholder="cs_..."
              className="rounded border border-stone-200 px-2 py-1 font-mono"
            />
            <button
              type="submit"
              className="rounded-md bg-stone-900 px-3 py-1 text-white"
            >
              Rejouer
            </button>
            {replayActiveSession && (
              <span className="text-stone-500">
                Replay : <code>{replayActiveSession}</code>
              </span>
            )}
          </form>
        )}
        <PipelineGraph
          pulseStream={pulseAsyncIterable()}
          counters={counters}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Providers
          </h2>
          <ul className="space-y-2 text-sm">
            {providers.map((p) => {
              const ratio =
                p.quotaEur && p.quotaEur > 0 ? (p.consumedEur / p.quotaEur) * 100 : 0;
              return (
                <li key={p.id} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{p.label}</span>
                    <span className="ml-2 text-xs text-stone-500">{p.kind}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="tabular-nums text-stone-500">
                      {p.consumedEur.toFixed(3)}€
                      {p.quotaEur ? ` / ${p.quotaEur}€` : ''}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        p.state === 'ok'
                          ? 'bg-emerald-100 text-emerald-700'
                          : p.state === 'degraded'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {ratio > 90 ? 'quota' : p.state}
                    </span>
                  </div>
                </li>
              );
            })}
            {providers.length === 0 && (
              <li className="text-stone-500">Aucun provider configuré.</li>
            )}
          </ul>
        </div>

        <div className="rounded-md border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Base de connaissance
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Sources actives</dt>
              <dd className="tabular-nums">{knowledge.totalSources}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Chunks indexés</dt>
              <dd className="tabular-nums">{knowledge.totalChunks}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Sources non rafraîchies (&gt; 30 j)</dt>
              <dd className="tabular-nums text-amber-700">
                {knowledge.staleSources}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
