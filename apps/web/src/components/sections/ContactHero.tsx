import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface ContactHeroProps {
  email: string;
}

export function ContactHero({ email }: ContactHeroProps) {
  return (
    <section className="flex min-h-[40vh] items-center bg-creme py-16 sm:py-20">
      <Container width="prose">
        <div className="space-y-5">
          <Kicker>Écrire à la maison</Kicker>
          <Heading as="h1" size="display-md">
            Contact.
          </Heading>
          <Text size="lead" tone="secondary">
            Une question sur le rituel, le kit, une commande, un échange
            professionnel{'\u202F'}?
          </Text>
          <Text size="body" tone="default">
            <a
              href={`mailto:${email}`}
              className="underline decoration-encre/20 underline-offset-4 transition-colors duration-base hover:decoration-encre"
            >
              {email}
            </a>
          </Text>
        </div>
      </Container>
    </section>
  );
}
