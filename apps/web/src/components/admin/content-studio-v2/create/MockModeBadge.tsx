'use client';

import { Sparkles } from 'lucide-react';

interface MockModeBadgeProps {
  /** Override the default label (defaults to "Mode mock — actions simulées"). */
  label?: string;
  size?: 'sm' | 'md';
}

export function MockModeBadge({ label, size = 'sm' }: MockModeBadgeProps) {
  const text = label ?? 'Mode mock — actions simulées';
  const iconSize = size === 'sm' ? 12 : 14;
  const fontSize = size === 'sm' ? 11 : 12;
  const pad = size === 'sm' ? '4px 10px' : '6px 12px';
  return (
    <span
      role="status"
      aria-label="Mode mock activé"
      data-cs-mock-badge="true"
      style={{
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        padding: pad,
        background: 'var(--cs-warning-bg)',
        color: 'var(--cs-warning)',
        borderRadius: 'var(--cs-radius-full)',
        fontSize,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <Sparkles size={iconSize} aria-hidden />
      {text}
    </span>
  );
}
