'use client';

/**
 * Actions client-side sur la page detail audience : Snapshot + Delete.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AudienceDetailActions({ audienceId }: { audienceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'snapshot' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerSnapshot() {
    setBusy('snapshot');
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}/snapshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'manual' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Supprimer cette audience ? Les snapshots seront conservés mais l\'audience disparaît.')) {
      return;
    }
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push('/admin/emails/audiences');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={triggerSnapshot}
          disabled={!!busy}
          className="rounded bg-sage-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sage-800 disabled:opacity-50"
          data-testid="snapshot-btn"
        >
          {busy === 'snapshot' ? 'Snapshot…' : '+ Snapshot maintenant'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!!busy}
          className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          data-testid="delete-btn"
        >
          {busy === 'delete' ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
