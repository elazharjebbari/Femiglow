'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Sparkles, LayoutGrid, CalendarDays, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match?: RegExp;
}

const NAV: NavItem[] = [
  { href: '/admin/content-studio-v2/home',    label: 'Accueil',      icon: <Home size={16} /> },
  { href: '/admin/content-studio-v2/create',  label: 'Création',     icon: <Sparkles size={16} />, match: /^\/admin\/content-studio-v2\/create/ },
  { href: '/admin/content-studio-v2/library', label: 'Bibliothèque', icon: <LayoutGrid size={16} /> },
  { href: '/admin/content-studio-v2/plan',    label: 'Planning',     icon: <CalendarDays size={16} /> },
];

export function Sidebar() {
  const pathname = usePathname() ?? '';
  return (
    <aside
      className="cs-sidebar flex flex-col gap-1 px-3 py-5"
      style={{
        width: 232,
        minHeight: '100vh',
        background: 'var(--cs-bg-base)',
        borderRight: '1px solid var(--cs-border-hair)',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
      }}
    >
      <Link
        href="/admin/content-studio-v2/home"
        className="flex items-center gap-3 px-3 py-2 mb-4"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--cs-radius-full)',
            border: '1px solid var(--cs-accent)',
            color: 'var(--cs-accent)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--cs-font-display)',
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          F
        </span>
        <span
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-base)',
            letterSpacing: '0.02em',
          }}
        >
          Femiglow{' '}
          <span style={{ color: 'var(--cs-fg-muted)', fontWeight: 300 }}>· Studio</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Modes du Studio">
        {NAV.map((item) => {
          const isActive = item.match
            ? item.match.test(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="cs-nav-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                borderRadius: 'var(--cs-radius-sm)',
                color: isActive ? 'var(--cs-accent)' : 'var(--cs-fg-secondary)',
                background: isActive ? 'var(--cs-accent-bg)' : 'transparent',
                fontSize: 'var(--cs-text-sm)',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                transition: 'all var(--cs-motion-fast) var(--cs-easing)',
                position: 'relative',
              }}
            >
              {isActive ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: 2,
                    background: 'var(--cs-accent)',
                    borderRadius: 1,
                  }}
                />
              ) : null}
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        className="px-3 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--cs-border-hair)' }}
      >
        <ThemeToggle />
        <Link
          href="/admin/content-studio"
          title="Voir l'ancien Studio"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            color: 'var(--cs-fg-muted)',
            fontSize: 'var(--cs-text-xs)',
            textDecoration: 'none',
            transition: 'color var(--cs-motion-fast) var(--cs-easing)',
          }}
        >
          Ancien
          <ExternalLink size={12} />
        </Link>
      </div>
    </aside>
  );
}
