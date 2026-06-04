'use client';

/**
 * TransactionalCockpit — orchestrateur client-side du cockpit (M5.1.7).
 *
 * Compose KpiHeader + CommandPalette + SavedViewsSidebar + FilteredTable
 * + BulkActionsBar. Gère :
 *  - l'état des filtres (synchronisé URL)
 *  - la sélection multi-ligne
 *  - les appels API (search + summary + bulk actions + views CRUD)
 *  - les confirmations destructives
 *
 * Cf. docs/emailing/admin-evolution/04-ui-ux/01-wizard-spec-master.md §1
 *    docs/emailing/admin-evolution/04-ui-ux/02-mockups/transactional-inbox.txt
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  deserializeFilters,
  parseFilters,
  serializeFilters,
  type ParseResult,
} from '@/lib/mail/transactional/filters-parser';
import type { OutboxSearchRow, SearchSort } from '@/lib/mail/transactional/search';
import { CommandPalette } from './CommandPalette';
import { KpiHeader, useSummary } from './KpiHeader';
import { SavedViewsSidebar, type SidebarView } from './SavedViewsSidebar';
import { FilteredTable } from './FilteredTable';
import { BulkActionsBar } from './BulkActionsBar';

const PAGE_SIZE = 50;

type SearchResultDto = {
  rows: OutboxSearchRow[];
  total: number;
  window: 'matched' | 'truncated';
};

type BulkResultDto = {
  retried?: number;
  skipped?: number;
  skippedIds?: { id: string; reason: string }[];
  suppressed?: number;
};

type BulkNetworkAction = 'retry' | 'suppress';

export type TransactionalCockpitProps = {
  initialViews: SidebarView[];
};

/**
 * Traduit une réponse HTTP en échec en message opérateur lisible. Couvre les
 * formes renvoyées par les routes admin emails : 401 (texte « Unauthorized »),
 * 422 ({ error, issues }), 500 ({ ok:false, error }). Ne lève jamais : si le
 * corps n'est pas exploitable, retombe sur un message générique par statut.
 */
async function describeHttpError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    return 'Session expirée ou non autorisée — reconnecte-toi puis réessaie.';
  }
  let detail: string | null = null;
  try {
    const text = await res.text();
    if (text) {
      try {
        const body = JSON.parse(text) as { error?: unknown; detail?: unknown };
        const raw = body.error ?? body.detail;
        if (typeof raw === 'string' && raw.trim()) detail = raw.trim();
      } catch {
        if (text.trim() && text.trim().toLowerCase() !== 'unauthorized') detail = text.trim();
      }
    }
  } catch {
    /* corps illisible : on reste sur le générique */
  }
  if (res.status === 422) {
    return `Données invalides : ${detail ?? 'la requête a été rejetée par la validation.'}`;
  }
  return detail ?? `Erreur serveur (HTTP ${res.status}). Réessaie dans un instant.`;
}

