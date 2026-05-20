import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { ProductCard } from '@/components/commerce/ProductCard';
import type { SubProduct } from '@/lib/schemas';

interface CompositionRevealProps {
  items: SubProduct[];
  ingredientsAnchor?: string;
  /**
   * Slots media résolus côté serveur (Component-Media), indexés par
   * `subProduct.id`. Si présent pour un id donné, remplace l'image SVG du CMS.
   * Typiquement fourni par `CompositionRevealBound`.
   */
  mediaSlots?: Record<string, ReactNode>;
}

export function CompositionReveal({
  items,
  ingredientsAnchor = 'ingredients-details',
  mediaSlots,
}: CompositionRevealProps) {
  const cols =
    items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <section
      aria-labelledby="composition-title"
      // Fond sable Kolenda §4.3 : rupture de rythme avec le Hero (crème) et
      // la vidéo (crème) qui l'entourent. Annexe A — `#EFE9DD`.
      className="bg-[#EFE9DD] py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-10 max-w-2xl space-y-4">
          <Kicker>La composition</Kicker>
          <Heading id="composition-title" as="h2" size="display-sm">
            Trois objets, trois gestes.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Le kit tient dans une main. Chaque pièce a sa place dans le geste,
            sa place sur la table de chevet, sa place dans la saison.
          </Text>
        </div>
        <ul
          role="list"
          className={`grid grid-cols-1 gap-10 sm:grid-cols-2 ${cols} sm:gap-12`}
        >
          {items.map((item) => (
            <li key={item.id}>
              <ProductCard
                subProduct={item}
                detailsHref={`#${ingredientsAnchor}-${item.id}`}
                mediaSlot={mediaSlots?.[item.id]}
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
