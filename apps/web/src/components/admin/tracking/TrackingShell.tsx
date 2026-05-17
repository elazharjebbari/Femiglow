import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { DriftBannerServer } from '@/components/admin/tracking/gtm/DriftBannerServer';

export type TrackingTab =
  | 'dashboard'
  | 'plans'
  | 'providers'
  | 'inventory'
  | 'events'
  | 'mappings'
  | 'attribution'
  | 'test'
  | 'logs'
  | 'settings';

const TABS: Array<{ key: TrackingTab; href: string; label: string }> = [
  { key: 'dashboard', href: '/admin/tracking', label: 'Vue d’ensemble' },
  { key: 'plans', href: '/admin/tracking/plans', label: 'Plans (unifié)' },
  { key: 'providers', href: '/admin/tracking/providers', label: 'Providers' },
  { key: 'inventory', href: '/admin/tracking/inventory', label: 'Inventaire' },
  { key: 'events', href: '/admin/tracking/events', label: 'Événements' },
  { key: 'mappings', href: '/admin/tracking/events/mappings', label: 'Mappings vendors' },
  { key: 'attribution', href: '/admin/tracking/attribution', label: 'Attribution' },
  { key: 'test', href: '/admin/tracking/test', label: 'Tester' },
  { key: 'logs', href: '/admin/tracking/logs', label: 'Logs' },
  { key: 'settings', href: '/admin/tracking/settings', label: 'Réglages' },
];

interface TrackingShellProps {
  adminEmail: string;
  active: TrackingTab;
  title: string;
  description?: string;
  children: ReactNode;
}

export function TrackingShell({
  adminEmail,
  active,
  title,
  description,
  children,
}: TrackingShellProps) {
  return (
    <AdminShell adminEmail={adminEmail} active="tracking">
      <DriftBannerServer />
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-stone-500">Tracking</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-stone-600">{description}</p>
        ) : null}
      </header>
      <nav aria-label="Sous-navigation tracking" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-stone-200">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  className={`-mb-px inline-block border-b-2 px-3 py-2 text-sm transition ${
                    isActive
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <section>{children}</section>
    </AdminShell>
  );
}
