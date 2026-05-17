'use client';

export function LoadMore({
  currentCount,
  totalCount,
  onLoadMore,
  disabled,
  label = 'items',
}: {
  currentCount: number;
  totalCount: number;
  onLoadMore: () => void;
  disabled: boolean;
  label?: string;
}) {
  if (currentCount >= totalCount) return null;
  const remaining = totalCount - currentCount;
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={disabled}
        className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        Charger plus ({remaining} {label} restants)
      </button>
    </div>
  );
}