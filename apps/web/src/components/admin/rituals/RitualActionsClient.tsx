'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RitualStatus } from '@/lib/db/types';
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from '@/lib/admin/use-keyboard-shortcuts';
import { ShortcutsCheatsheet } from './ShortcutsCheatsheet';

interface RitualActionsClientProps {
  id: string;
  status: RitualStatus;
  featured: boolean;
  /** Navigation contextuelle (passée par la page détail). */
  previousId?: string | null;
  nextId?: string | null;
  /** Filtre status courant pour préserver le contexte en navigant. */
  statusParam?: string;
}

type ActionKind = 'approve' | 'reject' | 'hide' | 'restore' | 'feature' | 'unfeature';

export function RitualActionsClient({
  id,
  status,
  featured,
  previousId,
  nextId,
  statusParam,
}: RitualActionsClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<string>('');
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const navigateTo = (targetId: string | null | undefined) => {
    if (!targetId) return;
    const suffix = statusParam ? `?status=${encodeURIComponent(statusParam)}` : '';
    router.push(`/admin/rituals/${targetId}${suffix}`);
  };

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
      setAnnounce(`Action « ${action} » exécutée.`);
      // Auto-advance pour les actions qui font sortir le rituel de sa file
      if (
        nextId &&
        (action === 'approve' || action === 'reject' || action === 'hide' || action === 'restore')
      ) {
        navigateTo(nextId);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'j',
      description: 'Rituel suivant',
      enabled: !!nextId,
      handler: () => navigateTo(nextId),
    },
    {
      key: 'k',
      description: 'Rituel précédent',
      enabled: !!previousId,
      handler: () => navigateTo(previousId),
    },
    {
      key: 'a',
      description: 'Approuver',
      enabled: status === 'PENDING' && pending === null,
      handler: () => callAction('approve'),
    },
    {
      key: 'r',
      description: 'Rejeter (note demandée)',
      enabled: status === 'PENDING' && pending === null,
      handler: () => {
        const note = window.prompt('Raison du rejet (note interne) ?');
        if (note && note.length > 0) callAction('reject', note);
      },
    },
    {
      key: 'h',
      description: 'Masquer (note demandée)',
      enabled: status === 'APPROVED' && pending === null,
      handler: () => {
        const note = window.prompt('Raison du masquage ?');
        if (note && note.length > 0) callAction('hide', note);
      },
    },
    {
      key: 'f',
      description: featured ? 'Retirer la mise en avant' : 'Mettre en avant',
      enabled: status === 'APPROVED' && pending === null,
      handler: () => callAction(featured ? 'unfeature' : 'feature'),
    },
    {
      key: 's',
      description: 'Restaurer',
      enabled: (status === 'REJECTED' || status === 'HIDDEN') && pending === null,
      handler: () => callAction('restore'),
    },
    {
      key: '?',
      description: 'Afficher cette aide',
      handler: () => setCheatsheetOpen((o) => !o),
      evenInInput: false,
    },
  ];

  useKeyboardShortcuts(shortcuts);

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
      <p className="mt-3 text-[11px] text-stone-500">
        <button
          type="button"
          className="underline hover:text-stone-900"
          onClick={() => setCheatsheetOpen(true)}
          data-testid="shortcuts-cheatsheet-trigger"
        >
          Voir les raccourcis clavier (?)
        </button>
      </p>
      <div className="sr-only" aria-live="polite" role="status">
        {announce}
      </div>
      <ShortcutsCheatsheet
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
        shortcuts={shortcuts}
      />
    </section>
  );
}
