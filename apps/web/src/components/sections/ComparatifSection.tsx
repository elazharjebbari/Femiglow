import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { ComparatifTable } from '@/components/commerce/ComparatifTable';
import type { KitComparatif } from '@/lib/schemas';

interface ComparatifSectionProps {
  data: KitComparatif;
  /**
   * Trois slots média (base, fortifiant, lime) résolus côté serveur. Affichés
   * au-dessus de la table en triptyque, dans l'ordre lexico des keys.
   */
  productMediaSlots?: ReactNode[];
}

export function ComparatifSection({ data, productMediaSlots }: ComparatifSectionProps) {
  return (
    <section
      aria-labelledby="comparatif-title"
      className="bg-ciel-soft py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-10 max-w-2xl space-y-4">
          <Kicker>Comparatif</Kicker>
          <Heading id="comparatif-title" as="h2" size="display-sm">
            Vernis classique et rituel FemiGlow.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Sans dénigrer, deux approches différentes. À chacune sa place dans
            une vie, à chacune ses contraintes. Lisez à voix haute&#x202f;:
            chaque ligne se tient.
          </Text>
        </div>
        {productMediaSlots && productMediaSlots.length > 0 && (
          <ul
            aria-label="Triptyque produit"
            role="list"
            className="mb-12 grid grid-cols-3 gap-4 sm:gap-6"
          >
            {productMediaSlots.map((slot, i) => (
              <li key={i} className="aspect-square overflow-hidden rounded-md bg-creme">
                {slot}
              </li>
            ))}
          </ul>
        )}
        <ComparatifTable data={data} />
      </Container>
    </section>
  );
}
