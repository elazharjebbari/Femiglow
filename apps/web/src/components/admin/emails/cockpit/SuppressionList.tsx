'use client';

/**
 * SuppressionList — écran client de la liste de suppression (UX-COCKPIT-001).
 *
 * ÉCRAN PILOTE du socle emails-ux (P1.5) : premier adoptant de
 * ConfirmDialog / useToast / EmptyState / format-datetime — il a quitté les
 * trois listes blanches des verrous cliquet (ui/__qa__/verrous.test.ts).
 *
 * Rend la `email_suppression` CONSULTABLE et RÉVERSIBLE : table paginée +
 * recherche + « Retirer » via ConfirmDialog (réinscription RGPD, faux positif
 * bounce). Zéro faux succès : échec DELETE → le dialog RESTE ouvert avec
 * l'erreur (re-tentative immédiate possible) ; succès → toast résultat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { statusLabel } from '@/components/admin/emails/common/StatusBadge';
import { ConfirmDialog } from '@/components/admin/emails/ui/ConfirmDialog';
import { EmptyState } from '@/components/admin/emails/ui/EmptyState';
import { useToast } from '@/components/admin/emails/ui/toast';
import { DEFAULT_TIMEZONE, formatAbsolute, timeZoneLabel } from '@/components/admin/emails/ui/format-datetime';

const ROUTE = '/api/admin/emails/suppression';
const PAGE_SIZE = 50;

const nf = new Intl.NumberFormat('fr-FR');

type SuppressionRow = {
  email: string;
  reason: string;
  detail: string | null;
  since: string;
  source: string;
};

type ListResponse = {
  rows: SuppressionRow[];
  total: number;
  limit: number;
  offset: number;
};

/** Libellés FR des raisons de suppression (le slug brut anglais sinon). */
const REASON_LABELS: Record<string, string> = {
  hard_bounce: 'Bounce permanent',
  soft_bounce_repeated: 'Bounces soft répétés',
  complaint: 'Plainte',
  unsubscribe: 'Désinscription',
  manual_admin: 'Action admin',
  cndp_request: 'Demande CNDP',
  invalid_format: 'Format invalide',
};

const SOURCE_LABELS: Record<string, string> = {
  stalwart: 'Stalwart',
  listmonk: 'Listmonk',
  manual: 'Manuel',
  cndp: 'CNDP',
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}
function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export type SuppressionListProps = {
  /** Pré-remplit la recherche (deep-link depuis le détail d'un envoi suppressed). */
  initialEmail?: string;
};

