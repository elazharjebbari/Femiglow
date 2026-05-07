import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import {
  HandsTestimonialCarousel,
  type HandsTestimonialMediaSlots,
} from '@/components/commerce/HandsTestimonialCarousel';
import type { HandsTestimonial } from '@/lib/schemas';

interface HandsTestimonialsProps {
  items: HandsTestimonial[];
  /**
   * Map keyée par `item.id` → slots avant/après résolus. Forwardé tel quel
   * au carousel.
   */
  mediaSlotsByItemId?: Record<string, HandsTestimonialMediaSlots>;
}

export function HandsTestimonials({ items, mediaSlotsByItemId }: HandsTestimonialsProps) {
  return (
    <section
      aria-labelledby="hands-title"
      className="bg-creme-warm py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-10 max-w-2xl space-y-4">
          <Kicker>Trois mains</Kicker>
          <Heading id="hands-title" as="h2" size="display-sm">
            Trois mains, trois saisons.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Photos non retouchées, prises chez nos initiées au bout de plusieurs
            mois de rituel. La plaque retrouve sa nervure, sans recette miracle.
          </Text>
        </div>
        <HandsTestimonialCarousel items={items} mediaSlotsByItemId={mediaSlotsByItemId} />
      </Container>
    </section>
  );
}
