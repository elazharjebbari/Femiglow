import type { Engagement } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { EngagementCard } from './EngagementCard';

interface EngagementsGridProps {
  engagements: Engagement[];
  /**
   * Phase 7 wiring — en-tête localisé (kicker/title). Défaut FR si absent —
   * préserve les usages legacy `(marketing)/maison` et les tests qui rendent
   * sans header. Mirror de `MatieresGrid`.
   */
  header?: { kicker: string; title: string };
}

const DEFAULT_ENGAGEMENTS_HEADER = {
  kicker: 'Les six engagements',
  title: 'Six lignes qui ne bougent pas.',
};

export function EngagementsGrid({
  engagements,
  header = DEFAULT_ENGAGEMENTS_HEADER,
}: EngagementsGridProps) {
  const ordered = [...engagements].sort((a, b) => a.ordre - b.ordre);
  return (
    <section className="bg-creme py-16 sm:py-24">
      <Container width="page">
        <div className="mb-12 flex flex-col gap-3 sm:max-w-[60ch]">
          <Kicker tone="champagne">{header.kicker}</Kicker>
          <Heading as="h2" size="display-md" italic="auto" balance>
            {header.title}
          </Heading>
        </div>
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-4">
          {ordered.map((e) => (
            <li key={e.ordre}>
              <EngagementCard engagement={e} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
