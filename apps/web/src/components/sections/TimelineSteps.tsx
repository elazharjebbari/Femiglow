import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';

const steps = [
  {
    title: 'Préparation',
    hint: 'Sous 24 h, à la main, à Casablanca.',
    state: 'active',
  },
  {
    title: 'Expédition',
    hint: '1 à 2 jours ouvrés après la préparation.',
    state: 'pending',
  },
  {
    title: 'Livraison',
    hint: '3 à 5 jours ouvrés au Maroc.',
    state: 'pending',
  },
] as const;

export function TimelineSteps() {
  return (
    <section
      aria-labelledby="timeline-heading"
      className="border-b border-encre/10 py-16"
    >
      <Container width="content">
        <div className="space-y-8 text-center">
          <Kicker>Suivi de votre kit</Kicker>
          <Heading as="h2" id="timeline-heading" size="md">
            Trois étapes, à votre rythme.
          </Heading>
        </div>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-12">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col items-center gap-3 text-center"
            >
              <StepIcon kind={step.title} active={step.state === 'active'} />
              <span className="text-xs uppercase tracking-[0.18em] text-encre/50">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3
                className={
                  step.state === 'active'
                    ? 'font-display text-xl text-encre'
                    : 'font-display text-xl text-encre/30'
                }
              >
                {step.title}
              </h3>
              <p
                className={
                  step.state === 'active'
                    ? 'text-sm text-encre/70'
                    : 'text-sm text-encre/40'
                }
              >
                {step.hint}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function StepIcon({
  kind,
  active,
}: {
  kind: (typeof steps)[number]['title'];
  active: boolean;
}) {
  const className = active ? 'text-encre' : 'text-encre/30';
  if (kind === 'Préparation') {
    return (
      <svg
        aria-hidden="true"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="6" y="10" width="20" height="14" rx="1" />
        <path d="M10 10V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" />
        <path d="M11 16h10M11 19h6" />
      </svg>
    );
  }
  if (kind === 'Expédition') {
    return (
      <svg
        aria-hidden="true"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M3 8h13v14H3z" />
        <path d="M16 12h7l4 4v6h-11" />
        <circle cx="9" cy="24" r="2" />
        <circle cx="22" cy="24" r="2" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 28c-6-6-9-10-9-14a9 9 0 0 1 18 0c0 4-3 8-9 14z" />
      <circle cx="16" cy="14" r="3" />
    </svg>
  );
}
