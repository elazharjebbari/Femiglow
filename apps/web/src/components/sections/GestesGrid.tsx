import type { GesteEtape } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Reveal } from '@/components/patterns';

interface GestesGridProps {
  kicker?: string;
  title?: string;
  etapes: GesteEtape[];
}

export function GestesGrid({
  kicker = 'Le rituel',
  title = 'Cinq gestes, cinq minutes.',
  etapes,
}: GestesGridProps) {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="gestes-grid-title">
      <Container width="wide">
        <header className="mb-14 max-w-prose space-y-3 sm:mb-16">
          <Kicker tone="champagne" withRule>
            {kicker}
          </Kicker>
          <Heading as="h2" size="display-md" italic="always" id="gestes-grid-title">
            {title}
          </Heading>
        </header>
        <ol className="grid gap-y-12 gap-x-8 sm:grid-cols-2 lg:grid-cols-5">
          {etapes.map((etape, index) => (
            <li key={etape.ordre}>
              <Reveal delay={index * 60} direction="up" className="group space-y-3">
                <span className="block font-display text-5xl font-medium text-encre/25 transition-colors duration-base group-hover:text-encre/60">
                  {String(etape.ordre).padStart(2, '0')}
                </span>
                <Heading as="h3" size="sm">
                  {etape.titre}
                </Heading>
                <Kicker tone="champagne">{etape.duree}</Kicker>
                <Text size="small" tone="secondary">
                  {etape.description}
                </Text>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
