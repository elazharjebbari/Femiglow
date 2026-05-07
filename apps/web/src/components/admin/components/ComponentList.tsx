'use client';

import Link from 'next/link';
import type { SiteComponent } from '@/lib/db/types';
import { SelectAllCheckbox } from './SelectAllCheckbox';

export interface ComponentListCounts {
  active: number;
  total: number;
  drafts?: number;
}

interface ComponentListProps {
  groupKey: string;
  components: SiteComponent[];
  counts: Map<string, ComponentListCounts>;
  /** Mode sélection — affiche checkboxes + "tout sélectionner" du groupe. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleOne?: (id: string, next: boolean) => void;
  onToggleGroup?: (componentIds: string[], next: boolean) => void;
}

const GROUP_LABEL: Record<string, string> = {
  home: 'Accueil',
  rituel: 'Rituel',
  kit: 'Kit',
  maison: 'Maison',
  journal: 'Journal',
  shared: 'Partagé',
};

export function ComponentList({
  groupKey,
  components,
  counts,
  selectable,
  selectedIds,
  onToggleOne,
  onToggleGroup,
}: ComponentListProps) {
  const label = GROUP_LABEL[groupKey] ?? groupKey;
  const groupIds = components.map((c) => c.id);
  const groupSelectedCount = selectedIds
    ? groupIds.filter((id) => selectedIds.has(id)).length
    : 0;

  return (
    <section aria-labelledby={`grp-${groupKey}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`grp-${groupKey}`}
          className="text-xs font-semibold uppercase tracking-wider text-stone-500"
        >
          {label} ({components.length})
        </h2>
        {selectable && components.length > 0 && (
          <SelectAllCheckbox
            totalCount={components.length}
            selectedCount={groupSelectedCount}
            onChange={(next) => onToggleGroup?.(groupIds, next)}
            label={`Sélectionner tous les composants (${label})`}
          />
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {components.map((c) => {
          const cnt = counts.get(c.id) ?? { active: 0, total: 0, drafts: 0 };
          const checked = selectedIds?.has(c.id) ?? false;
          return (
            <li
              key={c.id}
              className={`relative rounded-lg border bg-white transition focus-within:ring-2 focus-within:ring-stone-900 ${
                checked
                  ? 'border-emerald-400 ring-2 ring-emerald-200'
                  : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              {selectable && (
                <label
                  className="absolute left-2 top-2 z-10 flex cursor-pointer items-center rounded bg-white/85 p-1 backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="sr-only">Sélectionner {c.name}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggleOne?.(c.id, e.currentTarget.checked)}
                    aria-label={`Sélectionner ${c.name}`}
                    data-testid={`component-select-${c.key}`}
                    className="h-4 w-4 cursor-pointer rounded border-stone-300"
                  />
                </label>
              )}
              <Link
                href={`/admin/components/${c.key}`}
                className={`block rounded-lg p-4 focus-visible:outline-none ${
                  selectable ? 'pl-10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{c.key}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        cnt.active > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : cnt.total > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {cnt.active}/{c.slots.length} actif{cnt.active === 1 ? '' : 's'}
                    </span>
                    {cnt.drafts !== undefined && cnt.drafts > 0 && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        {cnt.drafts} draft{cnt.drafts > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {c.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-stone-600">{c.description}</p>
                )}
                <p className="mt-3 text-[11px] uppercase tracking-wide text-stone-400">
                  {c.category} · {c.defaultLoadingStrategy}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
