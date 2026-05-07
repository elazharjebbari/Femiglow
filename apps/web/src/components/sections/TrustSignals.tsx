import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Kicker } from '@/components/ui/Kicker';

interface Signal {
  id: string;
  title: string;
  body: string;
  icon: 'truck' | 'rotate' | 'shield';
}

const signals: Signal[] = [
  {
    id: 'livraison',
    title: 'Livraison Casablanca',
    body: 'En main propre sous 24 \u00E0 48\u202Fheures. Reste du Maroc, 3 \u00E0 5\u202Fjours.',
    icon: 'truck',
  },
  {
    id: 'retour',
    title: 'Retour 14\u202Fjours',
    body: 'Si le rituel ne vous va pas, nous reprenons. Aucune justification \u00E0 fournir.',
    icon: 'rotate',
  },
  {
    id: 'paiement',
    title: 'Paiement s\u00E9curis\u00E9',
    body: 'CMI Maroc, Stripe, ou paiement \u00E0 la livraison. Aucune donn\u00E9e bancaire stock\u00E9e.',
    icon: 'shield',
  },
];

function Icon({ name }: { name: Signal['icon'] }) {
  const common = {
    width: 32,
    height: 32,
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'text-encre/60',
  };
  if (name === 'truck') {
    return (
      <svg {...common}>
        <path d="M3 8h14v12H3z" />
        <path d="M17 12h6l4 4v4h-10" />
        <circle cx="9" cy="22" r="2.5" />
        <circle cx="22" cy="22" r="2.5" />
      </svg>
    );
  }
  if (name === 'rotate') {
    return (
      <svg {...common}>
        <path d="M5 16a11 11 0 0 1 19-7.5" />
        <path d="M24 4v5h-5" />
        <path d="M27 16a11 11 0 0 1-19 7.5" />
        <path d="M8 28v-5h5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M16 4 6 8v6c0 6 4.5 11 10 14 5.5-3 10-8 10-14V8z" />
      <path d="m12 16 3 3 5-6" />
    </svg>
  );
}

export function TrustSignals() {
  return (
    <section
      aria-labelledby="trust-signals-heading"
      className="border-t border-encre/10 bg-creme py-16 sm:py-20"
    >
      <Container width="page">
        <div className="max-w-prose space-y-3">
          <Kicker>R{'\u00E9'}assurance</Kicker>
          <Heading
            as="h2"
            size="display-sm"
            id="trust-signals-heading"
            className="font-display"
          >
            Trois engagements simples.
          </Heading>
        </div>
        <ul className="mt-12 grid gap-10 sm:grid-cols-3">
          {signals.map((signal) => (
            <li key={signal.id} className="space-y-3">
              <Icon name={signal.icon} />
              <Heading as="h3" size="sm" className="font-display">
                {signal.title}
              </Heading>
              <Text size="body" tone="secondary">
                {signal.body}
              </Text>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
