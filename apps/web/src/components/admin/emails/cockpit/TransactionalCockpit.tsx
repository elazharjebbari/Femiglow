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
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export type TransactionalCockpitProps = {
  initialViews: SidebarView[];
};

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

  // Reset selection on filter change
  useEffect(() => {
    setSelected(new Set());
  }, [parseResult.filters.length, parseResult.freetext, sort]);

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

  const handleBulkAction = useCallback(
    async (id: 'retry' | 'suppress' | 'export' | 'clear') => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;

      if (id === 'clear') {
        setSelected(new Set());
        return;
      }
      if (id === 'export') {
        // V1 : à câbler en M5.6 si nécessaire (download CSV).
        window.alert(`Export CSV de ${ids.length} lignes — à implémenter.`);
        return;
      }
      if (id === 'suppress') {
        const ok = window.confirm(`Marquer ${ids.length} email(s) en suppression list ?`);
        if (!ok) return;
        await fetch('/api/admin/emails/transactional/bulk-suppress', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      } else if (id === 'retry') {
        await fetch('/api/admin/emails/transactional/bulk-retry', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      }
      setSelected(new Set());
      await fetchSearch();
      await summary.refresh();
    },
    [selected, fetchSearch, summary],
  );

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
            await fetch(`/api/admin/emails/views/${id}`, { method: 'DELETE' });
            setViews((vs) => vs.filter((v) => v.id !== id));
          }}
          onRename={async (id, newName) => {
            await fetch(`/api/admin/emails/views/${id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: newName }),
            });
            setViews((vs) => vs.map((v) => (v.id === id ? { ...v, name: newName } : v)));
          }}
        />

        <main className="flex-1 space-y-3">
          {selected.size > 0 && (
            <BulkActionsBar
              selectedCount={selected.size}
              actions={memoActions}
              onAction={handleBulkAction}
              onClear={() => setSelected(new Set())}
            />
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
