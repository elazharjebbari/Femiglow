import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { FAQAccordion } from '@/components/commerce/FAQAccordion';
import type { FAQItem } from '@/lib/schemas';

interface FAQContextuelleProps {
  items: FAQItem[];
}

export function FAQContextuelle({ items }: FAQContextuelleProps) {
  return (
    <section
      aria-labelledby="faq-title"
      className="bg-creme py-16 sm:py-24"
    >
      <Container width="content">
        <div className="mb-8 max-w-2xl space-y-4">
          <Kicker>Questions</Kicker>
          <Heading id="faq-title" as="h2" size="display-sm">
            Les questions qu’on nous pose.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Les réponses sont courtes, précises, vérifiables. Si une question
            manque, écrivez-nous&#x202f;: nous l’ajouterons.
          </Text>
        </div>
        <FAQAccordion items={items} />
      </Container>
    </section>
  );
}
