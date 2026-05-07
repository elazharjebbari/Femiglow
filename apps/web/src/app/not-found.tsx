import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: 'La page que vous cherchez n’existe plus, ou pas encore.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="min-h-[70vh] py-20 flex items-center">
      <Container width="prose">
        <article className="space-y-6 text-center">
          <Kicker>404</Kicker>
          <Heading as="h1" size="display-md">
            La page reste introuvable.
          </Heading>
          <Text size="lead" tone="secondary" prose>
            Peut-être un lien ancien, peut-être un déplacement éditorial. Revenons à la maison
            ou parcourons le journal.
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link href={routes.home}>
              <Button variant="primary" size="lg">
                Retour à l’accueil
              </Button>
            </Link>
            <Link href={routes.journal}>
              <Button variant="link" size="lg">
                Lire le journal
              </Button>
            </Link>
          </div>
        </article>
      </Container>
    </section>
  );
}
