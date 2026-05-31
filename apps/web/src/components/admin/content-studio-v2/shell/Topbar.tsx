'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell } from 'lucide-react';
import { useMemo } from 'react';

const SECTION_LABELS: Record<string, string> = {
  home: 'Accueil',
  create: 'Création',
  library: 'Bibliothèque',
  plan: 'Planning',
  _dev: 'Dev',
  preview: 'Aperçu',
};

function buildCrumbs(pathname: string): Array<{ label: string; href: string | null }> {
  if (!pathname.startsWith('/admin/content-studio-v2')) return [];
  const segments = pathname.replace('/admin/content-studio-v2', '').split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Accueil', href: null }];
  const crumbs: Array<{ label: string; href: string | null }> = [
    { label: 'Studio', href: '/admin/content-studio-v2/home' },
  ];
  let acc = '/admin/content-studio-v2';
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const isLast = idx === segments.length - 1;
    crumbs.push({
      label: SECTION_LABELS[seg] ?? seg.replace(/-/g, ' '),
      href: isLast ? null : acc,
    });
  });
  return crumbs;
}

interface TopbarProps {
  /**
   * Optional user identity, displayed in the avatar circle. Pass the
   * authenticated admin email's first letters from the page component.
   */
  userInitials?: string;
  userEmail?: string;
}

export function Topbar({ userInitials = 'EJ', userEmail }: TopbarProps) {
  const pathname = usePathname() ?? '';
  const crumbs = useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <header
      className="cs-topbar"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 24,
        alignItems: 'center',
        padding: '14px 28px',
        background: 'var(--cs-bg-base)',
        borderBottom: '1px solid var(--cs-border-hair)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <nav aria-label="Fil d'Ariane" className="cs-crumbs flex items-center gap-2 text-sm">
        {crumbs.map((crumb, idx) => (
          <span key={`${crumb.label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {idx > 0 ? <span style={{ color: 'var(--cs-fg-muted)' }}>/</span> : null}
            {crumb.href ? (
              <Link
                href={crumb.href}
                style={{
                  color: 'var(--cs-fg-secondary)',
                  textDecoration: 'none',
                  fontSize: 'var(--cs-text-sm)',
                  transition: 'color var(--cs-motion-fast) var(--cs-easing)',
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                style={{
                  color: 'var(--cs-fg-primary)',
                  fontStyle: 'italic',
                  fontFamily: 'var(--cs-font-display)',
                  fontSize: 'var(--cs-text-sm)',
                }}
              >
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <button
          type="button"
          title="Recherche (⌘K)"
          aria-label="Ouvrir la palette de commandes"
          className="cs-search-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px 6px 10px',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius)',
            background: 'var(--cs-bg-elevated)',
            color: 'var(--cs-fg-secondary)',
            fontSize: 'var(--cs-text-sm)',
            fontFamily: 'var(--cs-font-body)',
            cursor: 'pointer',
            transition: 'all var(--cs-motion-fast) var(--cs-easing)',
          }}
        >
          <Search size={14} />
          <span>Rechercher</span>
          <kbd
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--cs-bg-sunken)',
              fontFamily: 'var(--cs-font-mono)',
              fontSize: 11,
              color: 'var(--cs-fg-muted)',
              border: '1px solid var(--cs-border-hair)',
              marginLeft: 4,
            }}
          >
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: 'var(--cs-radius-full)',
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            color: 'var(--cs-fg-secondary)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <Bell size={15} />
        </button>

        <button
          type="button"
          aria-label={userEmail ? `Profil ${userEmail}` : 'Profil'}
          title={userEmail}
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--cs-radius-full)',
            background: 'linear-gradient(135deg, var(--cs-accent) 0%, var(--cs-clay) 100%)',
            color: 'var(--cs-fg-on-accent)',
            fontFamily: 'var(--cs-font-display)',
            fontWeight: 600,
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {userInitials.slice(0, 2).toUpperCase()}
        </button>
      </div>
    </header>
  );
}
