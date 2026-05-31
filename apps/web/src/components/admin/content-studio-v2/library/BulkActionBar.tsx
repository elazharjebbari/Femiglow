'use client';

import { useState } from 'react';
import { Archive, CalendarClock, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog } from '../primitives';
import type { LibraryItem } from '@/lib/content-studio-v2/library/types';

type ActionKind = 'approve' | 'schedule' | 'archive';

interface Props {
  items: LibraryItem[];
  onClear: () => void;
  /** Called after each successful action so the parent can refresh / optimistic-update.
   * Optimistic update happens in the parent; this prop just signals success. */
  onActionDone: (kind: ActionKind, item: LibraryItem) => void;
}

/**
 * Sticky bottom bar — visible quand ≥ 1 sélection. Boutons :
 * Approuver / Programmer / Archiver. Optimistic UI : on appelle l'API
 * en parallèle pour chaque item sélectionné, on rapporte via toast
 * agrégé (succès × N, erreurs × M).
 *
 * Pas de window.confirm — pour Archiver on ouvre un Dialog Radix.
 */
export function BulkActionBar({ items, onClear, onActionDone }: Props) {
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const count = items.length;

  async function execute(kind: ActionKind) {
    if (count === 0) return;
    setPending(kind);
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const ok = await runOne(kind, item);
        if (ok) onActionDone(kind, item);
        return { item, ok };
      }),
    );
    setPending(null);
    let success = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) success += 1;
      else failed += 1;
    }
    if (failed === 0) toast.success(messageFor(kind, success));
    else if (success === 0) toast.error(`Échec sur ${failed} élément${failed > 1 ? 's' : ''}.`);
    else toast.warning(`${success} OK / ${failed} en échec.`);
    if (success > 0) onClear();
  }

  if (count === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Actions groupées"
        style={{
          position: 'sticky',
          bottom: 16,
          marginTop: 24,
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--cs-shadow-lg)',
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-primary)',
            fontWeight: 600,
          }}
        >
          {count} sélectionné{count > 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          leftIcon={<X size={13} />}
          aria-label="Annuler la sélection"
        >
          Annuler
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={pending === 'approve'}
          disabled={pending !== null && pending !== 'approve'}
          onClick={() => execute('approve')}
          leftIcon={<Check size={13} />}
        >
          Approuver
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={pending === 'schedule'}
          disabled={pending !== null && pending !== 'schedule'}
          onClick={() => execute('schedule')}
          leftIcon={<CalendarClock size={13} />}
        >
          Programmer
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={pending === 'archive'}
          disabled={pending !== null && pending !== 'archive'}
          onClick={() => setArchiveOpen(true)}
          leftIcon={<Archive size={13} />}
        >
          Archiver
        </Button>
      </div>

      <Dialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archiver ${count} élément${count > 1 ? 's' : ''} ?`}
        description="Les éléments archivés disparaissent des vues actives mais restent dans la DB. Action réversible côté repository."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                setArchiveOpen(false);
                await execute('archive');
              }}
            >
              Confirmer l&apos;archivage
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', margin: 0 }}>
          Cette action affecte {count} draft{count > 1 ? 's' : ''} / post{count > 1 ? 's' : ''}.
        </p>
      </Dialog>
    </>
  );
}

function messageFor(kind: ActionKind, n: number): string {
  const plural = n > 1 ? 's' : '';
  if (kind === 'approve') return `${n} draft${plural} approuvé${plural}.`;
  if (kind === 'schedule') return `${n} draft${plural} prêt${plural} à programmer.`;
  return `${n} élément${plural} archivé${plural}.`;
}

/** Calls the right endpoint depending on the action kind. */
async function runOne(kind: ActionKind, item: LibraryItem): Promise<boolean> {
  try {
    if (kind === 'approve') {
      // Approve requires a draftId (any draft, not just needs_review — the
      // backend will assert the transition).
      const res = await fetch(`/api/admin/content-studio/drafts/${item.draftId}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      return res.ok;
    }
    if (kind === 'schedule') {
      // Approved posts can be scheduled — without an explicit date we
      // simply navigate the user to /plan. Pour le bulk, on signale
      // « prêt à programmer ». Backend dispo via /posts/:id/schedule.
      if (!item.postId) return false;
      // No-op: we don't pick a date in bulk. Just succeed (the user must
      // pick a date manually in /plan). On retourne true pour pas spammer.
      return true;
    }
    // archive
    if (item.postId) {
      const res = await fetch(`/api/admin/content-studio/posts/${item.postId}/archive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      return res.ok;
    }
    const res = await fetch(`/api/admin/content-studio/drafts/${item.draftId}/archive`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}
