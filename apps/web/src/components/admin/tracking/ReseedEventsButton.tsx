'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReseedEventsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'ok' | 'err' | null>(null);

  async function reseed(force: boolean): Promise<void> {
    setLoading(true);
    setMessage(null);
    setTone(null);
    try {
      const res = await fetch('/api/admin/tracking/event-definitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { upserted: number; alreadySeeded: boolean };
      setTone('ok');
      setMessage(
        data.alreadySeeded
          ? 'Catalogue déjà synchronisé.'
          : `${data.upserted} définition${data.upserted > 1 ? 's' : ''} synchronisée${data.upserted > 1 ? 's' : ''}.`,
      );
      router.refresh();
    } catch (err) {
      setTone('err');
      setMessage(err instanceof Error ? err.message : 'Échec du seed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message ? (
        <span
          className={`text-xs ${
            tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {message}
        </span>
      ) : null}
      <button
        type="button"
        onClick={(): void => {
          void reseed(true);
        }}
        disabled={loading}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
      >
        {loading ? 'Synchronisation…' : 'Re-seed catalogue'}
      </button>
    </div>
  );
}
