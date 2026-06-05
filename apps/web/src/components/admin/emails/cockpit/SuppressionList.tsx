'use client';

/**
 * SuppressionList — écran client de la liste de suppression (UX-COCKPIT-001).
 *
 * Rend la `email_suppression` enfin CONSULTABLE et RÉVERSIBLE : table paginée +
 * recherche (email / raison / source) + bouton « Retirer » avec confirmation
 * explicite (réinscription RGPD, faux positif bounce). Chaque retrait appelle
 * DELETE /api/admin/emails/suppression et fait disparaître la ligne — sans faux
 * succès (on lit `res.ok` ; échec → message visible, ligne conservée).
 *
 * A11y : table, role=status pour le feedback de succès, role=alert pour l'erreur,
 * anti double-clic (bouton désactivé pendant la mutation), libellés FR.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { statusLabel } from '@/components/admin/emails/common/StatusBadge';

const ROUTE = '/api/admin/emails/suppression';
const PAGE_SIZE = 50;

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
  const [query, setQuery] = useState(initialEmail);
  // Terme de recherche réellement appliqué (debounce léger via submit explicite).
  const [appliedQuery, setAppliedQuery] = useState(initialEmail);
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<ListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mutation en vol (verrou anti double-clic) + feedback.
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeOk, setRemoveOk] = useState<string | null>(null);

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

  const handleRemove = useCallback(
    async (email: string) => {
      if (removingEmail) return; // verrou anti double-clic
      const ok = window.confirm(
        `Retirer ${email} de la liste de suppression ?\n\n` +
          `Cette adresse pourra de nouveau recevoir des emails (transactionnel ET campagnes). ` +
          `Ne le faites que si le blocage était une erreur ou sur demande de réinscription.`,
      );
      if (!ok) return;

      setRemovingEmail(email);
      setRemoveError(null);
      setRemoveOk(null);
      try {
        const res = await fetch(ROUTE, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          setRemoveError(
            res.status === 401 || res.status === 403
              ? 'Session expirée ou non autorisée — reconnecte-toi puis réessaie.'
              : `Le retrait a échoué (HTTP ${res.status}). Réessaie dans un instant.`,
          );
          return; // ligne CONSERVÉE, pas de faux succès.
        }
        setRemoveOk(`${email} retiré de la liste de suppression.`);
        // Recharge la liste : la ligne disparaît.
        await fetchList();
      } catch {
        setRemoveError('Échec réseau : impossible de joindre le serveur. Réessaie.');
      } finally {
        setRemovingEmail(null);
      }
    },
    [removingEmail, fetchList],
  );

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
            onClick={() => {
              setQuery('');
              setAppliedQuery('');
              setOffset(0);
            }}
            className="text-sm text-stone-500 underline-offset-2 hover:underline"
          >
            effacer
          </button>
        )}
      </form>

      {/* Feedback succès (role=status) */}
      {removeOk && (
        <div
          role="status"
          data-testid="suppression-remove-ok"
          className="mb-3 rounded-md border border-sage-300 bg-sage-50 p-3 text-sm text-sage-800"
        >
          <span aria-hidden="true" className="mr-1.5">✓</span>
          {removeOk}
        </div>
      )}

      {/* Feedback erreur (role=alert) */}
      {removeError && (
        <div
          role="alert"
          data-testid="suppression-remove-error"
          className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {removeError}
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
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
        <div
          data-testid="suppression-empty"
          className="rounded-md border border-stone-200 bg-white p-12 text-center"
        >
          <div className="mb-2 text-3xl">🟢</div>
          <h3 className="text-base font-medium text-stone-900">Aucune adresse en suppression</h3>
          <p className="mt-1 text-sm text-stone-500">
            {appliedQuery.trim()
              ? 'Aucun résultat pour cette recherche.'
              : 'La liste de suppression est vide.'}
          </p>
        </div>
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
                  Depuis
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => {
                const busy = removingEmail === row.email;
                return (
                  <tr key={row.email} data-testid={`suppression-row-${row.email}`} className="hover:bg-stone-50">
                    <td className="px-3 py-2 font-mono text-xs text-stone-800">{row.email}</td>
                    <td className="px-3 py-2 text-stone-700">
                      {reasonLabel(row.reason)}
                      {row.detail ? <span className="ml-1 text-xs text-stone-400">({row.detail})</span> : null}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{sourceLabel(row.source)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-500">
                      {new Date(row.since).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRemove(row.email)}
                        disabled={removingEmail !== null}
                        aria-label={`Retirer ${row.email} de la liste de suppression`}
                        data-testid={`suppression-remove-${row.email}`}
                        className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? 'Retrait…' : 'Retirer'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-500">
            <span data-testid="suppression-range">
              {rangeStart.toLocaleString('fr-FR')}–{rangeEnd.toLocaleString('fr-FR')} sur{' '}
              {total.toLocaleString('fr-FR')}
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

      {/* Note pédagogique sur la propagation : le statut canonique « Supprimé » est rappelé. */}
      <p className="mt-3 text-xs text-stone-400">
        Statut concerné dans le cockpit : « {statusLabel('suppressed')} ». Retirer une adresse la
        rend de nouveau joignable pour les envois transactionnels et les campagnes.
      </p>
    </div>
  );
}
