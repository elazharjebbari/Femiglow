'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCommand, type StudioCommand } from '@/lib/content-studio-v2/state/CommandRegistry';
import { LibraryFilters } from './LibraryFilters';
import { LibrarySearch } from './LibrarySearch';
import { LibraryGrid } from './LibraryGrid';
import { BulkActionBar } from './BulkActionBar';
import {
  applyFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
} from '@/lib/content-studio-v2/library/filters';
import {
  clearSelection,
  selectedItems,
  toggleSelection,
} from '@/lib/content-studio-v2/library/selection';
import type {
  LibraryFilterState,
  LibraryItem,
} from '@/lib/content-studio-v2/library/types';

interface Props {
  initialItems: LibraryItem[];
}

/**
 * Orchestrateur client pour le mode /library.
 *
 * Source de vérité : URL (`useSearchParams`). À chaque changement de
 * filtre on `router.replace(?status=...)` (shallow, sans scroll).
 * Le composant lit les params au mount + à chaque update — `filters`
 * dérive donc des params (avec `useMemo` pour la stabilité).
 *
 * Le `selection` est ephemeral (client-only), reset à chaque changement
 * de filtre majeur.
 *
 * `items` est local pour permettre l'optimistic update (archiver enlève
 * la card du grid immédiatement, puis la mutation API confirme/rollback).
 */
