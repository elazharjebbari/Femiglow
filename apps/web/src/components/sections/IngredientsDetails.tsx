import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { SubProductBlock } from '@/components/commerce/SubProductBlock';
import type { IngredientsTableLabels } from '@/components/commerce/IngredientsTable';
import type { SubProduct } from '@/lib/schemas';

interface IngredientsDetailsProps {
  composition: SubProduct[];
  anchor?: string;
  /** Phase 9 i18n — libellés de colonnes ingrédients localisés. Défaut FR. */
  ingredientLabels?: IngredientsTableLabels;
  /** Phase 9 i18n — libellé « Voir le pack » localisé. Défaut FR. */
  postCtaLabel?: string;
  /**
   * Slot media résolu côté serveur — affiché en bandeau d'illustration au-
   * dessus de la table (4:3, doux). Optionnel.
   */
  mediaSlot?: ReactNode;
  /**
   * Phase 7E — en-tête localisé (kicker/title/description). Défaut FR si
   * absent — préserve les usages legacy et les tests rendus sans header.
   */
  header?: { kicker: string; title: string; description: string };
}

const DEFAULT_INGREDIENTS_HEADER = {
  kicker: 'Le détail',
  title: 'La composition lue ligne par ligne.',
  description:
    'Tout est dit : noms d’usage, INCI, fonction, origine, concentration. Pas d’angle mort, pas de promesse cachée derrière une formule.',
};

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
  header = DEFAULT_INGREDIENTS_HEADER,
  ingredientLabels,
  postCtaLabel,
}: IngredientsDetailsProps) {
  return (
    <section
      id={anchor}
      aria-labelledby="ingredients-title"
      className="bg-creme-warm py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-12 max-w-2xl space-y-4">
          <Kicker>{header.kicker}</Kicker>
          <Heading id="ingredients-title" as="h2" size="display-sm">
            {header.title}
          </Heading>
          <Text size="body" tone="secondary" prose>
            {header.description}
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
              {...(ingredientLabels ? { ingredientLabels } : {})}
              {...(postCtaLabel ? { postCtaLabel } : {})}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
