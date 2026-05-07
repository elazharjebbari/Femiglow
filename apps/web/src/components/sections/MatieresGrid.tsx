import type { Matiere } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { MatiereCard } from './MatiereCard';

interface MatieresGridProps {
  matieres: Matiere[];
}

export function MatieresGrid({ matieres }: MatieresGridProps) {
  return (
    <section className="bg-creme-warm py-16 sm:py-24">
      <Container width="page">
        <div className="mb-12 flex flex-col gap-3 sm:max-w-[60ch]">
          <Kicker tone="champagne">Les matières</Kicker>
          <Heading as="h2" size="display-md" italic="auto" balance>
            Quatre matières, choisies une à une.
          </Heading>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          {matieres.map((m) => (
            <li key={m.id}>
              <MatiereCard matiere={m} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
