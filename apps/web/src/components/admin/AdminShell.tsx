import Link from 'next/link';
import type { ReactNode } from 'react';

interface AdminShellProps {
  adminEmail: string;
  active:
    | 'dashboard'
    | 'leads'
    | 'webhooks'
    | 'media'
    | 'stories'
    | 'tracking'
    | 'analytics'
    | 'components'
    | 'i18n'
    | 'settings'
    | 'audit'
    | 'seo'
    | 'products'
    | 'coupons'
    | 'content-studio'
    | 'chat'
    | 'rituals'
    | 'legal'
    | 'emails';
  children: ReactNode;
}

const NAV: Array<{ href: string; key: AdminShellProps['active']; label: string }> = [
  { href: '/admin', key: 'dashboard', label: 'Tableau de bord' },
  { href: '/admin/leads', key: 'leads', label: 'Leads' },
  { href: '/admin/rituals/queue', key: 'rituals', label: 'Rituels partagés' },
  { href: '/admin/media', key: 'media', label: 'Médias' },
  { href: '/admin/stories', key: 'stories', label: 'Stories' },
  { href: '/admin/components', key: 'components', label: 'Composants' },
  { href: '/admin/i18n', key: 'i18n', label: 'Traductions / i18n' },
  { href: '/admin/seo', key: 'seo', label: 'SEO' },
  { href: '/admin/legal', key: 'legal', label: 'Pages légales' },
  { href: '/admin/products', key: 'products', label: 'Produits' },
  { href: '/admin/content-studio', key: 'content-studio', label: 'Studio contenu' },
  { href: '/admin/chat', key: 'chat', label: 'Chat' },
  { href: '/admin/emails', key: 'emails', label: 'Emails' },
  { href: '/admin/webhooks', key: 'webhooks', label: 'Webhooks' },
  { href: '/admin/tracking', key: 'tracking', label: 'Tracking' },
  { href: '/admin/analytics', key: 'analytics', label: 'Analytics' },
  { href: '/admin/coupons', key: 'coupons', label: 'Coupons' },
  { href: '/admin/audit', key: 'audit', label: 'Audit' },
  { href: '/admin/settings', key: 'settings', label: 'Réglages' },
];

export function AdminShell({ adminEmail, active, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 lg:flex-row">
      <aside className="border-b border-stone-200 bg-white px-6 py-4 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between lg:block">
          <p className="text-sm font-semibold tracking-tight text-stone-900">
            FemiGlow Admin
          </p>
          <p className="text-xs text-stone-500 lg:mt-1">{adminEmail}</p>
        </div>
        <nav aria-label="Navigation principale" className="mt-4 lg:mt-8">
          <ul className="flex gap-2 lg:flex-col lg:gap-1">
            {NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    data-testid={`admin-nav-${item.key}`}
                    className={`block rounded-md px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <form action="/api/admin/logout" method="post" className="mt-6 hidden lg:block">
          <button
            type="submit"
            className="text-xs text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </aside>
      {/* min-w-0 + overflow-x-hidden : sans ça, un enfant à contenu
          large (pre JSON, table dense…) empêche le flex item `main` de
          rétrécir sous viewport, ce qui crée du scroll horizontal au
          niveau de la page. Les conteneurs internes qui *veulent*
          défiler horizontalement (ex. <pre overflow-auto>) le font
          dans leur propre boîte sans déborder. */}
      <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
