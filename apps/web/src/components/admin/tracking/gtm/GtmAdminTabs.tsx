'use client';

import { useState, type ReactNode } from 'react';

export type GtmAdminTab = 'export' | 'configurations' | 'visualization';

interface Props {
  defaultTab?: GtmAdminTab;
  panels: Record<GtmAdminTab, ReactNode>;
}

const TABS: Array<{ key: GtmAdminTab; label: string; description: string }> = [
  {
    key: 'export',
    label: 'Export',
    description: 'Container.json prêt à importer',
  },
  {
    key: 'configurations',
    label: 'Configurations',
    description: 'Variables, Pixel IDs, versions',
  },
  {
    key: 'visualization',
    label: 'Visualisation',
    description: 'Graphique du conteneur',
  },
];

export function GtmAdminTabs({ defaultTab = 'export', panels }: Props) {
  const [active, setActive] = useState<GtmAdminTab>(defaultTab);

  return (
    <div>
      <nav aria-label="Sous-sections export GTM" className="mb-6">
        <ul
          role="tablist"
          aria-orientation="horizontal"
          className="flex flex-wrap gap-1 border-b border-stone-200"
        >
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  role="tab"
                  id={`gtm-tab-${t.key}`}
                  aria-selected={isActive}
                  aria-controls={`gtm-panel-${t.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActive(t.key)}
                  className={`group -mb-px inline-flex flex-col items-start gap-0.5 border-b-2 px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                    isActive
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-[11px] text-stone-500 group-hover:text-stone-600">
                    {t.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {TABS.map((t) => (
        <div
          key={t.key}
          id={`gtm-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`gtm-tab-${t.key}`}
          hidden={t.key !== active}
        >
          {t.key === active ? panels[t.key] : null}
        </div>
      ))}
    </div>
  );
}
