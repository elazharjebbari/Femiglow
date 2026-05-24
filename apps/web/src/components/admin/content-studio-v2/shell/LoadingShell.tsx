import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { Skeleton } from '../primitives/Skeleton';

/**
 * Drop-in wrapper for `loading.tsx` files. Re-uses AppShell (sidebar +
 * topbar still visible) so the skeleton sits exactly where the page
 * content will appear once data arrives — no layout shift.
 */
export function LoadingShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

interface SkeletonBlockProps {
  height?: number;
  rounded?: 'sm' | 'md' | 'lg';
}

export function SkeletonBlock({ height = 120, rounded = 'md' }: SkeletonBlockProps) {
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border)',
        borderRadius: rounded === 'lg' ? 'var(--cs-radius-lg)' : rounded === 'md' ? 'var(--cs-radius-md)' : 'var(--cs-radius-sm)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: height,
      }}
    >
      <Skeleton width={120} height={11} />
      <Skeleton width="60%" height={22} />
      <div style={{ flex: 1 }} />
      <Skeleton width="40%" height={11} />
    </div>
  );
}

export function SkeletonHeader({ eyebrow = 80, title = 220 }: { eyebrow?: number; title?: number }) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton width={eyebrow} height={10} />
      <Skeleton width={title} height={26} />
    </header>
  );
}
