'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Button } from '../primitives';
import {
  CONTENT_PILLARS,
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
} from '@/lib/content-studio/types';
import type {
  ContentPillar,
  ContentPlatform,
  ContentStatus,
} from '@/lib/content-studio/types';
import type { LibraryFilterState } from '@/lib/content-studio-v2/library/types';
import { filtersAreEmpty } from '@/lib/content-studio-v2/library/filters';
import { presentStatus } from '@/lib/content-studio-v2/library/status';

interface Props {
  filters: LibraryFilterState;
  onChange: (next: LibraryFilterState) => void;
  /** Result count after filters apply — affiché à droite de la barre. */
  resultCount: number;
  /** Total count before filters (for the "X / Y résultats" indicator). */
  totalCount: number;
}

const PILLAR_LABELS: Record<ContentPillar, string> = {
  rituel: 'Rituel',
  produit: 'Produit',
  preuve: 'Preuve',
  journal: 'Journal',
  maison: 'Maison',
  reassurance: 'Réassurance',
  saison: 'Saison',
  coulisses: 'Coulisses',
};
const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

/**
 * Toolbar de filtres URL-synced. Le parent (`LibraryClient`) est le
 * propriétaire du `filters`, on émet juste un `onChange(next)`.
 *
 * - Statut : multiselect via Popover.
 * - Plateforme / Pilier : single select (boutons inline).
 * - Date range : `<input type="date">` natifs (suffisant et a11y).
 */
export function LibraryFilters({ filters, onChange, resultCount, totalCount }: Props) {
  function toggleStatus(status: ContentStatus) {
    const has = filters.statuses.includes(status);
    onChange({
      ...filters,
      statuses: has
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status],
    });
  }

  function setPlatform(platform: LibraryFilterState['platform']) {
    onChange({ ...filters, platform });
  }
  function setPillar(pillar: LibraryFilterState['pillar']) {
    onChange({ ...filters, pillar });
  }
  function setDateFrom(value: string) {
    onChange({ ...filters, dateFrom: value.length > 0 ? value : null });
  }
  function setDateTo(value: string) {
    onChange({ ...filters, dateTo: value.length > 0 ? value : null });
  }
  function reset() {
    onChange({
      statuses: [],
      platform: 'all',
      pillar: 'all',
      dateFrom: null,
      dateTo: null,
      search: filters.search, // keep search input — le composant search a sa propre boucle
    });
  }

  const hasActiveFilters = !filtersAreEmpty(filters) || filters.statuses.length > 0;

  return (
    <div
      role="toolbar"
      aria-label="Filtres bibliothèque"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        padding: '12px 14px',
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      <StatusMultiselect filters={filters} onToggle={toggleStatus} />

      <SinglePicker
        label="Plateforme"
        value={filters.platform}
        options={[
          { value: 'all', label: 'Toutes' },
          ...CONTENT_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })),
        ]}
        onChange={(v) => setPlatform(v as LibraryFilterState['platform'])}
      />

      <SinglePicker
        label="Pilier"
        value={filters.pillar}
        options={[
          { value: 'all', label: 'Tous' },
          ...CONTENT_PILLARS.map((p) => ({ value: p, label: PILLAR_LABELS[p] })),
        ]}
        onChange={(v) => setPillar(v as LibraryFilterState['pillar'])}
      />

      <DateRange
        from={filters.dateFrom}
        to={filters.dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
      />

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={reset} leftIcon={<X size={12} />}>
          Réinitialiser
        </Button>
      ) : null}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-live="polite"
          style={{
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-secondary)',
            fontFamily: 'var(--cs-font-mono)',
          }}
        >
          {resultCount} / {totalCount} {totalCount > 1 ? 'résultats' : 'résultat'}
        </span>
      </div>
    </div>
  );
}

// --- Status multiselect (Popover) -------------------------------------

function StatusMultiselect({
  filters,
  onToggle,
}: {
  filters: LibraryFilterState;
  onToggle: (status: ContentStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = filters.statuses.length;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="cs-btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          style={triggerStyle(selectedCount > 0)}
        >
          <Filter size={12} />
          <span>Statut</span>
          {selectedCount > 0 ? (
            <span
              style={{
                background: 'var(--cs-accent)',
                color: 'var(--cs-fg-on-accent)',
                fontSize: 10,
                padding: '0 6px',
                borderRadius: 'var(--cs-radius-full)',
                marginLeft: 2,
              }}
            >
              {selectedCount}
            </span>
          ) : null}
          <ChevronDown size={12} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-md)',
            padding: 8,
            boxShadow: 'var(--cs-shadow-lg)',
            zIndex: 50,
            minWidth: 220,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          <ul role="listbox" aria-multiselectable style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {CONTENT_STATUSES.map((status) => {
              const checked = filters.statuses.includes(status);
              const presentation = presentStatus(status);
              return (
                <li key={status}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 'var(--cs-radius-sm)',
                      cursor: 'pointer',
                      fontSize: 'var(--cs-text-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(status)}
                      aria-label={presentation.label}
                    />
                    <span style={{ color: 'var(--cs-fg-primary)' }}>{presentation.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Single picker (Popover) ------------------------------------------

function SinglePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== 'all';
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="cs-btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          style={triggerStyle(active)}
        >
          <span style={{ color: 'var(--cs-fg-secondary)' }}>{label} :</span>
          <span>{current?.label}</span>
          <ChevronDown size={12} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-md)',
            padding: 6,
            boxShadow: 'var(--cs-shadow-lg)',
            zIndex: 50,
            minWidth: 180,
          }}
        >
          <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: 'var(--cs-radius-sm)',
                      background: selected ? 'var(--cs-bg-sunken)' : 'transparent',
                      color: 'var(--cs-fg-primary)',
                      border: 'none',
                      fontSize: 'var(--cs-text-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Date range -------------------------------------------------------

function DateRange({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string | null;
  to: string | null;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        border: '1px solid var(--cs-border)',
        borderRadius: 'var(--cs-radius)',
        background: 'var(--cs-bg-base)',
      }}
    >
      <span style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>Du</span>
      <input
        type="date"
        value={from ?? ''}
        onChange={(e) => onFromChange(e.target.value)}
        aria-label="Date de début"
        style={dateInputStyle}
      />
      <span style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>au</span>
      <input
        type="date"
        value={to ?? ''}
        onChange={(e) => onToChange(e.target.value)}
        aria-label="Date de fin"
        style={dateInputStyle}
      />
    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--cs-fg-primary)',
  fontSize: 'var(--cs-text-sm)',
  fontFamily: 'inherit',
  padding: '2px 0',
  outline: 'none',
};

function triggerStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: active ? 'var(--cs-accent-bg)' : 'var(--cs-bg-base)',
    color: active ? 'var(--cs-accent)' : 'var(--cs-fg-primary)',
    border: `1px solid ${active ? 'var(--cs-accent-soft)' : 'var(--cs-border)'}`,
    borderRadius: 'var(--cs-radius)',
    fontSize: 'var(--cs-text-sm)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