export function TransactionalCockpit({ initialViews }: TransactionalCockpitProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── État filtres (initialisé depuis URL) ─────────────────────────────
  const [parseResult, setParseResult] = useState<ParseResult>(() =>
    deserializeFilters(new URLSearchParams(searchParams.toString())),
  );
  const [sort, setSort] = useState<SearchSort>('date_desc');
  const [offset, setOffset] = useState(0);

  // ── Données search ───────────────────────────────────────────────────
  const [searchResult, setSearchResult] = useState<SearchResultDto | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchSearch = useCallback(async () => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/admin/emails/transactional/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filters: parseResult.filters,
          freetext: parseResult.freetext,
          pagination: { limit: PAGE_SIZE, offset },
          sort,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as SearchResultDto;
      setSearchResult(body);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  }, [parseResult, offset, sort]);

  useEffect(() => {
    void fetchSearch();
  }, [fetchSearch]);

  // ── KPI summary (auto-refresh 5s) ────────────────────────────────────
  const summary = useSummary({ window: '1h', refreshIntervalMs: 5_000 });

  // ── Sélection ────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Feedback des actions bulk (anti faux-succès) ─────────────────────
  // `bulkBusy` = action réseau en vol (verrou anti double-soumission).
  // `bulkError` = message d'échec visible (role=alert), sélection conservée.
  // `bulkResult` = résultat HONNÊTE d'un succès (retried/skipped/suppressed).
  const [bulkBusy, setBulkBusy] = useState<BulkNetworkAction | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  // Dernière action bulk tentée → permet à « réessayer » de rejouer la bonne.
  const lastBulkActionRef = useRef<BulkNetworkAction | null>(null);

  // Reset selection on filter change
  useEffect(() => {
    setSelected(new Set());
    setBulkError(null);
    setBulkResult(null);
  }, [parseResult.filters.length, parseResult.freetext, sort]);

  // ── Feedback des actions sur les vues (rename/delete) ────────────────
  const [viewsError, setViewsError] = useState<string | null>(null);

  // ── Saved views ──────────────────────────────────────────────────────
  const [views, setViews] = useState<SidebarView[]>(initialViews);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // ── Sync filtres → URL ───────────────────────────────────────────────
  useEffect(() => {
    const params = serializeFilters(parseResult.filters);
    if (parseResult.freetext) params.set('q', parseResult.freetext);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [parseResult, router]);

  // ── Actions ──────────────────────────────────────────────────────────

  const applyParseResult = useCallback((result: ParseResult) => {
    setParseResult(result);
    setOffset(0);
    setActiveViewId(null);
  }, []);

  const handleKpiClick = useCallback(
    (kind: 'delivered' | 'queued' | 'failed' | 'hardBounced') => {
      const statusByKind = {
        delivered: 'status:delivered',
        queued: 'status:pending,sending',
        failed: 'status:failed,dlq',
        hardBounced: 'status:bounced_permanent',
      };
      applyParseResult(parseFilters(statusByKind[kind]));
    },
    [applyParseResult],
  );

  const handleSelectView = useCallback(
    async (viewId: string) => {
      const v = views.find((x) => x.id === viewId);
      if (!v) return;
      setActiveViewId(viewId);
      // Pour V1 on ne recharge pas le filterState complet ici. Reload
      // future itération avec fetch /views/[id] → application des filters.
      // Pour l'instant : juste highlight.
    },
    [views],
  );

  /**
   * Exécute UNE action réseau bulk (retry/suppress) avec garde-fous :
   *  - lit `res.ok` systématiquement → JAMAIS de faux succès ;
   *  - sur échec : message visible (bulkError), sélection CONSERVÉE, pas de
   *    re-fetch masquant ;
   *  - sur succès : feedback honnête (retried/skipped/suppressed), sélection
   *    vidée puis re-fetch + refresh summary ;
   *  - verrou `bulkBusy` = anti double-soumission (bouton désactivé pendant).
   * `ids` est figé à l'appel pour permettre un « réessayer » fidèle.
   */
  const runBulkNetworkAction = useCallback(
    async (action: BulkNetworkAction, ids: string[]) => {
      if (ids.length === 0 || bulkBusy) return;
      const url =
        action === 'retry'
          ? '/api/admin/emails/transactional/bulk-retry'
          : '/api/admin/emails/transactional/bulk-suppress';

      lastBulkActionRef.current = action;
      setBulkBusy(action);
      setBulkError(null);
      setBulkResult(null);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          setBulkError(await describeHttpError(res));
          return; // sélection CONSERVÉE, pas de re-fetch.
        }
        const body = (await res.json().catch(() => ({}))) as BulkResultDto;

        if (action === 'retry') {
          const retried = body.retried ?? 0;
          const skipped = body.skipped ?? 0;
          const parts = [`${retried} relancé${retried > 1 ? 's' : ''}`];
          if (skipped > 0) {
            const reasons = Array.from(
              new Set((body.skippedIds ?? []).map((s) => s.reason)),
            ).join(', ');
            parts.push(
              `${skipped} ignoré${skipped > 1 ? 's' : ''}${reasons ? ` (${reasons})` : ''}`,
            );
          }
          setBulkResult(parts.join(' · '));
        } else {
          const suppressed = body.suppressed ?? 0;
          const skipped = body.skipped ?? 0;
          const parts = [`${suppressed} mis en suppression`];
          if (skipped > 0) parts.push(`${skipped} ignoré${skipped > 1 ? 's' : ''}`);
          setBulkResult(parts.join(' · '));
        }

        // Succès confirmé (res.ok) : on vide la sélection et on rafraîchit.
        setSelected(new Set());
        await fetchSearch();
        await summary.refresh();
      } catch {
        // Erreur réseau (fetch rejette) : message visible, sélection conservée.
        setBulkError(
          'Échec réseau : impossible de joindre le serveur. Vérifie ta connexion puis réessaie.',
        );
      } finally {
        setBulkBusy(null);
      }
    },
    [bulkBusy, fetchSearch, summary],
  );

  const handleBulkAction = useCallback(
    (id: 'retry' | 'suppress' | 'export' | 'clear') => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      if (bulkBusy) return; // verrou anti double-soumission

      if (id === 'clear') {
        setSelected(new Set());
        setBulkError(null);
        setBulkResult(null);
        return;
      }
      if (id === 'export') {
        // V1 : à câbler en M5.6 si nécessaire (download CSV).
        window.alert(`Export CSV de ${ids.length} lignes — à implémenter.`);
        return;
      }
      if (id === 'suppress') {
        const ok = window.confirm(`Marquer ${ids.length} email(s) en suppression list ?`);
        if (!ok) return; // confirmation annulée : aucun POST, sélection conservée.
      }
      void runBulkNetworkAction(id, ids);
    },
    [selected, bulkBusy, runBulkNetworkAction],
  );

  // Réessayer la dernière action échouée (bouton dans l'alerte d'erreur).
  const retryLastBulk = useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !bulkError) return;
    // L'action est déduite du verrou nominal : on relit le dernier type via le
    // libellé n'est pas fiable → on réessaie l'action courante stockée.
    void runBulkNetworkAction(lastBulkActionRef.current ?? 'retry', ids);
  }, [selected, bulkError, runBulkNetworkAction]);

  const memoActions = useMemo(
    () => [
      { id: 'retry' as const, label: `Retry (${selected.size})` },
      { id: 'suppress' as const, label: 'Marquer en suppression', danger: true },
      { id: 'export' as const, label: 'Exporter CSV' },
    ],
    [selected.size],
  );

  return (
    <div>
      {/* Header KPI */}
      <div className="mb-6">
        <KpiHeader
          data={summary.data}
          isLoading={summary.isLoading}
          isRefreshing={summary.isRefreshing}
          error={summary.error}
          onRefresh={summary.refresh}
          onKpiClick={handleKpiClick}
        />
      </div>

      {/* Help bar : Cmd+K + filtres résolus */}
      <div className="mb-4 flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
        <span>
          <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono">⌘K</kbd>{' '}
          pour filtrer
        </span>
        {parseResult.filters.length > 0 && (
          <>
            <span className="text-stone-300">·</span>
            <span>
              {parseResult.filters.length} filtre{parseResult.filters.length > 1 ? 's' : ''} actif
              {parseResult.filters.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => applyParseResult(parseFilters(''))}
              className="ml-2 text-stone-500 underline-offset-2 hover:underline"
            >
              effacer
            </button>
          </>
        )}
      </div>

      {/* Layout principal : sidebar + tableau */}
      <div className="flex gap-4">
        <SavedViewsSidebar
          views={views}
          activeViewId={activeViewId}
          onSelect={handleSelectView}
          onCreate={() => window.alert('Création de vue — à implémenter avec le wizard de save.')}
          onDelete={async (id) => {
            if (!window.confirm('Supprimer cette vue ?')) return;
            setViewsError(null);
            try {
              const res = await fetch(`/api/admin/emails/views/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                setViewsError(await describeHttpError(res));
                return; // pas de retrait optimiste sur échec.
              }
              setViews((vs) => vs.filter((v) => v.id !== id));
            } catch {
              setViewsError('Échec réseau : la vue n’a pas pu être supprimée.');
            }
          }}
          onRename={async (id, newName) => {
            setViewsError(null);
            try {
              const res = await fetch(`/api/admin/emails/views/${id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: newName }),
              });
              if (!res.ok) {
                setViewsError(await describeHttpError(res));
                return; // pas de renommage optimiste sur échec.
              }
              setViews((vs) => vs.map((v) => (v.id === id ? { ...v, name: newName } : v)));
            } catch {
              setViewsError('Échec réseau : la vue n’a pas pu être renommée.');
            }
          }}
        />
        {viewsError && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700"
          >
            {viewsError}
          </div>
        )}

        <main className="flex-1 space-y-3">
          {selected.size > 0 && (
            <BulkActionsBar
              selectedCount={selected.size}
              actions={memoActions}
              onAction={handleBulkAction}
              onClear={() => setSelected(new Set())}
              busyActionId={bulkBusy}
            />
          )}

          {/* Résultat HONNÊTE d'une action bulk réussie (retried/skipped/suppressed). */}
          {bulkResult && (
            <div
              data-testid="bulk-action-feedback"
              className="rounded-md border border-sage-300 bg-sage-50 p-3 text-sm text-sage-800"
            >
              <span aria-hidden="true" className="mr-1.5">✓</span>
              {bulkResult}
              <button
                type="button"
                onClick={() => setBulkResult(null)}
                aria-label="Masquer le résultat"
                className="ml-3 text-sage-600 underline-offset-2 hover:underline"
              >
                OK
              </button>
            </div>
          )}

          {/* Échec d'une action bulk : message visible + réessayer. Sélection conservée. */}
          {bulkError && (
            <div
              role="alert"
              data-testid="bulk-action-error"
              className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
            >
              <span>{bulkError}</span>
              <button
                type="button"
                onClick={retryLastBulk}
                disabled={bulkBusy !== null}
                className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Réessayer
              </button>
            </div>
          )}

          {searchError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              Erreur : {searchError}
            </div>
          )}

          <FilteredTable
            rows={searchResult?.rows ?? []}
            total={searchResult?.total ?? 0}
            isLoading={isSearching}
            selectedIds={selected}
            onSelectionChange={setSelected}
            sort={sort}
            onSortChange={setSort}
            onRowClick={(id) => router.push(`/admin/emails/transactional/${id}`)}
          />
        </main>
      </div>

      {/* Palette ⌘K (toujours montée, contrôlée en interne) */}
      <CommandPalette
        savedViews={views}
        onApply={applyParseResult}
        onSelectView={handleSelectView}
      />
    </div>
  );
}
