'use client';

/**
 * Actions client-side sur la page détail audience.
 *
 *  - « Modifier » → page d'édition (UX-AUD-001).
 *  - « + Snapshot maintenant » : action de MASSE → confirmation explicite
 *    affichant le nombre de contacts figés (preview-size) AVANT le POST
 *    (UX-AUD-005). Anti double-clic.
 *  - « Supprimer » : ConfirmDialog socle variante danger (TRV-01, F08-C-087) —
 *    un échec garde le dialog ouvert (alerte interne), la ligne est préservée.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ExclusionFlags, RulesGroup } from '@/lib/mail/audiences/rules-types';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const nf = new Intl.NumberFormat('fr-FR');

export function AudienceDetailActions({
  audienceId,
  rules,
  exclusionFlags,
}: {
  audienceId: string;
  rules: RulesGroup;
  exclusionFlags: ExclusionFlags;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'snapshot' | 'delete' | 'sizing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Confirmation de snapshot : null = fermée, number|undefined = ouverte avec count.
  const [confirmSize, setConfirmSize] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function openSnapshotConfirm() {
    if (busy) return; // anti double-clic
    setBusy('sizing');
    setError(null);
    setConfirmSize(null);
    setConfirmOpen(true);
    try {
      const res = await fetch('/api/admin/emails/audiences/preview-size', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rules, exclusionFlags }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { size: number };
      setConfirmSize(body.size);
    } catch (err) {
      // L'échec du sizing ne doit pas empêcher de figer (mais on l'affiche).
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function confirmSnapshot() {
    if (busy) return; // anti double-clic
    setBusy('snapshot');
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}/snapshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source: 'manual' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  // TRV-01 — la confirmation passe par le ConfirmDialog socle (plus de
  // window.confirm). onConfirm REJETTE en cas d'échec : le dialog reste
  // ouvert avec l'erreur, la ligne audience est préservée.
  async function confirmDelete() {
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteOpen(false);
      router.push('/admin/emails/audiences');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/emails/audiences/${audienceId}/edit`}
          className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          data-testid="edit-link"
        >
          Modifier
        </Link>
        <button
          type="button"
          onClick={openSnapshotConfirm}
          disabled={!!busy}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          data-testid="snapshot-btn"
        >
          {busy === 'sizing' ? 'Calcul…' : '+ Snapshot maintenant'}
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={!!busy}
          className="rounded border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          data-testid="delete-btn"
        >
          {busy === 'delete' ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>

      {/* TRV-01 — suppression via le socle (focus Annuler, Esc/backdrop, 1 seul DELETE). */}
      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer cette audience ?"
        body="Les snapshots existants sont conservés, mais l'audience et son ciblage disparaissent. Action irréversible."
        confirmLabel="Supprimer"
        busyLabel="Suppression…"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* UX-AUD-005 — confirmation de l'action de masse avec count. */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer le snapshot"
          data-testid="snapshot-confirm"
          className="mt-2 w-80 rounded-md border border-stone-300 bg-white p-3 text-left shadow-lg"
        >
          <p className="text-sm text-stone-800">
            {confirmSize === null ? (
              <span data-testid="snapshot-confirm-count">Calcul du nombre de contacts…</span>
            ) : (
              <span data-testid="snapshot-confirm-count">
                Figer <strong>{nf.format(confirmSize)}</strong> contact
                {confirmSize !== 1 ? 's' : ''} dans un snapshot ?
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Matérialise la liste figée (envoi reproductible). Action irréversible sur ce snapshot.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setError(null);
              }}
              disabled={busy === 'snapshot'}
              className="rounded px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              data-testid="snapshot-cancel"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmSnapshot}
              disabled={busy === 'snapshot'}
              className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              data-testid="snapshot-confirm-btn"
            >
              {busy === 'snapshot' ? 'Snapshot…' : 'Confirmer le snapshot'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
