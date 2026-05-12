import { Container } from '@/components/ui/Container';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface DirectContactBlockProps {
  email: string;
  streetAddress: string;
  district: string;
}

export function DirectContactBlock({ email, streetAddress, district }: DirectContactBlockProps) {
  return (
    <section className="border-t border-encre/10 bg-creme py-16 sm:py-20">
      <Container width="content">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div className="space-y-3">
            <Kicker>Écrire</Kicker>
            <Text size="body" tone="default">
              <a
                href={`mailto:${email}?subject=Bonjour`}
                className="underline decoration-encre/20 underline-offset-4 transition-colors duration-base hover:decoration-encre"
              >
                {email}
              </a>
            </Text>
            <Text size="caption" tone="tertiary">
              Réponse sous 24 heures ouvrées, depuis Rabat.
            </Text>
          </div>
          <div className="space-y-3 border-t border-sauge pt-6 md:border-t-0 md:border-l md:pl-12 md:pt-0">
            <Kicker>Atelier</Kicker>
            <Text size="body" tone="default">
              {streetAddress}
              <br />
              {district}
            </Text>
            <Text size="caption" tone="tertiary">
              Sur rendez-vous.
            </Text>
          </div>
        </div>
      </Container>
    </section>
  );
}
