import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Fleuron } from '@/components/ui/Fleuron';
import { RitualCard } from './RitualCard';
import type {
  RitualSummary,
  RitualTestimonialPublic,
} from '@/lib/schemas/rituals';

interface RitualsModuleProps {
  summary: RitualSummary;
  cards: RitualTestimonialPublic[];
  topTags?: Array<{ tag: string; count: number }>;
  /** URL de bascule (par défaut : `?wall=open`). */
  wallHref?: string;
}

/**
 * Module compact « Les voix de la maison » inséré dans /kit.
 * Cf. docs/reviews-wall/execution/02-ui-ux-conception.md § 2.2
 *    docs/reviews-wall/07-proposition-finale.md § 4
 */
export function RitualsModule({
  summary,
  cards,
  topTags,
  wallHref = '?wall=open',
}: RitualsModuleProps) {
  if (summary.totalCount === 0 && cards.length === 0) {
    return (
      <section
        aria-labelledby="rituals-module-title"
        className="border-y border-encre/10 py-[var(--ritual-module-padding-block-mobile)] sm:py-[var(--ritual-module-padding-block)]"
      >
        <Container width="wide">
          <header className="mx-auto max-w-2xl space-y-3 text-center">
            <Kicker tone="champagne">LES VOIX DE LA MAISON</Kicker>
            <Heading as="h2" size="display-sm" italic="always" id="rituals-module-title">
              La maison écoute.
            </Heading>
            <p className="font-cormorant text-lg italic text-encre/80">
              Soyez la première à partager votre rituel.
            </p>
          </header>
        </Container>
      </section>
    );
  }

  const total = summary.totalCount || cards.length;
  const oui = summary.ouiCount;
  const headline =
    total === 1
      ? 'Une initiée a partagé son rituel. Elle le reprendrait.'
      : `${total} initiées ont partagé. ${oui} reprendraient le rituel.`;

  const tags = topTags ?? summary.topTags ?? [];
  const tagLine =
    tags.length > 0
      ? tags
          .slice(0, 3)
          .map((t) => t.tag.replace(/-/g, ' '))
          .join(' · ')
      : null;

  return (
    <section
      aria-labelledby="rituals-module-title"
      className="border-y border-encre/10 py-[var(--ritual-module-padding-block-mobile)] sm:py-[var(--ritual-module-padding-block)]"
    >
      <Container width="wide">
        <header className="mx-auto max-w-2xl space-y-3 text-center">
          <Kicker tone="champagne">LES VOIX DE LA MAISON</Kicker>
          <Heading
            as="h2"
            size="display-sm"
            italic="always"
            id="rituals-module-title"
          >
            {headline}
          </Heading>
          {tagLine && (
            <p className="font-inter text-xs text-encre/60">
              {tagLine}
            </p>
          )}
          <Fleuron size="sm" tone="champagne" />
        </header>

        <ul
          role="list"
          className="mx-auto mt-10 grid gap-[var(--ritual-module-grid-gap)] sm:mt-12 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cards.map((card) => (
            <li key={card.publicSlug} role="listitem">
              <RitualCard data={card} variant="compact" />
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center sm:mt-12">
          <Link
            href={wallHref}
            scroll={false}
            data-testid="rituals-module-link"
            className="inline-flex items-center gap-2 border-t border-sauge-dark/40 pt-2 font-inter text-sm font-medium text-encre transition-colors hover:text-sauge-dark"
          >
            Lire les {total} rituels partagés
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
