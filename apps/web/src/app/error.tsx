'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Phase 2 : Sentry.captureException(error)
    console.error('[error.tsx]', error);
  }, [error]);

  return (
    <section className="min-h-[70vh] py-20 flex items-center">
      <Container width="prose">
        <article className="space-y-6 text-center">
          <Kicker>Désolés</Kicker>
          <Heading as="h1" size="display-md">
            Quelque chose s’est interrompu.
          </Heading>
          <Text size="lead" tone="secondary" prose>
            La maison enregistre l’incident. Vous pouvez recharger la page, ou revenir à
            l’accueil — votre panier reste enregistré.
          </Text>
          {error.digest && (
            <Text size="caption" tone="tertiary">
              Référence : {error.digest}
            </Text>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Button variant="primary" size="lg" onClick={reset}>
              Recharger la page
            </Button>
            <Link href={routes.home}>
              <Button variant="link" size="lg">
                Retour à l’accueil
              </Button>
            </Link>
          </div>
        </article>
      </Container>
    </section>
  );
}
