'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SiteComponent } from '@/lib/db/types';
import { ComponentList, type ComponentListCounts } from './ComponentList';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import {
  ComponentBulkActionBar,
  type ComponentBulkAction,
} from './ComponentBulkActionBar';

export interface ComponentsBulkPanelProps {
  /** Groupes ordonnés (clé → liste de composants). */
  groups: Array<{ key: string; components: SiteComponent[] }>;
  /** Statistiques pré-calculées côté serveur (id composant → counts). */
  counts: Record<string, ComponentListCounts>;
}

export function ComponentsBulkPanel({ groups, counts }: ComponentsBulkPanelProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allComponents = useMemo(
    () => groups.flatMap((g) => g.components),
    [groups],
  );
  const allIds = useMemo(() => allComponents.map((c) => c.id), [allComponents]);

  const countsMap = useMemo(() => {
    const m = new Map<string, ComponentListCounts>();
    for (const [id, c] of Object.entries(counts)) m.set(id, c);
    return m;
  }, [counts]);

  const stats = useMemo(() => {
    let bindings = 0;
    let drafts = 0;
    for (const id of selectedIds) {
      const c = countsMap.get(id);
      if (!c) continue;
      bindings += c.total;
      drafts += c.drafts ?? 0;
    }
    return { bindings, drafts };
  }, [selectedIds, countsMap]);

  function toggleAll(next: boolean) {
    if (next) setSelectedIds(new Set(allIds));
    else setSelectedIds(new Set());
  }

  function toggleOne(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function toggleGroup(componentIds: string[], next: boolean) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      for (const id of componentIds) {
        if (next) copy.add(id);
        else copy.delete(id);
      }
      return copy;
    });
  }

  async function runBulk(action: ComponentBulkAction) {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/components/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          componentIds: Array.from(selectedIds),
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; affected?: { components: number; bindings?: number; fields?: number }; summary?: { published: number; skipped: number; failed: number }; error?: { message?: string } }
        | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? 'Erreur lors de l’opération groupée');
        return;
      }
      const aff = body.affected;
      if (action === 'publish-drafts') {
        const pub = body.summary?.published ?? aff?.fields ?? 0;
        const fail = body.summary?.failed ?? 0;
        setFeedback(
          fail > 0
            ? `${pub} draft(s) publié(s), ${fail} échec(s).`
            : `${pub} draft(s) publié(s) sur ${aff?.components ?? 0} composant(s).`,
        );
      } else {
        const verb = action === 'activate-bindings' ? 'activé' : 'désactivé';
        setFeedback(
          `${aff?.bindings ?? 0} binding(s) ${verb}(s) sur ${aff?.components ?? 0} composant(s).`,
        );
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-2">
        <SelectAllCheckbox
          totalCount={allIds.length}
          selectedCount={selectedIds.size}
          onChange={toggleAll}
          label={`Tout sélectionner (${allIds.length})`}
        />
        {selectedIds.size > 0 && (
          <p className="text-xs text-stone-600" data-testid="components-bulk-summary">
            {selectedIds.size} composant{selectedIds.size > 1 ? 's' : ''} ·{' '}
            {stats.bindings} binding{stats.bindings > 1 ? 's' : ''} ·{' '}
            {stats.drafts} draft{stats.drafts > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <ComponentBulkActionBar
        count={selectedIds.size}
        bindingsInSelection={stats.bindings}
        draftsInSelection={stats.drafts}
        busy={busy}
        onActivateBindings={() => runBulk('activate-bindings')}
        onDeactivateBindings={() => runBulk('deactivate-bindings')}
        onPublishDrafts={() => runBulk('publish-drafts')}
        onClear={() => setSelectedIds(new Set())}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {feedback}
        </p>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <ComponentList
            key={g.key}
            groupKey={g.key}
            components={g.components}
            counts={countsMap}
            selectable
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleGroup={toggleGroup}
          />
        ))}
      </div>
    </div>
  );
}
