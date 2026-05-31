'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from '@/lib/admin/use-keyboard-shortcuts';
import { useOptimisticMutation } from '@/lib/admin/use-optimistic-mutation';
import { ShortcutsCheatsheet } from './ShortcutsCheatsheet';
import type { AdminRitualRow } from '@/lib/db/queries/rituals-admin';

interface RitualSweepViewProps {
  adminEmail: string;
  ritual: AdminRitualRow;
  previousId: string | null;
  nextId: string | null;
  position: number;
  total: number;
}

type ActionKind = 'approve' | 'reject' | 'hide';

export function RitualSweepView({
  adminEmail,
  ritual,
  previousId,
  nextId,
  position,
  total,
}: RitualSweepViewProps) {
  const router = useRouter();
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [announce, setAnnounce] = useState('');

  const navigateTo = (id: string | null) => {
    if (id) router.push(`/admin/rituals/queue/sweep?id=${id}`);
    else router.push('/admin/rituals/queue/sweep');
  };

  const mutation = useOptimisticMutation<[ActionKind, string | undefined], unknown>({
    mutate: async (action, note) => {
      const body: Record<string, unknown> = { action };
      if (note) body.note = note;
      if (action === 'reject' || action === 'hide') body.note = note ?? '';
      const res = await fetch(`/api/admin/rituals/${ritual.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
        );
      }
      return res.json();
    },
    onSuccess: (_r, action) => {
      setAnnounce(`Rituel ${action} — passage au suivant`);
      navigateTo(nextId);
    },
  });

  const doAction = async (action: ActionKind, note?: string) => {
    try {
      await mutation.run(action, note);
    } catch {
      /* erreur gérée via mutation.error */
    }
  };

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'ArrowRight',
      description: 'Suivant',
      enabled: !!nextId,
      handler: () => navigateTo(nextId),
    },
    {
      key: 'ArrowLeft',
      description: 'Précédent',
      enabled: !!previousId,
      handler: () => navigateTo(previousId),
    },
    {
      key: 's',
      description: 'Skip (passer au suivant)',
      enabled: !!nextId,
      handler: () => navigateTo(nextId),
    },
    {
      key: 'a',
      description: 'Approuver',
      enabled: !mutation.pending,
      handler: () => doAction('approve'),
    },
    {
      key: 'r',
      description: 'Rejeter (note demandée)',
      enabled: !mutation.pending,
      handler: () => {
        const note = window.prompt('Raison du rejet ?');
        if (note && note.trim().length > 0) doAction('reject', note.trim());
      },
    },
    {
      key: 'h',
      description: 'Masquer (note demandée)',
      enabled: !mutation.pending,
      handler: () => {
        const note = window.prompt('Raison du masquage ?');
        if (note && note.trim().length > 0) doAction('hide', note.trim());
      },
    },
    {
      key: '?',
      description: "Afficher l'aide",
      handler: () => setCheatsheetOpen((o) => !o),
    },
    {
      key: 'q',
      description: 'Quitter le mode rafale',
      handler: () => router.push('/admin/rituals/queue'),
    },
  ];
  useKeyboardShortcuts(shortcuts);

  return (
    <main
      className="flex min-h-screen flex-col bg-stone-50 px-6 py-4"
      data-testid="ritual-sweep"
    >
      <header className="flex items-center justify-between text-xs text-stone-600">
        <span>
          {position} sur {total} PENDING · {adminEmail}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCheatsheetOpen(true)}
            className="border border-stone-300 px-2 py-1 hover:bg-stone-100"
          >
            ? Raccourcis
          </button>
          <Link
            href="/admin/rituals/queue"
            className="border border-stone-300 px-2 py-1 hover:bg-stone-100"
            data-testid="sweep-quit"
          >
            Quitter (Q)
          </Link>
        </div>
      </header>

      <article className="mx-auto mt-8 w-full max-w-3xl flex-1 rounded border border-stone-200 bg-white p-8 shadow-sm">
        {ritual.autoFlags.length > 0 && (
          <p className="mb-4 text-xs text-amber-900">
            <span className="bg-amber-100 px-1.5 py-0.5">
              Flags : {ritual.autoFlags.join(', ')}
            </span>
          </p>
        )}
        <blockquote className="font-serif text-2xl italic leading-relaxed text-stone-900">
          « {ritual.body} »
        </blockquote>
        <p className="mt-4 text-sm text-stone-700">
          — {ritual.authorFirstName ?? 'Une initiée'}
          {ritual.authorCity ? `, ${ritual.authorCity}` : ''}
          {ritual.initiatedSince && <span> · Initiée depuis {ritual.initiatedSince}</span>}
        </p>
        {ritual.ritualTags.length > 0 && (
          <p className="mt-2 text-xs text-emerald-800">
            Tags : {ritual.ritualTags.join(' · ')}
          </p>
        )}
        {ritual.photos.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {ritual.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.thumbUrl}
                alt={p.alt ?? `Photo ${p.position}`}
                className={`aspect-square w-full border object-cover ${
                  p.facesStatus === 'REJECTED_FACE'
                    ? 'border-rose-500'
                    : 'border-stone-200'
                }`}
              />
            ))}
          </div>
        )}
      </article>

      <footer className="mx-auto mt-6 flex w-full max-w-3xl items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={mutation.pending}
            onClick={() => doAction('approve')}
            className="bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            data-testid="sweep-approve"
          >
            A — Approuver
          </button>
          <button
            type="button"
            disabled={mutation.pending}
            onClick={() => {
              const note = window.prompt('Raison du rejet ?');
              if (note && note.trim().length > 0) doAction('reject', note.trim());
            }}
            className="border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
            data-testid="sweep-reject"
          >
            R — Rejeter
          </button>
          <button
            type="button"
            onClick={() => navigateTo(nextId)}
            disabled={!nextId}
            className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
            data-testid="sweep-skip"
          >
            S — Skip
          </button>
        </div>
        <p className="text-xs text-stone-500">
          ←/→ navigation · ? aide · Q quitter
        </p>
      </footer>

      {mutation.error && (
        <p className="mt-4 rounded bg-rose-50 px-3 py-2 text-xs text-rose-900" role="alert">
          {mutation.error.message}
        </p>
      )}

      <div className="sr-only" aria-live="polite" role="status">
        {announce}
      </div>

      <ShortcutsCheatsheet
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
        shortcuts={shortcuts}
      />
    </main>
  );
}
