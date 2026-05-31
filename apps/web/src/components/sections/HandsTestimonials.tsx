import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import {
  HandsTestimonialCarousel,
  type HandsTestimonialMediaSlots,
  type HandsTestimonialLabels,
} from '@/components/commerce/HandsTestimonialCarousel';
import type { HandsTestimonial } from '@/lib/schemas';

interface HandsTestimonialsProps {
  items: HandsTestimonial[];
  /**
   * Map keyée par `item.id` → slots avant/après résolus. Forwardé tel quel
   * au carousel.
   */
  mediaSlotsByItemId?: Record<string, HandsTestimonialMediaSlots>;
  /**
   * Phase 7E — en-tête localisé (kicker/title/description). Défaut FR si
   * absent — préserve les usages legacy et les tests qui rendent sans header.
   */
  header?: { kicker: string; title: string; description: string };
  /** Phase 9 i18n — libellés avant/après + « initiée depuis » localisés. */
  labels?: HandsTestimonialLabels;
}

const DEFAULT_HANDS_HEADER = {
  kicker: 'Trois mains',
  title: 'Trois mains, trois saisons.',
  description:
    'Photos non retouchées, prises chez nos initiées au bout de plusieurs mois de rituel. La plaque retrouve sa nervure, sans recette miracle.',
};

export function HandsTestimonials({
  items,
  mediaSlotsByItemId,
  header = DEFAULT_HANDS_HEADER,
  labels,
}: HandsTestimonialsProps) {
  return (
    <section
      aria-labelledby="hands-title"
      className="bg-creme-warm py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-10 max-w-2xl space-y-4">
          <Kicker>{header.kicker}</Kicker>
          <Heading id="hands-title" as="h2" size="display-sm">
            {header.title}
          </Heading>
          <Text size="body" tone="secondary" prose>
            {header.description}
          </Text>
        </div>
        <HandsTestimonialCarousel
          items={items}
          mediaSlotsByItemId={mediaSlotsByItemId}
          {...(labels ? { labels } : {})}
        />
      </Container>
    </section>
  );
}
