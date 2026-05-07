import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Fleuron } from '@/components/ui/Fleuron';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

export function EmptyCartState() {
  return (
    <section
      aria-labelledby="empty-cart-heading"
      className="py-20 sm:py-28"
    >
      <Container width="prose">
        <div className="space-y-6 text-center">
          <Fleuron tone="champagne" size="lg" />
          <Heading
            as="h2"
            size="display-sm"
            id="empty-cart-heading"
            italic="auto"
            className="font-display"
          >
            Le panier est vide.
          </Heading>
          <Text size="lead" tone="secondary" balance>
            Le rituel commence par un geste. Trois pots, cinq minutes.
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href={routes.rituel}>
              <Button variant="primary" size="lg">
                D{'\u00E9'}couvrir le rituel
              </Button>
            </Link>
            <Link href={routes.kit}>
              <Button variant="link" size="md">
                Voir le kit
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
