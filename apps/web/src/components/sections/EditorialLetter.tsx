import localFont from 'next/font/local';
import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Kicker } from '@/components/ui/Kicker';

/**
 * Pinyon Script — police décorative utilisée UNIQUEMENT pour la signature de la
 * lettre éditoriale (cf. page /merci). On l'initialise ici, et non dans le root
 * layout, pour que `next/font` ne précharge le woff2 + n'injecte le `@font-face`
 * (CSS render-blocking) QUE sur les routes qui rendent ce composant. Les pages
 * publiques sans `EditorialLetter` (ex. /kit) n'embarquent donc plus Pinyon.
 * La variable `--font-pinyon` est scopée à la `<section>` ci-dessous.
 * cf. docs/image-optimization-audit-2026-06-01 (priorité 2 — dégraissage polices).
 */
const pinyon = localFont({
  src: '../../../public/fonts/pinyon-script.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-pinyon',
});

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
      className={`${pinyon.variable} border-b border-encre/10 bg-creme-warm/40 py-20`}
    >
      <Container width="prose">
        <div className="space-y-6 text-center">
          <Fleuron tone="champagne" size="md" />
          <Kicker>Un mot de notre fondatrice</Kicker>
          <h2
            id="editorial-letter-heading"
            className="font-display text-2xl text-encre [text-wrap:balance]"
          >
            La maison prend le temps qu&rsquo;il faut.
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-[640px] space-y-5 text-justify font-display text-[15px] leading-[1.75] text-encre/85">
          <p className="first-letter:font-display first-letter:text-3xl first-letter:font-medium first-letter:text-encre">
            {opening} Chaque pack est préparé à la main, à Rabat, dans un
            atelier où l&rsquo;on prend le temps. La paste prépare, la powder
            révèle, le polissoir lustre. L&rsquo;éclat reviendra doucement.
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
            notre fondatrice
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-encre/50">
            Fondatrice · FemiGlow
          </p>
        </div>
      </Container>
    </section>
  );
}
