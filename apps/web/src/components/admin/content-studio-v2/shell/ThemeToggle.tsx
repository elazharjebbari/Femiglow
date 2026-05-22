'use client';

import { useTheme } from './ThemeProvider';

/**
 * Inline theme toggle button. Cycles light → dark → light.
 * Use the system preference via the ThemeProvider directly when needed.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      className={`cs-theme-toggle ${className}`}
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--cs-radius-full)',
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border)',
        color: 'var(--cs-fg-primary)',
        display: 'inline-grid',
        placeItems: 'center',
        cursor: 'pointer',
        transition: 'all var(--cs-motion-fast) var(--cs-easing)',
      }}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.34 6.34L4.93 4.93M19.07 19.07l-1.41-1.41M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
