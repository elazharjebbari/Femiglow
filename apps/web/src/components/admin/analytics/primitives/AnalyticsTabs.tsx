/**
 * AnalyticsTabs — navigation horizontale entre les 5 onglets analytics.
 * cf. docs/analytics/04-ui-design.md §3.2
 *
 * Conserve les query params (period, device, traffic) en passant par
 * `useSearchParams` côté client. Active state via pathname.
 */
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export interface AnalyticsTab {
  href: string;
  label: string;
  /** Slug pour matcher le pathname (ex: 'overview' → /admin/analytics OU /admin/analytics/overview). */
  match: string[];
}

export const ANALYTICS_TABS: AnalyticsTab[] = [
  { href: '/admin/analytics', label: 'Vue d’ensemble', match: ['/admin/analytics'] },
  { href: '/admin/analytics/live', label: 'Live', match: ['/admin/analytics/live'] },
  {
    href: '/admin/analytics/funnel',
    label: 'Funnel',
    match: ['/admin/analytics/funnel'],
  },
  { href: '/admin/analytics/cta', label: 'CTA', match: ['/admin/analytics/cta'] },
  {
    href: '/admin/analytics/checkout',
    label: 'Checkout',
    match: ['/admin/analytics/checkout'],
  },
];

interface AnalyticsTabsProps {
  tabs?: AnalyticsTab[];
  className?: string;
}

export function AnalyticsTabs({
  tabs = ANALYTICS_TABS,
  className = '',
}: AnalyticsTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  return (
    <nav
      aria-label="Onglets analytics"
      className={`border-b border-stone-200 ${className}`}
      data-testid="analytics-tabs"
    >
      <ul className="flex gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.match.includes(pathname ?? '');
          const href = queryString ? `${tab.href}?${queryString}` : tab.href;
          return (
            <li key={tab.href} role="presentation">
              <Link
                href={href}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                className={`block whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
