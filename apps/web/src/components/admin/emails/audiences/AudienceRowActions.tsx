'use client';

/**
 * AudienceRowActions — boutons Édit + Supprimer pour la liste audiences.
 * Édit = lien vers la page detail [id]. Suppression = DELETE /api/...
 * avec confirm explicite.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  audienceId: string;
  audienceName: string;
}

export function AudienceRowActions({ audienceId, audienceName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? body?.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? '…' : 'Confirmer'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          Annuler
        </button>
        {error && <span className="ml-2 text-xs text-red-700">{error}</span>}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={`/admin/emails/audiences/${audienceId}`}
        className="rounded px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
        title={`Détail « ${audienceName} »`}
      >
        Détail
      </Link>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-red-50 hover:text-red-700"
        title="Supprimer (avec confirmation)"
      >
        Supprimer
      </button>
    </div>
  );
}
