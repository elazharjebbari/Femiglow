import 'server-only';
import type { ReactNode } from 'react';
import { HandsTestimonials } from './HandsTestimonials';
import type {
  HandsTestimonialMediaSlots,
  HandsTestimonialLabels,
} from '@/components/commerce/HandsTestimonialCarousel';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import type { HandsTestimonial } from '@/lib/schemas';

interface HandsTestimonialsBoundProps {
  items: HandsTestimonial[];
  componentKey?: string;
  /** Phase 7E — en-tête localisé forwardé à `<HandsTestimonials>`. */
  header?: { kicker: string; title: string; description: string };
  /** Phase 9 i18n — libellés avant/après + « initiée depuis » localisés. */
  labels?: HandsTestimonialLabels;
}

/**
 * RSC wrapper qui résout, pour chaque témoignage `items[i]`, deux slots
 * `<id>-before` et `<id>-after` du composant `kit-hands-testimonials`. Les
 * slots résolus actifs sont forwardés au carousel via `mediaSlotsByItemId`.
 */
export async function HandsTestimonialsBound({
  items,
  componentKey = 'kit-hands-testimonials',
  header,
  labels,
}: HandsTestimonialsBoundProps) {
  const entries = await Promise.all(
    items.map(async (item): Promise<[string, HandsTestimonialMediaSlots] | null> => {
      const beforeSlot = `${item.id}-before`;
      const afterSlot = `${item.id}-after`;
      const [beforeRes, afterRes] = await Promise.all([
        resolveComponentSlot(componentKey, beforeSlot),
        resolveComponentSlot(componentKey, afterSlot),
      ]);

      const slots: HandsTestimonialMediaSlots = {};
      if (beforeRes?.binding?.isActive && beforeRes.media) {
        slots.before = (
          <ComponentMedia
            componentKey={componentKey}
            slot={beforeSlot}
            context="inline"
            sizes="(min-width: 1024px) 18vw, 42vw"
            style={{ aspectRatio: '1 / 1', width: '100%', height: '100%' }}
          /> as ReactNode
        );
      }
      if (afterRes?.binding?.isActive && afterRes.media) {
        slots.after = (
          <ComponentMedia
            componentKey={componentKey}
            slot={afterSlot}
            context="inline"
            sizes="(min-width: 1024px) 18vw, 42vw"
            style={{ aspectRatio: '1 / 1', width: '100%', height: '100%' }}
          /> as ReactNode
        );
      }
      if (!slots.before && !slots.after) return null;
      return [item.id, slots];
    }),
  );

  const mediaSlotsByItemId = Object.fromEntries(
    entries.filter((e): e is [string, HandsTestimonialMediaSlots] => e !== null),
  );

  return (
    <HandsTestimonials
      items={items}
      mediaSlotsByItemId={mediaSlotsByItemId}
      header={header}
      {...(labels ? { labels } : {})}
    />
  );
}
