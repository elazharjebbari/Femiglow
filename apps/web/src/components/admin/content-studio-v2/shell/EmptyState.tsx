import type { ReactNode } from 'react';

interface EmptyStateProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  illustration?: ReactNode;
  actions?: ReactNode;
}

/**
 * Empty state used as placeholder by all route stubs in Phase 1.
 * Later replaced by the real content per mode.
 */
export function EmptyState({ eyebrow, title, description, illustration, actions }: EmptyStateProps) {
  return (
    <section
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-lg)',
        padding: '64px 48px',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        minHeight: 420,
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        {illustration ? (
          <div
            style={{
              marginBottom: 24,
              display: 'inline-grid',
              placeItems: 'center',
              width: 72,
              height: 72,
              borderRadius: 'var(--cs-radius-full)',
              background: 'var(--cs-bg-sunken)',
              color: 'var(--cs-accent)',
            }}
          >
            {illustration}
          </div>
        ) : null}
        {eyebrow ? (
          <p className="cs-eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </p>
        ) : null}
        <h2
          className="cs-display"
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-3xl)',
            fontWeight: 500,
            letterSpacing: '-0.015em',
            color: 'var(--cs-fg-primary)',
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              marginTop: 12,
              fontSize: 'var(--cs-text-base)',
              color: 'var(--cs-fg-secondary)',
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        ) : null}
        {actions ? (
          <div style={{ marginTop: 28, display: 'inline-flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
