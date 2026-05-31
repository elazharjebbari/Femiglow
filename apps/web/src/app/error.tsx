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

/**
 * Détecte une ChunkLoadError (chunk JS hashé devenu obsolète après deploy).
 * Quand le navigateur a un HTML stale qui référence un `page-<hash>.js` qui
 * n'existe plus, nginx renvoie un 404 HTML que le browser refuse d'exécuter
 * (X-Content-Type-Options: nosniff). On force un hard-reload qui récupère
 * un HTML frais avec les bons hashes.
 */
function isChunkLoadError(err: Error): boolean {
  const name = err.name ?? '';
  const msg = err.message ?? '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk \d+ failed/.test(msg) ||
    /Loading CSS chunk/.test(msg) ||
    /Failed to fetch dynamically imported module/.test(msg)
  );
}

const RELOAD_FLAG_KEY = 'femiglow:chunk-reload-attempted';

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[error.tsx]', error);
    if (!isChunkLoadError(error)) return;
    // Évite la boucle infinie si le reload échoue lui aussi
    try {
      if (typeof window === 'undefined') return;
      const already = window.sessionStorage.getItem(RELOAD_FLAG_KEY);
      if (already) return;
      window.sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
      // Hard reload — bypass cache HTML pour récupérer les hashes courants
      window.location.reload();
    } catch {
      // sessionStorage indisponible (private mode) : on tente reset()
      reset();
    }
  }, [error, reset]);

  const chunkErr = isChunkLoadError(error);
  return (
    <section className="min-h-[70vh] py-20 flex items-center">
      <Container width="prose">
        <article className="space-y-6 text-center">
          <Kicker>Désolés</Kicker>
          <Heading as="h1" size="display-md">
            {chunkErr ? 'Mise à jour détectée.' : 'Quelque chose s’est interrompu.'}
          </Heading>
          <Text size="lead" tone="secondary" prose>
            {chunkErr
              ? 'Le site a été mis à jour depuis votre dernière visite. Rechargement automatique en cours…'
              : 'La maison enregistre l’incident. Vous pouvez recharger la page, ou revenir à l’accueil — votre panier reste enregistré.'}
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
