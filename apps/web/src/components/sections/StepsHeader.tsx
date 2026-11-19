/**
 * `StepsHeader` — en-tête du mode d'emploi : surtitre, durée totale en
 * titre, phrase de cadence. Annonce le temps demandé avant la liste.
 * Server Component pur.
 */
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
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
      <p className="font-body text-base leading-[1.6] text-encre-soft">
        {header.lead}
      </p>
    </div>
  );
}
