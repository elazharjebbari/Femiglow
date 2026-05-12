import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';

export function JournalHero() {
  return (
    <section className="bg-creme py-20 sm:py-28">
      <Container width="prose">
        <div className="flex flex-col items-center gap-6 text-center">
          <Fleuron size="md" />
          <Heading as="h1" size="display-md" italic="always" balance>
            Le carnet de la maison.
          </Heading>
          <Text size="lead" tone="secondary" className="max-w-prose">
            Une lettre par mois. Sur le rituel, les matières marocaines, l&rsquo;inspiration
            japonaise. Écrit à Rabat. Lent comme le geste.
          </Text>
        </div>
      </Container>
    </section>
  );
}
