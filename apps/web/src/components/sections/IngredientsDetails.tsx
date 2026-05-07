import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { IngredientsTable } from '@/components/commerce/IngredientsTable';
import type { SubProduct } from '@/lib/schemas';

interface IngredientsDetailsProps {
  composition: SubProduct[];
  anchor?: string;
  /**
   * Slot media résolu côté serveur — affiché en bandeau d'illustration au-
   * dessus de la table (4:3, doux). Optionnel.
   */
  mediaSlot?: ReactNode;
}

export function IngredientsDetails({
  composition,
  anchor = 'ingredients-details',
  mediaSlot,
}: IngredientsDetailsProps) {
  return (
    <section
      id={anchor}
      aria-labelledby="ingredients-title"
      className="bg-creme-warm py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-12 max-w-2xl space-y-4">
          <Kicker>Le détail</Kicker>
          <Heading id="ingredients-title" as="h2" size="display-sm">
            La composition lue ligne par ligne.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Tout est dit&#x202f;: noms d’usage, INCI, fonction, origine,
            concentration. Pas d’angle mort, pas de promesse cachée derrière
            une formule.
          </Text>
        </div>
        {mediaSlot && (
          <div className="mb-12 overflow-hidden rounded-md">
            {mediaSlot}
          </div>
        )}
        <div className="space-y-12">
          {composition.map((sub) => (
            <div key={sub.id} id={`${anchor}-${sub.id}`}>
              <IngredientsTable subProduct={sub} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
