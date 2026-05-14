import Link from 'next/link';
import type { ReactNode } from 'react';

interface AdminShellProps {
  adminEmail: string;
  active:
    | 'dashboard'
    | 'leads'
    | 'webhooks'
    | 'media'
    | 'tracking'
    | 'analytics'
    | 'components'
    | 'settings'
    | 'audit'
    | 'seo'
    | 'products'
    | 'chat'
    | 'rituals'
    | 'legal';
  children: ReactNode;
}

const NAV: Array<{ href: string; key: AdminShellProps['active']; label: string }> = [
  { href: '/admin', key: 'dashboard', label: 'Tableau de bord' },
  { href: '/admin/leads', key: 'leads', label: 'Leads' },
  { href: '/admin/rituals/queue', key: 'rituals', label: 'Rituels partagés' },
  { href: '/admin/media', key: 'media', label: 'Médias' },
  { href: '/admin/components', key: 'components', label: 'Composants' },
  { href: '/admin/seo', key: 'seo', label: 'SEO' },
  { href: '/admin/legal', key: 'legal', label: 'Pages légales' },
  { href: '/admin/products', key: 'products', label: 'Produits' },
  { href: '/admin/chat', key: 'chat', label: 'Chat' },
  { href: '/admin/webhooks', key: 'webhooks', label: 'Webhooks' },
  { href: '/admin/tracking', key: 'tracking', label: 'Tracking' },
  { href: '/admin/analytics', key: 'analytics', label: 'Analytics' },
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
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
