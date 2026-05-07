import type { Media, MediaVariant } from '@/lib/db/types';
import { MediaTile } from './MediaTile';

interface MediaLibraryGridProps {
  rows: (Media & { variants?: MediaVariant[]; thumbUrl?: string })[];
  emptyLabel?: string;
}

export function MediaLibraryGrid({ rows, emptyLabel }: MediaLibraryGridProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-12 text-center text-sm text-stone-500">
        {emptyLabel ?? 'Aucun média.'}
      </p>
    );
  }
  return (
    <ul
      role="list"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {rows.map((m) => (
        <li key={m.id}>
          <MediaTile media={m} />
        </li>
      ))}
    </ul>
  );
}
