import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'clay' | 'sage' | 'saffron' | 'violet';

const toneStyle: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--cs-bg-sunken)', fg: 'var(--cs-fg-secondary)' },
  accent:  { bg: 'var(--cs-accent-bg)', fg: 'var(--cs-accent)' },
  success: { bg: 'var(--cs-success-bg)', fg: 'var(--cs-success)' },
  warning: { bg: 'var(--cs-warning-bg)', fg: 'var(--cs-warning)' },
  danger:  { bg: 'var(--cs-danger-bg)', fg: 'var(--cs-danger)' },
  clay:    { bg: 'rgba(122, 78, 63, 0.12)', fg: 'var(--cs-clay)' },
  sage:    { bg: 'var(--cs-success-bg)', fg: 'var(--cs-sage)' },
  saffron: { bg: 'rgba(194, 136, 70, 0.18)', fg: 'var(--cs-saffron)' },
  violet:  { bg: 'rgba(122, 78, 156, 0.16)', fg: 'var(--cs-violet)' },
};

export interface BadgeProps {
  tone?: Tone;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Badge({ tone = 'neutral', size = 'md', children }: BadgeProps) {
  const { bg, fg } = toneStyle[tone];
  return (
    <span
      className="cs-badge inline-flex items-center gap-1 font-medium"
      style={{
        background: bg,
        color: fg,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        fontSize: size === 'sm' ? 10 : 11,
        borderRadius: 'var(--cs-radius-full)',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}
