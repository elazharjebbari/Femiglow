import Link from 'next/link';
import type { Media, MediaVariant } from '@/lib/db/types';
import { previewThumbUrl } from '@/lib/media/preview-thumb';

interface MediaTileProps {
  /**
   * Accepte un `Media` simple ou enrichi de `variants` (cas
   * `MediaWithRelations`). Quand `variants` est fourni, on choisit
   * la plus petite variant disponible pour la vignette.
   */
  media: Media & { variants?: MediaVariant[]; thumbUrl?: string };
  selected?: boolean;
  onSelectHref?: string;
}

const STATUS_LABEL: Record<Media['status'], { text: string; tone: string }> = {
  pending: { text: 'En attente', tone: 'bg-stone-200 text-stone-700' },
  processing: { text: 'Traitement', tone: 'bg-amber-100 text-amber-800' },
  ready: { text: 'Prêt', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { text: 'Échec', tone: 'bg-rose-100 text-rose-800' },
  passthrough: { text: 'Passthrough', tone: 'bg-sky-100 text-sky-800' },
};

export function MediaTile({ media, selected, onSelectHref }: MediaTileProps) {
  const status = STATUS_LABEL[media.status];
  const href = onSelectHref ?? `/admin/media/${media.id}`;
  const ariaLabel = `${media.slug} — ${status.text}${media.isHero ? ' — hero' : ''}`;
  const aspect = media.originalWidth && media.originalHeight
    ? `${media.originalWidth} / ${media.originalHeight}`
    : '4 / 3';
  const bg = media.palette?.[0]?.hex ?? '#f3ede4';
  const thumb = media.thumbUrl ?? previewThumbUrl(media);

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      aria-current={selected ? 'true' : undefined}
      className={`group relative block overflow-hidden rounded-md border ${
        selected ? 'border-stone-900 ring-2 ring-stone-900' : 'border-stone-200'
      } bg-white transition hover:shadow-md`}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: aspect, backgroundColor: bg }}
      >
        {media.kind === 'image' && thumb ? (
          // Plain <img> : l'URL est servie par notre route handler
          // /media-files/[...path] (cf. next.config rewrites). next/image
          // n'apporte rien pour une miniature admin et compliquerait la CSP.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
        <span className="truncate font-medium text-stone-800">{media.slug}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 ${status.tone}`}>{status.text}</span>
      </div>
      {media.isHero && (
        <span className="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          Hero
        </span>
      )}
    </Link>
  );
}
