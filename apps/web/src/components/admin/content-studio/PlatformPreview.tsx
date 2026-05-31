'use client';

import type { StudioMediaItem } from './types';

function PlatformPreview({
  caption,
  hashtags,
  media,
}: {
  caption: string;
  hashtags: string[];
  media: StudioMediaItem | null;
}) {
  return (
    <div className="mt-3 max-w-md rounded-md border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2">
        <div className="h-7 w-7 rounded-full bg-stone-900" />
        <div>
          <p className="text-xs font-semibold text-stone-900">FemiGlow Maroc</p>
          <p className="text-xs text-stone-500">Brouillon preview</p>
        </div>
      </div>
      <div className="aspect-[4/5] bg-stone-100">
        {media?.previewUrl ? (
          <img src={media.previewUrl} alt={media.alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">
            Sélectionnez un média pour vérifier le rendu avant Postiz.
          </div>
        )}
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{caption}</p>
        <p className="text-xs text-stone-500">{hashtags.map((tag) => `#${tag}`).join(' ')}</p>
      </div>
    </div>
  );
}

export { PlatformPreview };