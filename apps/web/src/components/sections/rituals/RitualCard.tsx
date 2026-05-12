import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import type { RitualTestimonialPublic } from '@/lib/schemas/rituals';

type Variant = 'compact' | 'default';

interface RitualCardProps {
  data: RitualTestimonialPublic;
  variant?: Variant;
  className?: string;
  onPhotoClick?: (photoIndex: number) => void;
  highlighted?: boolean;
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function formatInitiatedSince(raw: string | null): string | null {
  if (!raw) return null;
  const [year, month] = raw.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return `${MONTHS_FR[month - 1]} ${year}`;
}

function buildPhotoAlt(data: RitualTestimonialPublic): string {
  const first = data.signature.firstName;
  const name = first ?? 'une initiée';
  return `Mains de ${name}, partagées après quelques semaines de rituel`;
}

/**
 * RitualCard — version pure, props injectées.
 * Cf. docs/reviews-wall/execution/02-ui-ux-conception.md § 2.1
 *    docs/reviews-wall/execution/05-frontend-plan-action.md § 4
 */
export function RitualCard({
  data,
  variant = 'default',
  className,
  onPhotoClick,
  highlighted,
}: RitualCardProps) {
  const initiatedSince = formatInitiatedSince(data.signature.initiatedSince);
  const firstName = data.signature.isAnonymous || !data.signature.firstName
    ? 'Une initiée'
    : data.signature.firstName;
  const city = data.signature.city;
  const photo = data.photos[0];
  const showBadge = data.wouldRecommend === 'oui';

  const titleId = `ritual-card-${data.publicSlug}-quote`;
  const isCompact = variant === 'compact';

  return (
    <article
      data-testid="ritual-card"
      data-public-slug={data.publicSlug}
      aria-labelledby={titleId}
      className={cn(
        'group relative flex flex-col bg-[var(--ritual-card-bg)]',
        'border-[length:var(--ritual-card-border-width)] border-[var(--ritual-card-border-color)]',
        'p-[var(--ritual-card-padding)] transition-[transform,box-shadow] duration-200 ease-[var(--ritual-ease-out-soft)]',
        'hover:-translate-y-[3px] hover:shadow-[0_1px_2px_rgba(44,42,40,0.06)]',
        highlighted && 'ring-2 ring-sauge-dark',
        isCompact && 'gap-3',
        className,
      )}
    >
      {photo && isCompact && (
        <button
          type="button"
          onClick={() => onPhotoClick?.(0)}
          aria-label={`Voir la photo en grand : ${buildPhotoAlt(data)}`}
          className="relative block w-full overflow-hidden border border-[var(--ritual-card-border-color)] aspect-[var(--ritual-module-card-aspect)]"
        >
          <Image
            src={photo.thumbUrl}
            alt={photo.alt ?? buildPhotoAlt(data)}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
            style={{
              objectPosition: `${photo.focalX * 100}% ${photo.focalY * 100}%`,
            }}
            loading="lazy"
          />
        </button>
      )}

      {photo && !isCompact && (
        <button
          type="button"
          onClick={() => onPhotoClick?.(0)}
          aria-label={`Voir la photo en grand : ${buildPhotoAlt(data)}`}
          className="float-left mr-4 mb-3 block h-20 w-20 overflow-hidden border border-[var(--ritual-card-border-color)]"
        >
          <Image
            src={photo.thumbUrl}
            alt={photo.alt ?? buildPhotoAlt(data)}
            width={80}
            height={80}
            sizes="80px"
            className="h-20 w-20 object-cover"
            style={{
              objectPosition: `${photo.focalX * 100}% ${photo.focalY * 100}%`,
            }}
            loading="lazy"
          />
        </button>
      )}

      <blockquote
        id={titleId}
        className="font-cormorant text-[17px] italic leading-relaxed text-encre"
      >
        « {data.body} »
      </blockquote>

      <footer className="mt-3 flex flex-col gap-1 text-encre/70 font-inter">
        <p className="text-xs">
          — {firstName}
          {city ? `, ${city}` : ''}
        </p>
        {initiatedSince && (
          <p className="text-xs">Initiée depuis {initiatedSince}</p>
        )}
        {data.ritualTags.length > 0 && (
          <p className="mt-1 text-xs text-sauge-dark">
            {data.ritualTags.map((tag) => tag.replace(/-/g, ' ')).join(' · ')}
          </p>
        )}
        {showBadge && (
          <span
            data-testid="ritual-card-badge-recommend"
            className="mt-2 inline-flex w-fit border-t border-sauge-soft pt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-sauge-dark font-inter"
          >
            Reviendrait
          </span>
        )}
      </footer>
    </article>
  );
}
