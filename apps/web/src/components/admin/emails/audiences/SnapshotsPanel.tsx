'use client';

/**
 * SnapshotsPanel — table des snapshots avec interactivité (UX-AUD-006/007/012
 * + F08 étape 3 AUD-03/06/11) :
 *  - auto-refresh tant qu'un snapshot est `running` (router.refresh 4 s) ;
 *  - `errored` : erroredReason + bouton « Relancer » (anti double-clic) ;
 *  - drift vs live : âge relatif, écart ▲/▼ en valeur + %, surlignage et
 *    bandeau « re-snapshoter » au-delà de 10 % (sur le snapshot le plus
 *    récent done — celui qu'on enverrait) ;
 *  - date de purge auto (purgeableAfter, créé + 90 j) ;
 *  - membres paginés « Charger plus » (offset = members.length, concat
 *    dédoublonnée par email) + export CSV.
 *
 * Le live count vient du RSC parent (1 appel preview-size par chargement de
 * page — JAMAIS dans la boucle 4 s).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatAbsolute, timeZoneLabel, DEFAULT_TIMEZONE } from '../ui/format-datetime';
import { DRIFT_ALERT_PCT, driftLabel, driftPct, relativeAge, shortDate } from './drift';

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
  errored: 'bg-rose-50 text-rose-700',
};

const MEMBERS_PAGE = 50;

const nf = new Intl.NumberFormat('fr-FR');

export function SnapshotsPanel({
  audienceId,
  snapshots,
  liveCount = null,
}: {
  audienceId: string;
  snapshots: SnapshotRow[];
  /** Taille live de l'audience (RSC, 1 calcul/chargement) — null si indisponible. */
  liveCount?: number | null;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMembers, setOpenMembers] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const hasRunning = snapshots.some((s) => s.status === 'running' || s.status === 'pending');

  // UX-AUD-007 — auto-refresh tant qu'un snapshot est en cours.
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [hasRunning, router]);

  // UX-AUD-006 — relancer un snapshot errored / re-snapshoter sur drift.
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

  const fetchMembersPage = useCallback(
    async (snapshotId: string, offset: number): Promise<{ members: Member[]; total: number }> => {
      const res = await fetch(
        `/api/admin/emails/audiences/${audienceId}/snapshot/${snapshotId}/members?limit=${MEMBERS_PAGE}&offset=${offset}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { members: Member[]; total: number };
    },
    [audienceId],
  );

  // UX-AUD-012 — drill-down membres paginés (1er chargement).
  const loadMembers = useCallback(
    async (snapshotId: string) => {
      setOpenMembers(snapshotId);
      setMembers([]);
      setMembersTotal(0);
      setMembersLoading(true);
      setMembersError(null);
      try {
        const body = await fetchMembersPage(snapshotId, 0);
        setMembers(body.members);
        setMembersTotal(body.total);
      } catch (err) {
        setMembersError(err instanceof Error ? err.message : String(err));
      } finally {
        setMembersLoading(false);
      }
    },
    [fetchMembersPage],
  );

  // AUD-06 — « Charger plus » : offset = members.length, concat dédoublonnée.
  const loadMore = useCallback(async () => {
    if (!openMembers || membersLoading) return; // anti double-clic
    setMembersLoading(true);
    setMembersError(null);
    try {
      const body = await fetchMembersPage(openMembers, members.length);
      setMembers((prev) => {
        const seen = new Set(prev.map((m) => m.email));
        return [...prev, ...body.members.filter((m) => !seen.has(m.email))];
      });
      setMembersTotal(body.total);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : String(err));
    } finally {
      setMembersLoading(false);
    }
  }, [openMembers, membersLoading, members, fetchMembersPage]);

  // AUD-03 — le drift qui compte est celui du snapshot done le plus récent
  // (celui qu'une campagne utiliserait). Bandeau si écart > 10 % strict.
  const latestDone = snapshots.find((s) => s.status === 'done') ?? null;
  const latestDrift =
    latestDone && liveCount !== null ? driftPct(latestDone.size, liveCount) : null;

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

      {latestDrift !== null && latestDrift > DRIFT_ALERT_PCT && (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
          role="status"
          data-testid="drift-banner"
        >
          ⚠ Écart &gt; 10 % avec l&apos;audience live —
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            data-testid="drift-resnapshot"
            className="rounded border border-amber-300 px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {retrying ? 'Snapshot…' : 're-snapshoter'}
          </button>
        </div>
      )}

      {error && (
        <p className="px-4 py-2 text-xs text-rose-700" role="alert">
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
                Date ({timeZoneLabel(DEFAULT_TIMEZONE)})
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                Taille
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                Écart vs live
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
            {snapshots.map((s) => {
              const pct =
                s.status === 'done' && liveCount !== null ? driftPct(s.size, liveCount) : null;
              const highlight = pct !== null && pct > DRIFT_ALERT_PCT;
              return (
                <tr
                  key={s.id}
                  data-testid={`snapshot-row-${s.id}`}
                  className={highlight ? 'bg-amber-50' : undefined}
                  data-drift-alert={highlight ? 'true' : undefined}
                >
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {s.createdAt ? (
                      <>
                        <span className="font-mono">{formatAbsolute(s.createdAt)}</span>
                        <span className="block text-stone-500" data-testid={`snapshot-age-${s.id}`}>
                          créé {relativeAge(s.createdAt)}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                    {s.purgeableAfter && (
                      <span className="block text-stone-500" data-testid={`snapshot-purge-${s.id}`}>
                        purge auto le {shortDate(s.purgeableAfter)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{nf.format(s.size)}</td>
                  <td className="px-3 py-2 text-xs" data-testid={`snapshot-drift-${s.id}`}>
                    {pct === null ? (
                      <span className="text-stone-400" title="Live indisponible ou snapshot non terminé">
                        —
                      </span>
                    ) : (
                      <span className={highlight ? 'font-medium text-amber-900' : 'text-stone-600'}>
                        {driftLabel(s.size, liveCount as number)}
                      </span>
                    )}
                  </td>
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
                        className="mt-1 max-w-xs text-xs text-rose-600"
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
                            Voir les {nf.format(s.size)} membres
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
                        {membersError && (
                          <p className="text-xs text-rose-700" role="alert" data-testid="members-error">
                            Impossible de charger les membres : {membersError}
                          </p>
                        )}
                        {membersLoading && members.length === 0 ? (
                          <p className="text-xs text-stone-500">Chargement des membres…</p>
                        ) : (
                          !membersError && (
                            <>
                              <p className="mb-1 text-xs text-stone-500" data-testid="members-count">
                                {nf.format(members.length)} / {nf.format(membersTotal)} membre
                                {membersTotal !== 1 ? 's' : ''} affiché
                                {members.length !== 1 ? 's' : ''}
                              </p>
                              <ul className="max-h-48 space-y-0.5 overflow-auto text-xs text-stone-700">
                                {members.map((m) => (
                                  <li key={m.email} className="flex gap-2">
                                    <span className="font-mono">{m.email}</span>
                                    {m.name && <span className="text-stone-500">— {m.name}</span>}
                                  </li>
                                ))}
                              </ul>
                              {members.length < membersTotal && (
                                <button
                                  type="button"
                                  onClick={loadMore}
                                  disabled={membersLoading}
                                  data-testid="members-load-more"
                                  className="mt-2 rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-white disabled:opacity-50"
                                >
                                  {membersLoading ? 'Chargement…' : 'Charger plus'}
                                </button>
                              )}
                            </>
                          )
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