export function SuppressionList({ initialEmail = '' }: SuppressionListProps) {
  const toast = useToast();
  const [query, setQuery] = useState(initialEmail);
  // Terme de recherche réellement appliqué (debounce léger via submit explicite).
  const [appliedQuery, setAppliedQuery] = useState(initialEmail);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<ListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Adresse en attente de confirmation (le dialog est ouvert si non-null). */
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const reqSeq = useRef(0);

  const fetchList = useCallback(async () => {
    const seq = ++reqSeq.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQuery.trim()) params.set('q', appliedQuery.trim());
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      const res = await fetch(`${ROUTE}?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ListResponse;
      if (seq !== reqSeq.current) return; // réponse périmée
      setData(body);
    } catch (err) {
      if (seq !== reqSeq.current) return;
      setLoadError(
        err instanceof Error
          ? `Impossible de charger la liste de suppression (${err.message}).`
          : 'Impossible de charger la liste de suppression.',
      );
    } finally {
      if (seq === reqSeq.current) setIsLoading(false);
    }
  }, [appliedQuery, offset]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const total = data?.total ?? 0;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = offset + rows.length;
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setOffset(0);
      setAppliedQuery(query);
    },
    [query],
  );

  const resetSearch = useCallback(() => {
    setQuery('');
    setAppliedQuery('');
    setOffset(0);
  }, []);

  /**
   * Exécutée PAR le ConfirmDialog (qui porte busy/anti double-clic). Un rejet
   * laisse le dialog ouvert avec l'erreur ; le succès ferme + toast + refetch.
   */
  const confirmRemoval = useCallback(async () => {
    const email = pendingRemoval!;
    const res = await fetch(ROUTE, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    }).catch(() => {
      throw new Error('Échec réseau : impossible de joindre le serveur. Réessaie.');
    });
    if (!res.ok) {
      throw new Error(
        res.status === 401 || res.status === 403
          ? 'Session expirée ou non autorisée — reconnecte-toi puis réessaie.'
          : `Le retrait a échoué (HTTP ${res.status}). Réessaie dans un instant.`,
      );
    }
    setPendingRemoval(null);
    toast.success(`${email} retiré de la liste de suppression`);
    await fetchList(); // la ligne disparaît
  }, [pendingRemoval, toast, fetchList]);

  return (
    <div data-testid="suppression-list">
      {/* Barre de recherche */}
      <form
        onSubmit={handleSearch}
        role="search"
        aria-label="Rechercher dans la liste de suppression"
        className="mb-4 flex items-center gap-2"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par email, raison ou source…"
          aria-label="Filtrer par email"
          className="w-80 rounded border border-stone-300 px-3 py-1.5 text-sm"
          data-testid="suppression-search-input"
        />
        <button
          type="submit"
          className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
        >
          Rechercher
        </button>
        {appliedQuery.trim() && (
          <button
            type="button"
            onClick={resetSearch}
            className="text-sm text-stone-500 underline-offset-2 hover:underline"
          >
            effacer
          </button>
        )}
      </form>

      {loadError && (
        <div role="alert" className="mb-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div
          data-testid="suppression-skeleton"
          className="rounded-md border border-stone-200 bg-white p-8 text-center text-sm text-stone-500"
        >
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        appliedQuery.trim() ? (
          <EmptyState
            variant="filtered"
            icon="📭"
            title="Aucune adresse ne correspond à cette recherche"
            body={
              <>
                Le filtre « <code>{appliedQuery.trim()}</code> » ne retient aucune adresse
                de la liste de suppression.
              </>
            }
            cta={{ label: 'Réinitialiser le filtre', onClick: resetSearch }}
          />
        ) : (
          <EmptyState
            icon="🟢"
            title="Aucune adresse en suppression"
            body="La liste de suppression est vide — toutes les adresses sont joignables."
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/50">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Adresse
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Raison
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Source
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                  Depuis ({timeZoneLabel(DEFAULT_TIMEZONE)})
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.email} data-testid={`suppression-row-${row.email}`} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-mono text-xs text-stone-800">{row.email}</td>
                  <td className="px-3 py-2 text-stone-700">
                    {reasonLabel(row.reason)}
                    {/* stone-600 : stone-400 sur blanc échoue le contraste AA (axe serious, F01-A-078) */}
                    {row.detail ? <span className="ml-1 text-xs text-stone-600">({row.detail})</span> : null}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{sourceLabel(row.source)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">
                    <time dateTime={row.since}>{formatAbsolute(row.since)}</time>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setPendingRemoval(row.email)}
                      aria-label={`Retirer ${row.email} de la liste de suppression`}
                      data-testid={`suppression-remove-${row.email}`}
                      className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-500">
            <span data-testid="suppression-range">
              {nf.format(rangeStart)}–{nf.format(rangeEnd)} sur {nf.format(total)}
            </span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  disabled={!canPrev}
                  className="rounded border border-stone-300 px-2 py-1 text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  disabled={!canNext}
                  className="rounded border border-stone-300 px-2 py-1 text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation destructive — socle F01 (remplace window.confirm). */}
      <ConfirmDialog
        open={pendingRemoval !== null}
        title={`Retirer ${pendingRemoval ?? ''} de la liste de suppression ?`}
        body={
          <p>
            Cette adresse pourra de nouveau recevoir des emails (transactionnel ET
            campagnes). Ne le faites que si le blocage était une erreur ou sur
            demande de réinscription.
          </p>
        }
        confirmLabel="Retirer"
        busyLabel="Retrait…"
        variant="danger"
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />

      {/* Note pédagogique sur la propagation : le statut canonique « Supprimé » est rappelé. */}
      <p className="mt-3 text-xs text-stone-600">
        Statut concerné dans le cockpit : « {statusLabel('suppressed')} ». Retirer une adresse la
        rend de nouveau joignable pour les envois transactionnels et les campagnes.
      </p>
    </div>
  );
}
