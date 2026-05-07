import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';

export function PreparationGesture() {
  return (
    <section
      aria-labelledby="preparation-gesture-heading"
      className="border-b border-encre/10 py-16 sm:py-20"
    >
      <Container width="content">
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div
            aria-hidden="true"
            className="aspect-[4/5] w-full bg-creme-warm/60"
            style={{
              backgroundImage:
                'radial-gradient(120% 80% at 30% 20%, rgba(200,168,118,0.18), transparent 60%), radial-gradient(80% 60% at 70% 80%, rgba(197,219,196,0.18), transparent 60%)',
            }}
          />
          <div className="space-y-5">
            <Kicker>Préparation au geste</Kicker>
            <Heading as="h2" id="preparation-gesture-heading" size="md">
              Choisissez un soir calme.
            </Heading>
            <p className="text-base leading-[1.7] text-encre/80">
              Posez les pots sur une serviette de lin. Allumez peu de
              lumière. Ouvrez le rituel comme on ouvre une lettre — sans
              hâte, sans intention de productivité.
            </p>
            <p className="text-sm text-encre/60">
              La maison ne propose pas une routine. Elle propose un moment
              suspendu, qui appartient à vos mains.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
