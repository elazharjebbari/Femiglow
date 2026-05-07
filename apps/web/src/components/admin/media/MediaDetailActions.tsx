'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MediaDetailActionsProps {
  mediaId: string;
}

export function MediaDetailActions({ mediaId }: MediaDetailActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'regen' | 'delete' | null>(null);

  const regenerate = async () => {
    if (busy) return;
    setBusy('regen');
    try {
      const res = await fetch(`/api/admin/media/${mediaId}/regenerate`, { method: 'POST' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? 'Erreur de régénération');
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    if (!confirm('Supprimer ce média ? Action réversible (soft delete).')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/media/${mediaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? 'Erreur de suppression');
      } else {
        router.push('/admin/media');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={regenerate}
        disabled={busy !== null}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        {busy === 'regen' ? 'Régénération…' : 'Régénérer'}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
      >
        {busy === 'delete' ? 'Suppression…' : 'Supprimer'}
      </button>
    </div>
  );
}
