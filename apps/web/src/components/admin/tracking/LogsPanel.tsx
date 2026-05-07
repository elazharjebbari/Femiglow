'use client';

import { useCallback, useEffect, useState } from 'react';

interface LogEntryDto {
  id: string;
  eventId: string;
  eventName: string;
  eventCategory: string;
  pageRoute: string;
  anonymousId: string;
  sessionId: string;
  isConversion: boolean;
  receivedAt: string;
  device: string;
  providersDispatched: string[];
  providersResults: Record<string, { status: string; error?: string; httpStatus?: number }>;
}

const POLL_MS = 5000;

export function LogsPanel() {
  const [logs, setLogs] = useState<LogEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [pageRoute, setPageRoute] = useState('');
  const [convOnly, setConvOnly] = useState(false);
  const [open, setOpen] = useState<LogEntryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (eventName.trim()) params.set('eventName', eventName.trim());
      if (pageRoute.trim()) params.set('pageRoute', pageRoute.trim());
      if (convOnly) params.set('isConversion', '1');
      const r = await fetch(`/api/admin/tracking/logs?${params.toString()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { events: LogEntryDto[] };
      setLogs(j.events);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [eventName, pageRoute, convOnly]);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-stone-500">
          Event
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="purchase"
            className="rounded-md border border-stone-300 px-2 py-1 text-sm normal-case tracking-normal text-stone-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-stone-500">
          Route
          <input
            value={pageRoute}
            onChange={(e) => setPageRoute(e.target.value)}
            placeholder="/checkout"
            className="rounded-md border border-stone-300 px-2 py-1 text-sm normal-case tracking-normal text-stone-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={convOnly}
            onChange={(e) => setConvOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Conversions uniquement
        </label>
        <button
          type="button"
          onClick={load}
          className="ml-auto rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          Rafraîchir
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Polling toutes les {POLL_MS / 1000} s · {logs.length} entrées
      </p>
      {error ? <p className="mt-2 text-xs text-rose-700">Erreur : {error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Reçu</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Device</th>
              <th className="px-3 py-2 font-medium">Conv.</th>
              <th className="px-3 py-2 font-medium">Providers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                  Chargement…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                  Aucune entrée.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setOpen(l)}
                  className="cursor-pointer hover:bg-stone-50"
                >
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {new Date(l.receivedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs font-medium">{l.eventName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.pageRoute}</td>
                  <td className="px-3 py-2 text-xs">{l.device}</td>
                  <td className="px-3 py-2 text-xs">
                    {l.isConversion ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        oui
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {l.providersDispatched.length === 0 ? (
                      '—'
                    ) : (
                      <span className="font-mono">{l.providersDispatched.join(', ')}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? <DetailDrawer entry={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function DetailDrawer({ entry, onClose }: { entry: LogEntryDto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-y-auto bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-sm text-stone-500 hover:text-stone-900"
        >
          ✕ Fermer
        </button>
        <h3 className="text-lg font-semibold text-stone-900">{entry.eventName}</h3>
        <p className="mt-1 text-xs text-stone-500">eventId : {entry.eventId}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Detail label="Reçu" value={new Date(entry.receivedAt).toLocaleString()} />
          <Detail label="Catégorie" value={entry.eventCategory} />
          <Detail label="Route" value={entry.pageRoute} />
          <Detail label="Device" value={entry.device} />
          <Detail label="anonymousId" value={entry.anonymousId} />
          <Detail label="sessionId" value={entry.sessionId} />
          <Detail label="Conversion" value={entry.isConversion ? 'oui' : 'non'} />
        </dl>
        <h4 className="mt-6 text-sm font-medium uppercase tracking-wide text-stone-500">
          Providers
        </h4>
        <div className="mt-2 space-y-2">
          {Object.entries(entry.providersResults).length === 0 ? (
            <p className="text-xs text-stone-500">Aucun provider dispatch.</p>
          ) : (
            Object.entries(entry.providersResults).map(([kind, r]) => (
              <div key={kind} className="rounded-md border border-stone-200 px-3 py-2 text-xs">
                <p>
                  <span className="font-mono font-medium">{kind}</span> ·{' '}
                  <span
                    className={
                      r.status === 'sent'
                        ? 'text-emerald-700'
                        : r.status === 'skipped'
                          ? 'text-stone-600'
                          : 'text-rose-700'
                    }
                  >
                    {r.status}
                  </span>
                  {r.httpStatus ? ` · HTTP ${r.httpStatus}` : ''}
                </p>
                {r.error ? <p className="mt-1 text-rose-700">{r.error}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 break-words font-mono text-stone-900">{value}</dd>
    </div>
  );
}
