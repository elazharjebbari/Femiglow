import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface OrderHeroProps {
  firstName: string;
  orderId: string;
  estimateMin: string;
  estimateMax: string;
}

export function OrderHero({
  firstName,
  orderId,
  estimateMin,
  estimateMax,
}: OrderHeroProps) {
  return (
    <section
      aria-labelledby="order-hero-heading"
      className="border-b border-encre/10 py-16 sm:py-20"
    >
      <Container width="prose">
        <div className="space-y-6 text-center">
          <Fleuron tone="champagne" size="lg" />
          <Kicker>La maison vous remercie</Kicker>
          <Heading
            as="h1"
            id="order-hero-heading"
            size="display-md"
          >
            Merci, {firstName}.
          </Heading>
          <Text size="lead" tone="secondary" prose as="p">
            Votre commande est en bonnes mains. Vous recevrez un email de
            confirmation dans la minute, puis un second au moment de
            l&rsquo;envoi.
          </Text>

          <div className="space-y-3 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-encre/60">
              Numéro de commande
            </p>
            <p className="font-display text-xl text-encre">{orderId}</p>
            <DottedRule />
            <p className="text-sm text-encre/70">
              Estimation de livraison : entre le {estimateMin} et le{' '}
              {estimateMax}.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function DottedRule() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto block h-px w-20"
      style={{
        backgroundImage:
          'radial-gradient(circle, var(--color-sauge-dark) 0.6px, transparent 0.6px)',
        backgroundSize: '5px 1px',
        backgroundRepeat: 'repeat-x',
      }}
    />
  );
}
