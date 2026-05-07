import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { categoryLabels, categoryOrder, type CategoryKey } from '@/lib/i18n/categories';

interface CategoryPillsProps {
  active: CategoryKey;
}

function buildHref(key: CategoryKey): string {
  return key === 'all' ? '/journal' : `/journal?category=${key}`;
}

export function CategoryPills({ active }: CategoryPillsProps) {
  return (
    <nav aria-label="Filtrer le journal par catégorie" className="mx-auto w-full max-w-page px-6">
      <ul className="flex flex-wrap items-center gap-2 sm:gap-3">
        {categoryOrder.map((key) => {
          const isActive = key === active;
          return (
            <li key={key}>
              <Link
                href={buildHref(key)}
                aria-current={isActive ? 'page' : undefined}
                scroll={false}
                className={cn(
                  'inline-flex min-h-[44px] items-center rounded-full border px-5 py-3',
                  'font-body text-sm uppercase tracking-[0.18em]',
                  'transition-colors duration-200',
                  isActive
                    ? 'border-encre bg-encre text-creme'
                    : 'border-encre/20 text-encre hover:border-encre/60',
                )}
              >
                {categoryLabels[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
