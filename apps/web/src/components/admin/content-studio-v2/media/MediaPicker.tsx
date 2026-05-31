'use client';

import { useState } from 'react';
import { Search, Play, Image as ImageIcon, Film, Sparkles } from 'lucide-react';
import { Input, Skeleton } from '../primitives';
import { Uploader } from './Uploader';
import type { StudioV2MediaItem, StudioV2Compartment, StudioV2MediaKind } from '@/lib/content-studio-v2/media/types';

type TypeFilter = 'all' | StudioV2MediaKind;

interface Props {
  items: StudioV2MediaItem[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect: (item: StudioV2MediaItem) => void;
  onUploaded: (item: StudioV2MediaItem) => void;
  compartment?: StudioV2Compartment | 'all';
  onCompartmentChange?: (next: StudioV2Compartment | 'all') => void;
  /** Default crop aspect ratio for the uploader. */
  defaultRatio?: '1:1' | '4:5' | '9:16' | '16:9' | 'free';
}

export function MediaPicker({
  items,
  loading,
  selectedId,
  onSelect,
  onUploaded,
  compartment = 'all',
  onCompartmentChange,
  defaultRatio = '4:5',
}: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');

  const filtered = items.filter((item) => {
    if (compartment !== 'all' && item.compartment !== compartment) return false;
    if (type !== 'all' && item.kind !== type) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!item.alt.toLowerCase().includes(q) && !item.slug.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="cs-mediapicker" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar: filters + search + import */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <TabGroup
          value={compartment}
          onChange={(v) => onCompartmentChange?.(v as StudioV2Compartment | 'all')}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'imported', label: 'Importés' },
            { value: 'ai_generated', label: 'IA' },
          ]}
        />
        <TabGroup
          value={type}
          onChange={(v) => setType(v as TypeFilter)}
          options={[
            { value: 'all', label: 'Tous types', icon: null },
            { value: 'image', label: 'Image', icon: <ImageIcon size={12} /> },
            { value: 'video', label: 'Vidéo', icon: <Film size={12} /> },
          ]}
        />
        <div style={{ flex: 1, minWidth: 180 }}>
          <Input
            placeholder="Rechercher (alt, slug)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftAddon={<Search size={13} />}
          />
        </div>
        <Uploader defaultRatio={defaultRatio} onUploaded={onUploaded} />
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
          gap: 10,
        }}
      >
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={210} rounded="md" />
          ))
        ) : filtered.length === 0 ? (
          <p
            style={{
              gridColumn: '1 / -1',
              padding: 40,
              textAlign: 'center',
              color: 'var(--cs-fg-muted)',
              border: '1px dashed var(--cs-border)',
              borderRadius: 'var(--cs-radius-md)',
            }}
          >
            Aucun média trouvé. Importe un fichier ou ajuste les filtres.
          </p>
        ) : (
          filtered.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MediaTile({
  item,
  selected,
  onSelect,
}: {
  item: StudioV2MediaItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={item.alt}
      style={{
        position: 'relative',
        aspectRatio: '4 / 5',
        borderRadius: 'var(--cs-radius-md)',
        overflow: 'hidden',
        border: selected ? '2px solid var(--cs-accent)' : '1px solid var(--cs-border-hair)',
        padding: 0,
        cursor: 'pointer',
        background: 'var(--cs-bg-sunken)',
        boxShadow: selected ? '0 0 0 4px var(--cs-accent-bg)' : 'none',
        transition: 'all var(--cs-motion-fast) var(--cs-easing)',
      }}
    >
      {item.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailUrl ?? item.previewUrl}
          alt={item.alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      ) : (
        <>
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.alt}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="lazy"
            />
          ) : null}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            <Play size={32} fill="currentColor" />
          </span>
          {item.durationSec ? (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                padding: '2px 7px',
                borderRadius: 'var(--cs-radius-sm)',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                fontFamily: 'var(--cs-font-mono)',
                fontSize: 10,
                backdropFilter: 'blur(6px)',
              }}
            >
              {item.durationSec.toFixed(0)}s
            </span>
          ) : null}
        </>
      )}
      {item.compartment === 'ai_generated' ? (
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            padding: '2px 7px',
            borderRadius: 'var(--cs-radius-sm)',
            background: 'rgba(122, 78, 156, 0.85)',
            color: 'white',
            fontFamily: 'var(--cs-font-mono)',
            fontSize: 9,
            letterSpacing: '0.06em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            backdropFilter: 'blur(6px)',
          }}
        >
          <Sparkles size={9} /> IA
        </span>
      ) : null}
    </button>
  );
}

function TabGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        background: 'var(--cs-bg-sunken)',
        padding: 3,
        borderRadius: 'var(--cs-radius)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'var(--cs-bg-elevated)' : 'transparent',
              color: active ? 'var(--cs-fg-primary)' : 'var(--cs-fg-secondary)',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: active ? 'var(--cs-shadow-sm)' : 'none',
              transition: 'all var(--cs-motion-fast) var(--cs-easing)',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
