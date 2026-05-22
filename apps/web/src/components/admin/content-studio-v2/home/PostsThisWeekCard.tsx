'use client';

import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import type { PostsThisWeek } from '@/lib/content-studio/dashboard';

interface PostsThisWeekCardProps {
  data: PostsThisWeek;
  /** Optional deep-link to the planning view. */
  href?: string;
}

/**
 * Hero card for /home : "Posts publiés cette semaine" with a 7-day bar
 * chart. Clicking navigates to /plan?range=next7.
 */
export function PostsThisWeekCard({
  data,
  href = '/admin/content-studio-v2/plan?range=next7',
}: PostsThisWeekCardProps) {
  const max = Math.max(1, ...data.dailyCounts.map((d) => d.count));

  const body = (
    <div
      className="cs-card"
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-lg)',
        boxShadow: 'var(--cs-shadow-sm)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
            Posts publiés — 7 jours
          </p>
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
            {data.total}
          </p>
        </div>
        <span
          aria-hidden
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--cs-radius-md)',
            background: 'var(--cs-accent-bg)',
            color: 'var(--cs-accent)',
            border: '1px solid var(--cs-accent)',
          }}
        >
          <CalendarRange size={18} />
        </span>
      </div>

      <div
        role="img"
        aria-label={`Publications quotidiennes sur 7 jours, total ${data.total}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          alignItems: 'end',
        }}
      >
        {data.dailyCounts.map((day) => {
          const ratio = day.count / max;
          const height = Math.max(4, Math.round(ratio * 64));
          const isToday = isLastDay(day.date, data.dailyCounts);
          return (
            <div
              key={day.date}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <div
                style={{
                  width: '100%',
                  height: 72,
                  display: 'flex',
                  alignItems: 'flex-end',
                }}
              >
                <span
                  title={`${day.count} publication(s) — ${day.date}`}
                  style={{
                    width: '100%',
                    height: `${height}px`,
                    background: isToday ? 'var(--cs-accent)' : 'var(--cs-clay)',
                    opacity: day.count === 0 ? 0.18 : 1,
                    borderRadius: 'var(--cs-radius-sm)',
                    transition: 'height var(--cs-motion-fast) var(--cs-easing)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--cs-fg-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {day.date.slice(5)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--cs-fg-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500,
                }}
              >
                {day.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Link
      href={href}
      aria-label={`Posts cette semaine : ${data.total}. Voir le planning.`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      {body}
    </Link>
  );
}

function isLastDay(date: string, all: Array<{ date: string }>): boolean {
  return all.length > 0 && all[all.length - 1]?.date === date;
}
