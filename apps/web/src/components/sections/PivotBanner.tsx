import type { RituelPivot } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Text } from '@/components/ui/Text';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Reveal } from '@/components/patterns/Reveal';
import { Fleuron } from '@/components/ui/Fleuron';
import { PromotionTracker } from '@/components/tracking/PromotionTracker';

interface PivotBannerProps {
  data: RituelPivot;
}

export function PivotBanner({ data }: PivotBannerProps) {
  return (
    <section
      aria-labelledby="pivot-phrase"
      className="bg-sauge-soft py-24 lg:py-32"
    >
      <PromotionTracker
        promotionId="pivot-banner-rituel"
        promotionName="Pivot rituel"
        creativeName={data.cta.label}
        creativeSlot="pivot_banner"
      />
      <Container width="page">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
            <Fleuron size="lg" tone="champagne" />
            <p id="pivot-phrase">
              <Text
                as="span"
                size="lead"
                family="display"
                italic
                balance
                className="text-3xl sm:text-[2rem] leading-snug"
              >
                {data.phrase}
              </Text>
            </p>
            <ButtonLink href={data.cta.href} variant={data.cta.variant} size="lg">
              {data.cta.label}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
