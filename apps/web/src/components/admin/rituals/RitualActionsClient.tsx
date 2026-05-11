'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RitualStatus } from '@/lib/db/types';

interface RitualActionsClientProps {
  id: string;
  status: RitualStatus;
  featured: boolean;
}

type ActionKind = 'approve' | 'reject' | 'hide' | 'restore' | 'feature' | 'unfeature';

export function RitualActionsClient({ id, status, featured }: RitualActionsClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callAction = async (action: ActionKind, note?: string) => {
    setPending(action);
    setError(null);
    try {
      const body: Record<string, unknown> = { action };
      if (note) body.note = note;
      if (action === 'reject') body.note = note ?? '';
      const res = await fetch(`/api/admin/rituals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      aria-labelledby="ritual-actions-title"
      className="rounded border border-stone-200 bg-white p-4"
    >
      <h2 id="ritual-actions-title" className="mb-3 text-sm font-medium text-stone-700">
        Actions
      </h2>
      <div className="space-y-2">
        {status === 'PENDING' && (
          <>
            <button
              type="button"
              data-testid="admin-action-approve"
              onClick={() => {
                if (window.confirm('Publier ce rituel ?')) callAction('approve');
              }}
              disabled={pending !== null}
              className="block w-full bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {pending === 'approve' ? 'En cours…' : 'Approuver'}
            </button>
            <button
              type="button"
              data-testid="admin-action-reject"
              onClick={() => {
                const note = window.prompt('Raison du rejet (note interne) ?');
                if (note && note.length > 0) callAction('reject', note);
              }}
              disabled={pending !== null}
              className="block w-full border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
            >
              {pending === 'reject' ? 'En cours…' : 'Rejeter'}
            </button>
          </>
        )}
        {status === 'APPROVED' && (
          <>
            <button
              type="button"
              data-testid="admin-action-hide"
              onClick={() => {
                const note = window.prompt('Raison du masquage ?');
                if (note && note.length > 0) callAction('hide', note);
              }}
              disabled={pending !== null}
              className="block w-full border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
            >
              {pending === 'hide' ? 'En cours…' : 'Masquer'}
            </button>
            <button
              type="button"
              data-testid={featured ? 'admin-action-unfeature' : 'admin-action-feature'}
              onClick={() => callAction(featured ? 'unfeature' : 'feature')}
              disabled={pending !== null}
              className="block w-full border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
            >
              {pending === 'feature' || pending === 'unfeature'
                ? 'En cours…'
                : featured
                  ? 'Retirer la mise en avant'
                  : 'Mettre en avant'}
            </button>
          </>
        )}
        {(status === 'REJECTED' || status === 'HIDDEN') && (
          <button
            type="button"
            data-testid="admin-action-restore"
            onClick={() => {
              if (window.confirm('Restaurer ce rituel ?')) callAction('restore');
            }}
            disabled={pending !== null}
            className="block w-full bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {pending === 'restore' ? 'En cours…' : 'Restaurer'}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-3 bg-rose-50 p-2 text-xs text-rose-900" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
