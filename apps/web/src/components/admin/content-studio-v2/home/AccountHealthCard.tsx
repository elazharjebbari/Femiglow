'use client';

import { Plug, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AccountHealth } from '@/lib/content-studio/dashboard';
import { Badge } from '@/components/admin/content-studio-v2/primitives';

interface AccountHealthCardProps {
  rows: AccountHealth[];
}

/**
 * Table card listing each social account with its last success / failure.
 * Read-only — clicking a row could be wired later to the channel detail
 * page once it exists.
 */
export function AccountHealthCard({ rows }: AccountHealthCardProps) {
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
            background: 'rgba(122, 78, 156, 0.14)',
            color: 'var(--cs-violet)',
            border: '1px solid rgba(122, 78, 156, 0.32)',
          }}
        >
          <Plug size={16} />
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
            Comptes sociaux
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--cs-font-display)',
              fontSize: 'var(--cs-text-lg)',
              color: 'var(--cs-fg-primary)',
            }}
          >
            {rows.length} {rows.length > 1 ? 'connectés' : 'connecté'}
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
          Aucun compte social synchronisé.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row) => (
            <li
              key={row.account.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 'var(--cs-radius-md)',
                background: 'var(--cs-bg-sunken)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--cs-text-sm)',
                    color: 'var(--cs-fg-primary)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.account.name}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: 'var(--cs-fg-muted)',
                  }}
                >
                  {row.account.provider} · {row.account.platform}
                  {row.lastSuccessAt ? ` · OK ${formatDate(row.lastSuccessAt)}` : ''}
                  {row.lastFailureAt ? ` · KO ${formatDate(row.lastFailureAt)}` : ''}
                </p>
              </div>
              <Badge
                tone={row.account.status === 'active' ? 'sage' : 'saffron'}
                size="sm"
              >
                {row.account.status === 'active' ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <AlertTriangle size={11} />
                )}
                {row.account.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}