export function LibraryClient({ initialItems }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [selection, setSelection] = useState<Record<string, true>>({});

  // Resync items if the server pushed a new snapshot (e.g. after a hard
  // navigation back to /library).
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filters: LibraryFilterState = useMemo(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? '');
    return filtersFromSearchParams(p);
  }, [searchParams]);

  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  const updateFilters = useCallback(
    (next: LibraryFilterState) => {
      const params = filtersToSearchParams(next);
      const qs = params.toString();
      const url = qs.length > 0 ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  const handleSearchChange = useCallback(
    (search: string) => {
      updateFilters({ ...filters, search });
    },
    [filters, updateFilters],
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelection((prev) => toggleSelection(prev, id));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection(clearSelection());
  }, []);

  const handleDuplicate = useCallback(async (item: LibraryItem) => {
    try {
      const res = await fetch(`/api/admin/content-studio/drafts/${item.draftId}/variation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        toast.error('La duplication a échoué.');
        return;
      }
      toast.success('Variante créée. Recharge la liste pour la voir.');
    } catch {
      toast.error('Erreur réseau lors de la duplication.');
    }
  }, []);

  const handleArchiveOne = useCallback(async (item: LibraryItem) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      const endpoint = item.postId
        ? `/api/admin/content-studio/posts/${item.postId}/archive`
        : `/api/admin/content-studio/drafts/${item.draftId}/archive`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        setItems(previous);
        toast.error('Archivage refusé par le serveur.');
        return;
      }
      toast.success('Archivé.');
    } catch {
      setItems(previous);
      toast.error('Erreur réseau lors de l’archivage.');
    }
  }, [items]);

  const handleBulkActionDone = useCallback((kind: 'approve' | 'schedule' | 'archive', item: LibraryItem) => {
    if (kind === 'archive') {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
    // Pour `approve` on laisse le serveur pousser un refresh — le statut
    // changera au prochain render server. En attendant on patche localement.
    if (kind === 'approve') {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'approved' } : i)));
    }
  }, []);

  const selectedList = useMemo(
    () => selectedItems(filteredItems, selection),
    [filteredItems, selection],
  );

  // Bulk actions exposed via the palette — wrap the existing handler so the
  // command palette can drive the same code path as the sticky BulkActionBar.
  const runBulk = useCallback(
    async (kind: 'approve' | 'archive') => {
      if (selectedList.length === 0) return;
      const results = await Promise.allSettled(
        selectedList.map(async (item) => {
          if (kind === 'approve') {
            const res = await fetch(`/api/admin/content-studio/drafts/${item.draftId}/approve`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
            });
            if (res.ok) handleBulkActionDone('approve', item);
            return res.ok;
          }
          const endpoint = item.postId
            ? `/api/admin/content-studio/posts/${item.postId}/archive`
            : `/api/admin/content-studio/drafts/${item.draftId}/archive`;
          const res = await fetch(endpoint, { method: 'POST' });
          if (res.ok) handleBulkActionDone('archive', item);
          return res.ok;
        }),
      );
      const ok = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
      const ko = results.length - ok;
      if (ko === 0) {
        toast.success(kind === 'approve' ? `${ok} draft${ok > 1 ? 's' : ''} approuvé${ok > 1 ? 's' : ''}.` : `${ok} élément${ok > 1 ? 's' : ''} archivé${ok > 1 ? 's' : ''}.`);
      } else if (ok === 0) {
        toast.error(`Échec sur ${ko} élément${ko > 1 ? 's' : ''}.`);
      } else {
        toast.warning(`${ok} OK / ${ko} en échec.`);
      }
      if (ok > 0) handleClearSelection();
    },
    [selectedList, handleBulkActionDone, handleClearSelection],
  );

  const selectionCount = selectedList.length;
  useCommand(useMemo<StudioCommand | null>(
    () => (selectionCount > 0 ? {
      id: 'library.approve-selected',
      group: 'Bibliothèque',
      label: `Approuver la sélection (${selectionCount})`,
      icon: <Check size={14} />,
      perform: () => { void runBulk('approve'); },
    } : null),
    [selectionCount, runBulk],
  ));
  useCommand(useMemo<StudioCommand | null>(
    () => (selectionCount > 0 ? {
      id: 'library.archive-selected',
      group: 'Bibliothèque',
      label: `Archiver la sélection (${selectionCount})`,
      icon: <Archive size={14} />,
      perform: () => { void runBulk('archive'); },
    } : null),
    [selectionCount, runBulk],
  ));
  useCommand(useMemo<StudioCommand | null>(
    () => (selectionCount > 0 ? {
      id: 'library.clear-selection',
      group: 'Bibliothèque',
      label: 'Effacer la sélection',
      shortcut: 'esc',
      icon: <X size={14} />,
      perform: handleClearSelection,
    } : null),
    [selectionCount, handleClearSelection],
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1
          className="cs-display"
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-3xl)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            color: 'var(--cs-fg-primary)',
            margin: 0,
          }}
        >
          Bibliothèque
        </h1>
        <LibrarySearch initialValue={filters.search} onChange={handleSearchChange} />
      </div>

      <LibraryFilters
        filters={filters}
        onChange={updateFilters}
        resultCount={filteredItems.length}
        totalCount={items.length}
      />

      <ResponsiveGrid>
        <LibraryGrid
          items={filteredItems}
          selection={selection}
          onToggleSelect={handleToggleSelect}
          onDuplicate={handleDuplicate}
          onArchive={handleArchiveOne}
        />
      </ResponsiveGrid>

      <BulkActionBar
        items={selectedList}
        onClear={handleClearSelection}
        onActionDone={handleBulkActionDone}
      />
    </div>
  );
}

/**
 * Wrapper qui force, en mobile (<640px), le grid à passer à 2 colonnes
 * exactes plutôt que de laisser `auto-fill` produire 1 colonne très large.
 * Le LibraryGrid utilise `minmax(min(100%, 240px), 1fr)` mais on veut
 * 2 colonnes minimum sur petit écran : on injecte une règle responsive.
 */
function ResponsiveGrid({ children }: { children: React.ReactNode }) {
  return <div className="cs-library-grid-wrap">{children}</div>;
}

if (typeof document !== 'undefined' && !document.getElementById('cs-library-responsive')) {
  const style = document.createElement('style');
  style.id = 'cs-library-responsive';
  style.textContent = `
    @media (max-width: 640px) {
      .cs-library-grid-wrap ul[role="list"] {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}
