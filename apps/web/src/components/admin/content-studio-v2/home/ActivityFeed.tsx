'use client';

import { Activity, Check, X, Edit3, Send, Trash2, CalendarPlus, ShieldCheck, Sparkles, Circle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActivityRow, ActivityIcon } from './activity';

interface ActivityFeedProps {
  rows: ActivityRow[];
}

/**
 * Vertical timeline of the latest 10 admin audit events. Read-only; the
 * full audit page lives at `/admin/audit` and can be linked from here
 * once that view is themed in v2.
 */
export function ActivityFeed({ rows }: ActivityFeedProps) {
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
            background: 'var(--cs-bg-sunken)',
            color: 'var(--cs-fg-primary)',
            border: '1px solid var(--cs-border-hair)',
          }}
        >
          <Activity size={16} />
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
            Activité récente
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--cs-font-display)',
              fontSize: 'var(--cs-text-lg)',
              color: 'var(--cs-fg-primary)',
            }}
          >
            10 dernières actions admin
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
          Aucune activité enregistrée pour l&apos;instant.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--cs-border-hair)',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 'var(--cs-radius-full)',
                  background: 'var(--cs-bg-sunken)',
                  color: 'var(--cs-fg-muted)',
                }}
              >
                {renderIcon(row.icon)}
              </span>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--cs-text-sm)',
                    color: 'var(--cs-fg-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </p>
                {row.detail ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: 'var(--cs-fg-muted)',
                      fontFamily: 'var(--cs-font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.detail}
                  </p>
                ) : null}
              </div>
              <time
                dateTime={row.isoTime}
                title={row.isoTime}
                style={{
                  fontSize: 11,
                  color: 'var(--cs-fg-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.relativeTime}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function renderIcon(icon: ActivityIcon): ReactNode {
  switch (icon) {
    case 'sparkles': return <Sparkles size={12} />;
    case 'check':    return <Check size={12} />;
    case 'x':        return <X size={12} />;
    case 'edit':     return <Edit3 size={12} />;
    case 'send':     return <Send size={12} />;
    case 'trash':    return <Trash2 size={12} />;
    case 'calendar': return <CalendarPlus size={12} />;
    case 'shield':   return <ShieldCheck size={12} />;
    case 'dot':
    default:         return <Circle size={10} />;
  }
}
