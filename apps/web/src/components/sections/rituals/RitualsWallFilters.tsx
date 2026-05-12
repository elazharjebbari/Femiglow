'use client';
import { cn } from '@/lib/utils/cn';

export type RitualsFilterKey = 'all' | 'with_photos' | 'halal' | 'recent';

const FILTER_LABEL: Record<RitualsFilterKey, string> = {
  all: 'Tous',
  with_photos: 'Avec photos',
  halal: 'Halal',
  recent: 'Récents',
};

interface RitualsWallFiltersProps {
  value: RitualsFilterKey;
  onChange: (next: RitualsFilterKey) => void;
  className?: string;
}

export function RitualsWallFilters({
  value,
  onChange,
  className,
}: RitualsWallFiltersProps) {
  return (
    <nav aria-label="Filtres rituels" className={cn('w-full', className)}>
      <ul className="flex gap-2 overflow-x-auto pb-1" role="list">
        {(Object.keys(FILTER_LABEL) as RitualsFilterKey[]).map((key) => {
          const active = value === key;
          return (
            <li key={key} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(key)}
                data-testid={`rituals-filter-${key}`}
                className={cn(
                  'border-[1.5px] px-3.5 py-2 text-xs font-medium text-encre transition-colors',
                  active
                    ? 'border-sauge-dark bg-sauge'
                    : 'border-sauge-soft bg-white hover:bg-sauge-soft',
                )}
              >
                {FILTER_LABEL[key]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
