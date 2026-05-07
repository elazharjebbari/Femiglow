import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { AddToCartButton } from '@/components/commerce/AddToCartButton';
import { routes } from '@/lib/routes';
import type { Product } from '@/lib/schemas';

interface PivotFinalProps {
  product: Product;
}

export function PivotFinal({ product }: PivotFinalProps) {
  return (
    <section
      aria-labelledby="pivot-final-title"
      className="bg-sauge-soft py-20 sm:py-28"
    >
      <Container width="content">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <Kicker>Le geste</Kicker>
          <Heading id="pivot-final-title" as="h2" size="display-md">
            Posez le geste.
          </Heading>
          <Text size="lead" tone="secondary" prose className="mx-auto">
            Le rituel commence quand vous le décidez. Cinq minutes le soir, une
            saison, et la plaque retrouve sa cadence.
          </Text>
          <div className="mx-auto max-w-sm space-y-3 pt-4">
            <AddToCartButton product={product} size="lg" fullWidth />
            <Link
              href={routes.rituel}
              className="inline-flex items-center gap-1 text-sm tracking-tight text-encre underline-offset-4 hover:underline"
            >
              Lire encore <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
