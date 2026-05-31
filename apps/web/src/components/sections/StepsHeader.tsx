/**
 * `StepsHeader` — en-tête de la grille « rituel 4 gestes » (Kolenda §4.7).
 *
 * Affiché au-dessus des 4 cartes pour annoncer la durée totale et
 * réduire l'anxiété temps (Attention #18). Server Component pur.
 */
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import type { ProductFeedStepsHeader } from '@/lib/products/feed/types';

export interface StepsHeaderProps {
  header: ProductFeedStepsHeader;
  /** ID utilisé par `aria-labelledby` de la section parente. */
  headingId?: string;
}

export function StepsHeader({
  header,
  headingId,
}: StepsHeaderProps): JSX.Element {
  return (
    <div
      data-testid="steps-header"
      className="mx-auto max-w-xl space-y-2 text-center"
    >
      <Kicker tone="champagne">{header.kicker}</Kicker>
      <Heading id={headingId} as="h3" size="display-sm">
        {header.totalDuration}
      </Heading>
      <Text size="body" tone="secondary" prose className="mx-auto">
        {header.lead}
      </Text>
    </div>
  );
}
