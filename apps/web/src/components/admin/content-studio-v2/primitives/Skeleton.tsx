import type { CSSProperties } from 'react';

export interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  style?: CSSProperties;
}

const radiusMap = {
  sm: 'var(--cs-radius-sm)',
  md: 'var(--cs-radius-md)',
  lg: 'var(--cs-radius-lg)',
  full: 'var(--cs-radius-full)',
};

export function Skeleton({ className = '', width, height = 16, rounded = 'sm', style }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`cs-skeleton ${className}`}
      style={{
        display: 'inline-block',
        width: typeof width === 'number' ? `${width}px` : width ?? '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radiusMap[rounded],
        background: 'linear-gradient(90deg, var(--cs-bg-sunken) 0%, var(--cs-bg-feature) 50%, var(--cs-bg-sunken) 100%)',
        backgroundSize: '200% 100%',
        animation: 'cs-shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

if (typeof document !== 'undefined' && !document.getElementById('cs-shimmer-keyframes')) {
  const style = document.createElement('style');
  style.id = 'cs-shimmer-keyframes';
  style.textContent = '@keyframes cs-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';
  document.head.appendChild(style);
}
