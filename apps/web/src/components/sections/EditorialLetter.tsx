import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Kicker } from '@/components/ui/Kicker';

interface EditorialLetterProps {
  firstName?: string;
}

export function EditorialLetter({ firstName }: EditorialLetterProps) {
  const opening = firstName
    ? `${firstName}, merci d\u2019avoir confié votre rituel à la maison.`
    : 'Merci d\u2019avoir confié votre rituel à la maison.';

  return (
    <section
      aria-labelledby="editorial-letter-heading"
      className="border-b border-encre/10 bg-creme-warm/40 py-20"
    >
      <Container width="prose">
        <div className="space-y-6 text-center">
          <Fleuron tone="champagne" size="md" />
          <Kicker>Un mot de Salma</Kicker>
          <h2
            id="editorial-letter-heading"
            className="font-display text-2xl text-encre [text-wrap:balance]"
          >
            La maison prend le temps qu&rsquo;il faut.
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-[640px] space-y-5 text-justify font-display text-[15px] leading-[1.75] text-encre/85">
          <p className="first-letter:font-display first-letter:text-3xl first-letter:font-medium first-letter:text-encre">
            {opening} Chaque kit est préparé à la main, à Casablanca, dans un
            atelier où l&rsquo;on prend le temps. Vous recevrez votre commande
            dans quelques jours.
          </p>
          <p>
            En l&rsquo;attente, choisissez un soir calme. Posez les pots sur une
            serviette de lin. Le rituel n&rsquo;aime pas la précipitation —
            c&rsquo;est là sa promesse.
          </p>
          <p>
            Si une question vous traverse, écrivez-nous. La maison répond.
          </p>
        </div>

        <div className="mt-10 text-center">
          <p
            className="text-3xl text-encre"
            style={{ fontFamily: 'var(--font-pinyon), cursive' }}
          >
            Salma
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-encre/50">
            Fondatrice
          </p>
        </div>
      </Container>
    </section>
  );
}
