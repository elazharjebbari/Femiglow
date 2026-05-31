import type { ReactNode } from 'react';
import { Image } from '@/components/ui/Image';
import { Text } from '@/components/ui/Text';
import type { HandsTestimonial } from '@/lib/schemas';

export interface HandsTestimonialMediaSlots {
  before?: ReactNode;
  after?: ReactNode;
}

/**
 * Phase 9 i18n — libellés localisés (avant/après + « initiée depuis »).
 * `initieeSince` est un gabarit avec `{date}`. Défaut FR si absent.
 */
export interface HandsTestimonialLabels {
  before: string;
  after: string;
  /** Gabarit contenant `{date}`. */
  initieeSince: string;
}

const DEFAULT_HANDS_LABELS: HandsTestimonialLabels = {
  before: 'Avant',
  after: 'Après',
  initieeSince: 'Initiée depuis {date}',
};

interface HandsTestimonialCarouselProps {
  items: HandsTestimonial[];
  /**
   * Map keyée par `item.id` → slots avant/après résolus côté serveur. Si
   * absent → fallback vers `beforeImage`/`afterImage`.
   */
  mediaSlotsByItemId?: Record<string, HandsTestimonialMediaSlots>;
  /** Phase 9 i18n — libellés localisés. Défaut FR. */
  labels?: HandsTestimonialLabels;
}

export function HandsTestimonialCarousel({
  items,
  mediaSlotsByItemId,
  labels = DEFAULT_HANDS_LABELS,
}: HandsTestimonialCarouselProps) {
  return (
    <ul
      role="list"
      aria-label="Témoignages photos"
      tabIndex={0}
      className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {items.map((item) => {
        const slots = mediaSlotsByItemId?.[item.id];
        return (
        <li
          key={item.id}
          className="flex w-[85%] shrink-0 snap-start flex-col gap-4 lg:w-auto"
        >
          <div className="grid grid-cols-2 gap-2">
            <figure className="space-y-2">
              {slots?.before ? (
                <div className="aspect-square overflow-hidden rounded-md bg-encre/5">
                  {slots.before}
                </div>
              ) : (
                <Image
                  src={item.beforeImage.src}
                  alt={item.beforeImage.alt}
                  width={item.beforeImage.width}
                  height={item.beforeImage.height}
                  ratio="1:1"
                  sizes="(min-width: 1024px) 18vw, 42vw"
                />
              )}
              <figcaption className="text-[11px] uppercase tracking-[0.18em] text-encre/60">
                {labels.before}
              </figcaption>
            </figure>
            <figure className="space-y-2">
              {slots?.after ? (
                <div className="aspect-square overflow-hidden rounded-md bg-encre/5">
                  {slots.after}
                </div>
              ) : (
                <Image
                  src={item.afterImage.src}
                  alt={item.afterImage.alt}
                  width={item.afterImage.width}
                  height={item.afterImage.height}
                  ratio="1:1"
                  sizes="(min-width: 1024px) 18vw, 42vw"
                />
              )}
              <figcaption className="text-[11px] uppercase tracking-[0.18em] text-encre/60">
                {labels.after}
              </figcaption>
            </figure>
          </div>
          <blockquote className="font-display text-xl italic leading-snug text-encre">
            «&#x202f;{item.quote}&#x202f;»
          </blockquote>
          <Text size="caption" tone="tertiary">
            {item.authorFirstName}
            {item.city ? ` — ${item.city}` : ''}
            {item.initieeDepuis ? (
              <>
                {' · '}
                <em className="font-script not-italic text-encre/70">
                  {labels.initieeSince.replace('{date}', item.initieeDepuis)}
                </em>
              </>
            ) : null}
          </Text>
        </li>
        );
      })}
    </ul>
  );
}
