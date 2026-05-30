import type { Matiere } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { MatiereCard } from './MatiereCard';

interface MatieresGridProps {
  matieres: Matiere[];
  /**
   * Phase 7E — en-tête localisé (kicker/title). Défaut FR si absent —
   * préserve les usages legacy et les tests qui rendent sans header.
   */
  header?: { kicker: string; title: string };
  /** Phase 9 i18n — libellés des termes (Origine/Pourquoi). Défaut FR. */
  labels?: { origine: string; pourquoi: string };
}

const DEFAULT_MATIERES_HEADER = {
  kicker: 'Les matières',
  title: 'Quatre matières, choisies une à une.',
};

export function MatieresGrid({
  matieres,
  header = DEFAULT_MATIERES_HEADER,
  labels,
}: MatieresGridProps) {
  return (
    <section className="bg-creme-warm py-16 sm:py-24">
      <Container width="page">
        <div className="mb-12 flex flex-col gap-3 sm:max-w-[60ch]">
          <Kicker tone="champagne">{header.kicker}</Kicker>
          <Heading as="h2" size="display-md" italic="auto" balance>
            {header.title}
          </Heading>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          {matieres.map((m) => (
            <li key={m.id}>
              <MatiereCard matiere={m} {...(labels ? { labels } : {})} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
