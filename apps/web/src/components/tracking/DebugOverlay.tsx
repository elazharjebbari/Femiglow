'use client';

import { useEffect, useState } from 'react';
import { getDataLayer, type DataLayerEntry } from '@/lib/tracking/datalayer';

export function DebugOverlay(): JSX.Element | null {
  const [entries, setEntries] = useState<DataLayerEntry[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem('fg_debug') === '1');
    if (window.localStorage.getItem('fg_debug') !== '1') return;
    const dl = getDataLayer();
    setEntries(dl.recent(10));
    const interval = setInterval(() => setEntries(dl.recent(10)), 1000);
    return (): void => clearInterval(interval);
  }, []);

  if (!enabled) return null;
  return (
    <div className="fixed bottom-4 end-4 z-[60] max-h-72 w-80 overflow-auto rounded-xl border border-stone-300 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between text-stone-700">
        <strong>fg_debug</strong>
        <span>{entries.length} events</span>
      </div>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.event_id} className="rounded bg-stone-50 px-2 py-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span>{e.event}</span>
              <span className="text-stone-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
