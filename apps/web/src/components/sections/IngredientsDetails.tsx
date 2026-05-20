import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { SubProductBlock } from '@/components/commerce/SubProductBlock';
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

/**
 * Section « Le détail · La composition lue ligne par ligne. » de `/kit`.
 *
 * Refonte Phase 2 (`docs/ingredients-detail-optim-2026-05/`) :
 *  - Délégation à `SubProductBlock` qui pilote l'accordéon mobile + la
 *    liste responsive (cards mobile / tableau desktop) + lien retour pack.
 *  - Premier sous-produit ouvert par défaut (mobile), les autres fermés.
 *  - Desktop : tous les sous-produits dépliés en permanence via le hook
 *    `useIsDesktop` interne à `SubProductBlock`.
 */
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
        {mediaSlot ? (
          <div className="mb-12 overflow-hidden rounded-md">{mediaSlot}</div>
        ) : null}
        <div className="space-y-12">
          {composition.map((sub, index) => (
            <SubProductBlock
              key={sub.id}
              subProduct={sub}
              index={index}
              anchor={anchor}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
