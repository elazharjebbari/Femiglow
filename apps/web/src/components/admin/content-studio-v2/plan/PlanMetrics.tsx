'use client';

import type { ReactNode } from 'react';
import { CheckCheck, CalendarClock, Send } from 'lucide-react';
import type { ContentPost, ContentPostizDelivery } from '@/lib/content-studio/types';

interface PlanMetricsProps {
  posts: ContentPost[];
  deliveries: ContentPostizDelivery[];
}

export function PlanMetrics({ posts, deliveries }: PlanMetricsProps) {
  const approved = posts.filter((p) => p.status === 'approved').length;
  const scheduled = posts.filter((p) => p.status === 'scheduled').length;
  const sent = deliveries.filter((d) => d.status === 'sent').length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <MetricCard
        label="Approuvés"
        value={approved}
        icon={<CheckCheck size={16} />}
        hint="Brouillons validés, en attente de planification."
      />
      <MetricCard
        label="Planifiés"
        value={scheduled}
        icon={<CalendarClock size={16} />}
        hint="Datés et prêts à partir."
      />
      <MetricCard
        label="Envoyés Postiz"
        value={sent}
        icon={<Send size={16} />}
        hint="Acceptés par Postiz (succès)."
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--cs-fg-secondary)',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p
        style={{
          margin: '6px 0 2px',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--cs-fg-primary)',
          fontFamily: 'var(--cs-font-display)',
        }}
      >
        {value}
      </p>
      {hint ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--cs-fg-secondary)' }}>{hint}</p>
      ) : null}
    </div>
  );
}
