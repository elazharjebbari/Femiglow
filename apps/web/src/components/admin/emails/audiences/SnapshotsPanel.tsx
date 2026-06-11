'use client';

/**
 * SnapshotsPanel — table des snapshots avec interactivité (UX-AUD-006/007/012) :
 *  - auto-refresh tant qu'un snapshot est `running` (router.refresh périodique) ;
 *  - `errored` : affiche erroredReason + bouton « Relancer » (retry = nouveau POST snapshot) ;
 *  - `done` : « Voir les N membres » (drill-down paginé) + « Exporter CSV ».
 *
 * Reçoit les snapshots déjà chargés côté serveur ; les mutations passent par
 * router.refresh() pour re-render le RSC parent.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type SnapshotRow = {
  id: string;
  status: 'pending' | 'running' | 'done' | 'errored';
  size: number;
  createdAt: string | null;
  purgeableAfter: string | null;
  erroredReason: string | null;
};

type Member = { email: string; name: string | null };

const STATUS_LABEL: Record<SnapshotRow['status'], string> = {
  pending: 'En attente',
  running: 'En cours',
  done: 'Terminé',
  errored: 'En erreur',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-stone-100 text-stone-700',
  running: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
  errored: 'bg-red-50 text-red-700',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function SnapshotsPanel({
  audienceId,
  snapshots,
}: {
  audienceId: string;
  snapshots: SnapshotRow[];
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMembers, setOpenMembers] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);

  const hasRunning = snapshots.some((s) => s.status === 'running' || s.status === 'pending');

  // UX-AUD-007 — auto-refresh tant qu'un snapshot est en cours.
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [hasRunning, router]);

  // UX-AUD-006 — relancer un snapshot errored (nouveau POST manuel).
  const retry = useCallback(async () => {
    if (retrying) return; // anti double-clic
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/emails/audiences/${audienceId}/snapshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source: 'manual' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  }, [audienceId, retrying, router]);

  // UX-AUD-012 — drill-down membres paginés.
  const loadMembers = useCallback(
    async (snapshotId: string) => {
      setOpenMembers(snapshotId);
      setMembersLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/emails/audiences/${audienceId}/snapshot/${snapshotId}/members?limit=50&offset=0`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { members: Member[]; total: number };
        setMembers(body.members);
        setMembersTotal(body.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setMembersLoading(false);
      }
    },
    [audienceId],
  );

  return (
    <section className="mt-6 rounded-md border border-stone-200 bg-white" data-testid="snapshots-panel">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-medium text-stone-700">Snapshots ({snapshots.length})</h2>
        {hasRunning && (
          <span className="text-xs text-sky-700" role="status" data-testid="snapshot-autorefresh">
            ↻ Actualisation auto (snapshot en cours)
          </span>
        )}
      </header>

      {error && (
        <p className="px-4 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}

      {snapshots.length === 0 ? (
        <div className="p-6 text-center text-sm text-stone-500">
          Aucun snapshot. Crée-en un pour figer la liste.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-stone-50/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Date
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                Taille
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Statut
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {snapshots.map((s) => (
              <tr key={s.id} data-testid={`snapshot-row-${s.id}`}>
                <td className="px-3 py-2 font-mono text-xs text-stone-600">
                  {formatDate(s.createdAt)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{s.size}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[s.status] ?? 'bg-stone-100'
                    }`}
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                  {s.status === 'errored' && s.erroredReason && (
                    <p
                      className="mt-1 max-w-xs text-xs text-red-600"
                      data-testid={`snapshot-error-reason-${s.id}`}
                    >
                      {s.erroredReason}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.status === 'errored' && (
                      <button
                        type="button"
                        onClick={retry}
                        disabled={retrying}
                        className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                        data-testid={`snapshot-retry-${s.id}`}
                      >
                        {retrying ? 'Relance…' : 'Relancer'}
                      </button>
                    )}
                    {s.status === 'done' && (
                      <>
                        <button
                          type="button"
                          onClick={() => loadMembers(s.id)}
                          className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-50"
                          data-testid={`snapshot-members-${s.id}`}
                        >
                          Voir les {s.size} membres
                        </button>
                        <a
                          href={`/api/admin/emails/audiences/${audienceId}/snapshot/${s.id}/members?format=csv`}
                          className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-50"
                          data-testid={`snapshot-export-${s.id}`}
                        >
                          Exporter CSV
                        </a>
                      </>
                    )}
                  </div>

                  {openMembers === s.id && (
                    <div
                      className="mt-2 rounded border border-stone-200 bg-stone-50 p-2"
                      data-testid={`members-drawer-${s.id}`}
                    >
                      {membersLoading ? (
                        <p className="text-xs text-stone-500">Chargement des membres…</p>
                      ) : (
                        <>
                          <p className="mb-1 text-xs text-stone-500">
                            {membersTotal.toLocaleString('fr-FR')} membre
                            {membersTotal !== 1 ? 's' : ''} (50 premiers affichés)
                          </p>
                          <ul className="max-h-48 space-y-0.5 overflow-auto text-xs text-stone-700">
                            {members.map((m) => (
                              <li key={m.email} className="flex gap-2">
                                <span className="font-mono">{m.email}</span>
                                {m.name && <span className="text-stone-400">— {m.name}</span>}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
