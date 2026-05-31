'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Tonal palette mapped to v2 design tokens. Each tone defines a soft
 * background and a contrasted foreground so the card reads at-a-glance.
 */
export type MetricTone = 'accent' | 'sage' | 'saffron' | 'violet' | 'neutral' | 'danger';

const TONE_STYLE: Record<MetricTone, { bg: string; fg: string; border: string }> = {
  accent:  { bg: 'var(--cs-accent-bg)',           fg: 'var(--cs-accent)',  border: 'var(--cs-accent)'         },
  sage:    { bg: 'var(--cs-success-bg)',          fg: 'var(--cs-sage)',    border: 'rgba(99, 132, 92, 0.35)'  },
  saffron: { bg: 'rgba(194, 136, 70, 0.16)',      fg: 'var(--cs-saffron)', border: 'rgba(194, 136, 70, 0.35)' },
  violet:  { bg: 'rgba(122, 78, 156, 0.14)',      fg: 'var(--cs-violet)',  border: 'rgba(122, 78, 156, 0.32)' },
  neutral: { bg: 'var(--cs-bg-sunken)',           fg: 'var(--cs-fg-primary)', border: 'var(--cs-border-hair)' },
  danger:  { bg: 'var(--cs-danger-bg)',           fg: 'var(--cs-danger)',  border: 'rgba(180, 47, 50, 0.35)'  },
};

export interface MetricCardProps {
  label: string;
  value: string;
  subline?: string;
  tone?: MetricTone;
  icon?: ReactNode;
  /** Optional deep-link target. When set, the whole card becomes clickable. */
  href?: string;
  /** Optional aria-label override when wrapped in a link. */
  ariaLabel?: string;
}

/**
 * V2 MetricCard. Acts as a hub card — set `href` to make the whole tile
 * navigate to a deep link inside `/library`, `/plan` or another route.
 *
 * Style tokens are read from CSS vars so the card respects dark/light
 * themes automatically without prop drilling.
 */
export function MetricCard({
  label,
  value,
  subline,
  tone = 'neutral',
  icon,
  href,
  ariaLabel,
}: MetricCardProps) {
  const style = TONE_STYLE[tone];
  const inner = (
    <div
      className="cs-metric-card"
      style={{
        background: 'var(--cs-bg-elevated)',
        border: `1px solid var(--cs-border-hair)`,
        borderRadius: 'var(--cs-radius-lg)',
        padding: '18px 20px',
        boxShadow: 'var(--cs-shadow-sm)',
        transition: 'transform var(--cs-motion-fast) var(--cs-easing), border-color var(--cs-motion-fast) var(--cs-easing)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon ? (
          <span
            aria-hidden
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--cs-radius-md)',
              background: style.bg,
              color: style.fg,
              border: `1px solid ${style.border}`,
            }}
          >
            {icon}
          </span>
        ) : null}
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
          {label}
        </p>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--cs-font-display)',
          fontSize: 'var(--cs-text-3xl)',
          fontWeight: 500,
          letterSpacing: '-0.015em',
          color: 'var(--cs-fg-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {subline ? (
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
      ) : null}
    </div>
  );

  if (!href) {
    return inner;
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      className="cs-metric-link"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        borderRadius: 'var(--cs-radius-lg)',
        outline: 'none',
      }}
    >
      {inner}
    </Link>
  );
}
