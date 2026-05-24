'use client';

import Link from 'next/link';
import { Archive, Copy, ExternalLink, ImageOff, Play } from 'lucide-react';
import { Badge } from '../primitives';
import { presentStatus } from '@/lib/content-studio-v2/library/status';
import type { LibraryItem } from '@/lib/content-studio-v2/library/types';

interface Props {
  items: LibraryItem[];
  selection: Record<string, true>;
  onToggleSelect: (id: string) => void;
  onDuplicate: (item: LibraryItem) => void;
  onArchive: (item: LibraryItem) => void;
}

const CREATE_BASE = '/admin/content-studio-v2/create';

/**
 * Grid auto-fill 240px (vignettes 4:5). Vignettes :
 * - Image : <img> cover.
 * - Vidéo : poster (thumbnail) + overlay play.
 * - Aucun média : placeholder texte.
 *
 * Hover : élévation + actions rapides (Ouvrir, Dupliquer, Archiver).
 * La card complète est navigable vers `/create/[draftId]`. Les actions
 * rapides sont en `position: absolute` au-dessus.
 *
 * Checkbox en haut-gauche pour la sélection bulk.
 */
export function LibraryGrid({ items, selection, onToggleSelect, onDuplicate, onArchive }: Props) {
  if (items.length === 0) {
    return (
      <div
        role="status"
        style={{
          padding: 48,
          textAlign: 'center',
          color: 'var(--cs-fg-muted)',
          border: '1px dashed var(--cs-border)',
          borderRadius: 'var(--cs-radius-lg)',
          background: 'var(--cs-bg-elevated)',
        }}
      >
        Aucun élément ne correspond à ces filtres. Essaie d&apos;élargir la recherche.
      </div>
    );
  }

  return (
    <ul
      role="list"
      aria-label="Bibliothèque de contenus"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
        gap: 16,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {items.map((item) => (
        <LibraryCard
          key={item.id}
          item={item}
          selected={Boolean(selection[item.id])}
          onToggleSelect={onToggleSelect}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
        />
      ))}
    </ul>
  );
}

function LibraryCard({
  item,
  selected,
  onToggleSelect,
  onDuplicate,
  onArchive,
}: {
  item: LibraryItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDuplicate: (item: LibraryItem) => void;
  onArchive: (item: LibraryItem) => void;
}) {
  const status = presentStatus(item.status);
  const openHref = `${CREATE_BASE}/${item.draftId}`;
  return (
    <li
      data-cs-library-card
      data-selected={selected ? 'true' : 'false'}
      style={{
        position: 'relative',
        background: 'var(--cs-bg-elevated)',
        border: selected ? '2px solid var(--cs-accent)' : '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        overflow: 'hidden',
        transition: 'transform var(--cs-motion-fast) var(--cs-easing), box-shadow var(--cs-motion-fast) var(--cs-easing)',
        boxShadow: selected ? '0 0 0 4px var(--cs-accent-bg)' : 'var(--cs-shadow-sm)',
      }}
      className="cs-library-card"
    >
      {/* Thumbnail — aspect adapts to format */}
      <div
        style={{
          position: 'relative',
          aspectRatio: item.format === 'story' || item.format === 'reel' ? '9 / 16' : '4 / 5',
          background: 'var(--cs-bg-sunken)',
        }}
      >
        <Link
          href={openHref}
          aria-label={`Ouvrir : ${item.caption.slice(0, 80)}`}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            outline: 'none',
          }}
        >
          {item.thumbnail.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail.url}
              alt={item.thumbnail.alt}
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--cs-fg-muted)',
                background: 'var(--cs-bg-sunken)',
              }}
            >
              <ImageOff size={28} />
            </div>
          )}
          {item.thumbnail.kind === 'video' ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'white',
                textShadow: '0 2px 12px rgba(0,0,0,0.55)',
                pointerEvents: 'none',
              }}
            >
              <Play size={36} fill="currentColor" />
            </span>
          ) : null}
        </Link>

        {/* Checkbox (bulk select) — top-left. Cliquer ne navigue pas. */}
        <label
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'inline-grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: 'var(--cs-radius-sm)',
            background: 'rgba(255, 255, 255, 0.92)',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            aria-label={`Sélectionner : ${item.variantLabel}`}
            style={{ margin: 0, cursor: 'pointer' }}
          />
        </label>

        {/* Status badge — bottom-right. */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            pointerEvents: 'none',
          }}
        >
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </div>

        {/* Hover actions overlay */}
        <div
          data-cs-library-actions
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 4,
            opacity: 0,
            transition: 'opacity var(--cs-motion-fast) var(--cs-easing)',
          }}
        >
          <ActionButton
            label="Ouvrir"
            icon={<ExternalLink size={13} />}
            href={openHref}
          />
          <ActionButton
            label="Dupliquer"
            icon={<Copy size={13} />}
            onClick={() => onDuplicate(item)}
          />
          <ActionButton
            label="Archiver"
            icon={<Archive size={13} />}
            onClick={() => onArchive(item)}
          />
        </div>
      </div>

      {/* Caption footer */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p
          style={{
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-primary)',
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            minHeight: 36,
          }}
        >
          {item.caption || <em style={{ color: 'var(--cs-fg-muted)' }}>(sans caption)</em>}
        </p>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--cs-text-xs)',
            color: 'var(--cs-fg-secondary)',
            fontFamily: 'var(--cs-font-mono)',
            letterSpacing: '0.02em',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span>{item.platform}</span>
          <span>·</span>
          <span>{item.format}</span>
          <span>·</span>
          <span>{item.variantLabel}</span>
        </p>
      </div>
    </li>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('cs-library-card-hover')) {
  const style = document.createElement('style');
  style.id = 'cs-library-card-hover';
  style.textContent = [
    '.cs-library-card:hover { transform: translateY(-2px); box-shadow: var(--cs-shadow-md); }',
    '.cs-library-card[data-selected="true"]:hover { box-shadow: 0 0 0 4px var(--cs-accent-bg), var(--cs-shadow-md); }',
    '.cs-library-card:hover [data-cs-library-actions], .cs-library-card:focus-within [data-cs-library-actions] { opacity: 1; }',
  ].join('\n');
  document.head.appendChild(style);
}

function ActionButton({
  label,
  icon,
  onClick,
  href,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const baseStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: 'var(--cs-radius-sm)',
    background: 'rgba(255, 255, 255, 0.96)',
    color: 'var(--cs-fg-primary)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    textDecoration: 'none',
  };
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} style={baseStyle}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={label}
      title={label}
      style={{ ...baseStyle, font: 'inherit' }}
    >
      {icon}
    </button>
  );
}
