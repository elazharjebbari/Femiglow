import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { FAQAccordion } from '@/components/commerce/FAQAccordion';
import type { FAQItem } from '@/lib/schemas';

interface FAQContextuelleProps {
  items: FAQItem[];
  /**
   * Phase 7E — en-tête localisé (kicker/title/description). Défaut FR si
   * absent — préserve les usages legacy et les tests qui rendent sans header.
   */
  header?: { kicker: string; title: string; description: string };
}

const DEFAULT_FAQ_HEADER = {
  kicker: 'Questions',
  title: 'Les questions qu’on nous pose.',
  description:
    'Les réponses sont courtes, précises, vérifiables. Si une question manque, écrivez-nous : nous l’ajouterons.',
};

export function FAQContextuelle({
  items,
  header = DEFAULT_FAQ_HEADER,
}: FAQContextuelleProps) {
  return (
    <section
      aria-labelledby="faq-title"
      className="bg-creme py-16 sm:py-24"
    >
      <Container width="content">
        <div className="mb-8 max-w-2xl space-y-4">
          <Kicker>{header.kicker}</Kicker>
          <Heading id="faq-title" as="h2" size="display-sm">
            {header.title}
          </Heading>
          <Text size="body" tone="secondary" prose>
            {header.description}
          </Text>
        </div>
        <FAQAccordion items={items} />
      </Container>
    </section>
  );
}
