'use client';

import { ShieldCheck } from 'lucide-react';
import type { BrandHealthSummary } from './brand-health';

interface BrandHealthCardProps {
  data: BrandHealthSummary;
}

/**
 * Brand health card — shows the rolling 30-day average score plus the
 * top 3 violations of the past 7 days. Helps the editorial team spot
 * recurring brand issues before they ship.
 */
export function BrandHealthCard({ data }: BrandHealthCardProps) {
  const tone = scoreTone(data.averageScore);
  const palette = TONE_PALETTE[tone];

  return (
    <section
      className="cs-card"
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-lg)',
        boxShadow: 'var(--cs-shadow-sm)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <ShieldCheck size={16} />
        </span>
        <div>
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
            Santé brand
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--cs-font-display)',
              fontSize: 'var(--cs-text-lg)',
              color: 'var(--cs-fg-primary)',
            }}
          >
            Score moyen 30 jours
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--cs-font-display)',
            fontSize: 48,
            fontWeight: 500,
            color: palette.fg,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {data.averageScore}
        </p>
        <span
          style={{
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          / 100 · {data.reviewCount} {data.reviewCount > 1 ? 'revues' : 'revue'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          Top violations · 7 jours
        </p>
        {data.topViolations.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--cs-text-sm)',
              color: 'var(--cs-fg-secondary)',
            }}
          >
            Aucune violation cette semaine.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.topViolations.map((violation) => (
              <li
                key={violation.rule}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 'var(--cs-radius-md)',
                  background: 'var(--cs-bg-sunken)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--cs-text-sm)',
                    color: 'var(--cs-fg-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                  title={violation.label}
                >
                  {violation.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--cs-font-mono)',
                    fontSize: 'var(--cs-text-xs)',
                    color: 'var(--cs-fg-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  ×{violation.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type Tone = 'sage' | 'saffron' | 'danger' | 'neutral';

function scoreTone(score: number): Tone {
  if (score === 0) return 'neutral';
  if (score >= 80) return 'sage';
  if (score >= 60) return 'saffron';
  return 'danger';
}

const TONE_PALETTE: Record<Tone, { bg: string; fg: string; border: string }> = {
  sage:    { bg: 'var(--cs-success-bg)',          fg: 'var(--cs-sage)',    border: 'rgba(99, 132, 92, 0.35)'  },
  saffron: { bg: 'rgba(194, 136, 70, 0.16)',      fg: 'var(--cs-saffron)', border: 'rgba(194, 136, 70, 0.35)' },
  danger:  { bg: 'var(--cs-danger-bg)',           fg: 'var(--cs-danger)',  border: 'rgba(180, 47, 50, 0.35)'  },
  neutral: { bg: 'var(--cs-bg-sunken)',           fg: 'var(--cs-fg-secondary)', border: 'var(--cs-border-hair)' },
};
