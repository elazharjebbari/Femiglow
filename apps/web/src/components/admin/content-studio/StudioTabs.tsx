'use client';

export type StudioTab = 'pipeline' | 'calendar' | 'analytics' | 'budget';

const TABS: { key: StudioTab; label: string }[] = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'calendar', label: 'Calendrier' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'budget', label: 'Budget' },
];

export function StudioTabs({
  active,
  onChange,
}: {
  active: StudioTab;
  onChange: (tab: StudioTab) => void;
}) {
  return (
    <div className="flex rounded-md border border-stone-200 bg-white p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.key
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}