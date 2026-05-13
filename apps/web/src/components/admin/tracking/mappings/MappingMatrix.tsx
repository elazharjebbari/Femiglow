'use client';

import { useState, useCallback } from 'react';
import type {
  MappingCell,
  MappingProviderKind,
  Mappings,
} from '@/lib/tracking/mappings/types';
import { PROVIDER_KINDS_FOR_MAPPING } from '@/lib/tracking/mappings/types';

/**
 * Tableau pivot Event × Provider. Édition par cellule via popover.
 * cf. docs/event-mappings/50-ui-ux-design/wireframes/matrix-mapping.txt
 */
interface Props {
  mappings: Mappings;
  readOnly?: boolean;
  onChange?: (next: Mappings) => void;
}

const PROVIDER_LABEL: Record<MappingProviderKind, string> = {
  meta: 'Meta',
  google_ga4: 'GA4',
  google_ads: 'Google Ads',
  tiktok: 'TikTok',
  snap: 'Snap',
  pinterest: 'Pinterest',
};

export function MappingMatrix({ mappings, readOnly = false, onChange }: Props) {
  const events = Object.keys(mappings).sort();
  const [filter, setFilter] = useState('');
  const [editingCell, setEditingCell] = useState<{ event: string; provider: MappingProviderKind } | null>(null);

  const visible = events.filter((e) => filter === '' || e.toLowerCase().includes(filter.toLowerCase()));

  const updateCell = useCallback((event: string, provider: MappingProviderKind, next: MappingCell) => {
    if (!onChange) return;
    const updated: Mappings = {
      ...mappings,
      [event]: {
        ...mappings[event]!,
        [provider]: next,
      },
    };
    onChange(updated);
  }, [mappings, onChange]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Filtrer par event…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="block w-64 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
        data-testid="matrix-filter"
      />
      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm" data-testid="mapping-matrix">
          <caption className="sr-only">Matrice mappings event canonique × provider vendor</caption>
          <thead className="sticky top-0 bg-stone-50">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-stone-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">Event</th>
              {PROVIDER_KINDS_FOR_MAPPING.map((p) => (
                <th key={p} scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                  {PROVIDER_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {visible.map((event) => (
              <tr key={event}>
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-mono text-xs text-stone-900">
                  {event}
                </th>
                {PROVIDER_KINDS_FOR_MAPPING.map((p) => {
                  const cell = mappings[event]?.[p];
                  const isEditing = editingCell?.event === event && editingCell?.provider === p;
                  return (
                    <td key={p} className="relative px-3 py-2 align-top">
                      {isEditing && !readOnly ? (
                        <CellPopover
                          event={event}
                          provider={p}
                          cell={cell ?? { mappedName: null, isCustom: false, isEnabled: true, notes: null }}
                          onSave={(next) => { updateCell(event, p, next); setEditingCell(null); }}
                          onCancel={() => setEditingCell(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setEditingCell({ event, provider: p })}
                          data-testid={`cell-${event}-${p}`}
                          className={`block w-full rounded border px-2 py-1 text-left text-xs ${
                            !cell || !cell.mappedName
                              ? 'border-dashed border-stone-300 text-stone-400'
                              : !cell.isEnabled
                              ? 'border-stone-300 bg-stone-50 text-stone-400 line-through'
                              : 'border-stone-200 bg-white text-stone-900 hover:bg-stone-50'
                          } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className="font-mono">{cell?.mappedName ?? '—'}</span>
                          {cell?.isCustom ? <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-800">custom</span> : null}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-stone-500">Aucun event correspondant.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellPopover(props: {
  event: string;
  provider: MappingProviderKind;
  cell: MappingCell;
  onSave: (cell: MappingCell) => void;
  onCancel: () => void;
}) {
  const [mappedName, setMappedName] = useState(props.cell.mappedName ?? '');
  const [isCustom, setIsCustom] = useState(props.cell.isCustom);
  const [isEnabled, setIsEnabled] = useState(props.cell.isEnabled);
  const [notes, setNotes] = useState(props.cell.notes ?? '');

  function handleSave() {
    props.onSave({
      mappedName: mappedName.trim() === '' ? null : mappedName.trim(),
      isCustom,
      isEnabled,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
  }

  return (
    <div role="dialog" aria-modal="true" className="absolute left-0 top-full z-20 mt-1 w-80 rounded-md border border-stone-300 bg-white p-3 shadow-lg">
      <div className="mb-2 text-xs font-medium text-stone-700">{props.event} × {props.provider}</div>
      <label className="block">
        <span className="block text-[10px] uppercase tracking-wide text-stone-500">Nom vendor (vide = pas de dispatch)</span>
        <input
          type="text"
          autoFocus
          value={mappedName}
          onChange={(e) => setMappedName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') props.onCancel(); if (e.key === 'Enter') handleSave(); }}
          className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 font-mono text-xs"
          data-testid={`cell-input-${props.event}-${props.provider}`}
        />
      </label>
      {props.provider === 'meta' ? (
        <label className="mt-2 flex items-center gap-1 text-xs">
          <input type="checkbox" checked={isCustom} onChange={(e) => setIsCustom(e.target.checked)} />
          Custom event Meta (trackCustom)
        </label>
      ) : null}
      <label className="mt-1 flex items-center gap-1 text-xs">
        <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
        Activé
      </label>
      <label className="mt-2 block">
        <span className="block text-[10px] uppercase tracking-wide text-stone-500">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={200} className="mt-1 block w-full rounded border border-stone-300 px-2 py-1 text-xs" />
      </label>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={props.onCancel} className="text-xs text-stone-600 hover:text-stone-900">Annuler</button>
        <button type="button" onClick={handleSave} data-testid={`cell-save-${props.event}-${props.provider}`} className="rounded bg-stone-900 px-2 py-1 text-xs text-white">Appliquer</button>
      </div>
    </div>
  );
}
