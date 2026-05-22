'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import type { DraftsAwaitingReview } from '@/lib/content-studio/dashboard';

interface DraftsAwaitingCardProps {
  data: DraftsAwaitingReview;
  /** Deep-link to the library filtered on `status=needs_review`. */
  href?: string;
}

/**
 * Card "Brouillons en attente" — count + oldest-age. Clicking jumps to
 * the library pre-filtered. Even before /library?status=needs_review is
 * functional (Phase 4), the link is valid so it will start working as
 * soon as that filter ships.
 */
export function DraftsAwaitingCard({
  data,
  href = '/admin/content-studio-v2/library?status=needs_review',
}: DraftsAwaitingCardProps) {
  const tone: 'sage' | 'saffron' | 'danger' = computeTone(data);
  const palette = TONE_PALETTE[tone];
  const subline =
    data.oldestAgeHours === null
      ? 'Aucun brouillon en attente'
      : `Plus ancien : ${data.oldestAgeHours}h`;

  return (
    <Link
      href={href}
      aria-label={`Brouillons en attente : ${data.count}. Ouvrir la bibliothèque.`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        borderRadius: 'var(--cs-radius-lg)',
        height: '100%',
      }}
    >
      <div
        className="cs-card"
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-lg)',
          boxShadow: 'var(--cs-shadow-sm)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--cs-radius-md)',
              background: palette.bg,
              color: palette.fg,
              border: `1px solid ${palette.border}`,
            }}
          >
            <Inbox size={16} />
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--cs-text-xs)',
              color: 'var(--cs-fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            Brouillons en attente
          </p>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-3xl)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
            color: 'var(--cs-fg-primary)',
          }}
        >
          {data.count}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--cs-text-xs)',
            color: 'var(--cs-fg-secondary)',
            lineHeight: 1.4,
          }}
        >
          {subline}
        </p>
        <p
          style={{
            margin: 0,
            marginTop: 'auto',
            fontSize: 'var(--cs-text-xs)',
            color: palette.fg,
            fontWeight: 500,
          }}
        >
          Voir dans la bibliothèque →
        </p>
      </div>
    </Link>
  );
}

function computeTone(data: DraftsAwaitingReview): 'sage' | 'saffron' | 'danger' {
  if (data.count === 0) return 'sage';
  if ((data.oldestAgeHours ?? 0) >= 48) return 'danger';
  return 'saffron';
}

const TONE_PALETTE = {
  sage:    { bg: 'var(--cs-success-bg)',          fg: 'var(--cs-sage)',    border: 'rgba(99, 132, 92, 0.35)'  },
  saffron: { bg: 'rgba(194, 136, 70, 0.16)',      fg: 'var(--cs-saffron)', border: 'rgba(194, 136, 70, 0.35)' },
  danger:  { bg: 'var(--cs-danger-bg)',           fg: 'var(--cs-danger)',  border: 'rgba(180, 47, 50, 0.35)'  },
};
