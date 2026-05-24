'use client';

import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
import { ImageOff, Play } from 'lucide-react';
import type {
  ContentDraft,
  ContentPillar,
  ContentPost,
  ContentPostizDelivery,
} from '@/lib/content-studio/types';
import { Badge } from '../primitives';
import type { CalendarMediaEntry } from './types';

interface CalendarCardProps {
  post: ContentPost;
  draft: ContentDraft | undefined;
  media: CalendarMediaEntry | undefined;
  latestDelivery: ContentPostizDelivery | null;
  pillar: ContentPillar | undefined;
  variant?: 'full' | 'mini';
  onDoubleClick?: (postId: string) => void;
}

const STATUS_TONE: Record<string, 'success' | 'accent' | 'neutral' | 'warning' | 'danger'> = {
  approved: 'success',
  scheduled: 'accent',
  published: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  rejected: 'warning',
};

const PILLAR_DOT: Record<ContentPillar, string> = {
  rituel: 'var(--cs-accent)',
  produit: 'var(--cs-clay)',
  preuve: 'var(--cs-sage)',
  journal: 'var(--cs-violet)',
  maison: 'var(--cs-saffron)',
  reassurance: 'var(--cs-fg-secondary)',
  saison: 'var(--cs-success)',
  coulisses: 'var(--cs-warning)',
};

function formatHour(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function CalendarCard({
  post,
  draft,
  media,
  latestDelivery,
  pillar,
  variant = 'full',
  onDoubleClick,
}: CalendarCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post:${post.id}`,
    data: { postId: post.id, scheduledAt: post.scheduledAt },
  });

  const statusTone = STATUS_TONE[post.status] ?? 'neutral';
  const pillarColor = pillar ? PILLAR_DOT[pillar] : 'var(--cs-fg-secondary)';

  const baseStyle: CSSProperties = {
    background: 'var(--cs-bg-elevated)',
    border: '1px solid var(--cs-border)',
    borderLeft: `3px solid ${pillarColor}`,
    borderRadius: 'var(--cs-radius-sm)',
    padding: variant === 'mini' ? '4px 6px' : '6px 8px',
    fontSize: variant === 'mini' ? 10 : 11,
    color: 'var(--cs-fg-primary)',
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.55 : 1,
    boxShadow: isDragging ? 'var(--cs-shadow-md)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
    textAlign: 'left',
  };

  const thumbSize = variant === 'mini' ? 18 : 28;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Post ${draft?.hook ?? draft?.variantLabel ?? post.id} — ${post.status}. Espace pour saisir, flèches pour déplacer, Entrée pour relâcher.`}
      data-testid={`calendar-card-${post.id}`}
      onDoubleClick={() => onDoubleClick?.(post.id)}
      style={baseStyle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          aria-hidden
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: 4,
            background: 'var(--cs-bg-sunken)',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--cs-fg-muted, var(--cs-fg-secondary))',
          }}
        >
          {media?.previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.kind === 'video' ? (media.thumbnailUrl ?? media.previewUrl) : media.previewUrl}
                alt={media.alt || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {media.kind === 'video' ? (
                <Play
                  size={variant === 'mini' ? 8 : 10}
                  fill="currentColor"
                  style={{ position: 'absolute', color: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                />
              ) : null}
            </>
          ) : (
            <ImageOff size={variant === 'mini' ? 10 : 12} />
          )}
        </div>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {draft?.hook ?? draft?.variantLabel ?? post.id.slice(0, 8)}
        </span>
      </div>
      {variant === 'full' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--cs-fg-secondary)' }}>
            {draft?.platform ?? 'social'} · {draft?.format ?? 'post'}
          </span>
          {post.scheduledAt ? (
            <span style={{ color: 'var(--cs-fg-secondary)' }}>{formatHour(post.scheduledAt)}</span>
          ) : null}
          <Badge tone={statusTone} size="sm">
            {post.status}
          </Badge>
          {latestDelivery?.status === 'failed' ? (
            <Badge tone="danger" size="sm">
              postiz failed
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
