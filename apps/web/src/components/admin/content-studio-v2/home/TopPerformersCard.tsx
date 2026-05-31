'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import type { TopPerformer } from '@/lib/content-studio/dashboard';

interface TopPerformersCardProps {
  rows: TopPerformer[];
  /** Optional caption resolver (postId → caption). */
  captionFor?: (postId: string) => string | undefined;
  /** Optional media url resolver (postId → preview thumbnail). */
  thumbnailFor?: (postId: string) => string | undefined;
}

/**
 * Card listing the top 5 performers by engagement rate. Each row is a
 * deep link to the library focused on the corresponding post.
 */
export function TopPerformersCard({
  rows,
  captionFor,
  thumbnailFor,
}: TopPerformersCardProps) {
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
        gap: 14,
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
            background: 'var(--cs-success-bg)',
            color: 'var(--cs-sage)',
            border: '1px solid rgba(99, 132, 92, 0.35)',
          }}
        >
          <TrendingUp size={16} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
            Top performers
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--cs-font-display)',
              fontSize: 'var(--cs-text-lg)',
              color: 'var(--cs-fg-primary)',
            }}
          >
            5 meilleurs par engagement
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: '12px 0',
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-secondary)',
          }}
        >
          Aucun snapshot disponible. L&apos;ingestion s&apos;exécute toutes les 6h ; revenir plus tard.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, idx) => (
            <li key={row.postId}>
              <Link
                href={`/admin/content-studio-v2/library?postId=${encodeURIComponent(row.postId)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 10px',
                  borderRadius: 'var(--cs-radius-md)',
                  background: 'var(--cs-bg-sunken)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background var(--cs-motion-fast) var(--cs-easing)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-grid',
                    placeItems: 'center',
                    width: 18,
                    fontSize: 11,
                    color: 'var(--cs-fg-muted)',
                    fontFamily: 'var(--cs-font-mono)',
                  }}
                >
                  {idx + 1}
                </span>
                <Thumbnail postId={row.postId} src={thumbnailFor?.(row.postId)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--cs-text-sm)',
                      color: 'var(--cs-fg-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={captionFor?.(row.postId) ?? row.postId}
                  >
                    {captionFor?.(row.postId) ?? row.postId}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: 'var(--cs-fg-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatMetrics(row)}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--cs-font-display)',
                    fontSize: 'var(--cs-text-base)',
                    color: 'var(--cs-sage)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 500,
                  }}
                >
                  {(row.engagementRate * 100).toFixed(1)}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Thumbnail({ postId, src }: { postId: string; src?: string }) {
  const initials = postId.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '··';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--cs-radius-sm)',
          objectFit: 'cover',
          background: 'var(--cs-bg-feature)',
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 36,
        height: 36,
        borderRadius: 'var(--cs-radius-sm)',
        background: 'var(--cs-bg-feature)',
        color: 'var(--cs-fg-muted)',
        fontFamily: 'var(--cs-font-mono)',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function formatMetrics(row: { likes: number | null; comments: number | null; reach: number | null }): string {
  const likes = row.likes ?? 0;
  const comments = row.comments ?? 0;
  const reach = row.reach;
  const reachStr = reach === null ? '—' : reach.toString();
  return `${likes} ♥ · ${comments} 💬 · reach ${reachStr}`;
}
