'use client';

import { useState } from 'react';
import { mappingsClient } from '@/lib/admin/mappings-client';

/**
 * Modal "Tester le mapping" — dry-run dispatch sans appel réseau.
 * cf. F.10 + ADR-001
 */
export function MappingTestModal(props: {
  versionId: string;
  eventNames: string[];
  onClose: () => void;
}) {
  const [eventName, setEventName] = useState(props.eventNames[0] ?? '');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, { wouldDispatch: boolean; mappedName: string | null; isCustom: boolean; skipReason: string | null }> | null>(null);

  async function handleRun() {
    if (!eventName) return;
    setRunning(true);
    try {
      const r = await mappingsClient.test(props.versionId, eventName);
      setResults(r.results);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-start justify-between">
          <h2 id="test-modal-title" className="text-lg font-semibold">Tester le dispatching</h2>
          <button onClick={props.onClose} aria-label="Fermer" className="text-stone-400 hover:text-stone-900">×</button>
        </header>

        <label className="block">
          <span className="block text-xs font-medium text-stone-700">Event à simuler</span>
          <select
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            data-testid="test-event-select"
          >
            {props.eventNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          data-testid="btn-test-run"
          className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {running ? 'Test…' : 'Lancer le test'}
        </button>

        {results ? (
          <div className="mt-4 space-y-1 text-sm" data-testid="test-results">
            {Object.entries(results).map(([kind, r]) => (
              <div key={kind} className="flex items-center justify-between rounded border border-stone-200 px-2 py-1.5">
                <span className="font-mono text-xs">{kind}</span>
                {r.wouldDispatch ? (
                  <span className="text-emerald-700">
                    ✅ {r.mappedName}{r.isCustom ? ' (custom)' : ''}
                  </span>
                ) : (
                  <span className="text-stone-500">🚫 {r.skipReason ?? 'skipped'}</span>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <footer className="mt-4 flex justify-end">
          <button onClick={props.onClose} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Fermer</button>
        </footer>
      </div>
    </div>
  );
}
