import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Image } from '@/components/ui/Image';
import { Reveal } from '@/components/patterns/Reveal';
import { Text } from '@/components/ui/Text';
import { CompositionCard } from '@/components/kit/CompositionCard';
import type { KitExplodedView, SubProduct } from '@/lib/schemas';

interface CompositionRevealProps {
  items: SubProduct[];
  ingredientsAnchor?: string;
  /**
   * Slots media résolus côté serveur (Component-Media), indexés par
   * `subProduct.id`. Si présent pour un id donné, remplace l'image SVG du CMS.
   * Typiquement fourni par `CompositionRevealBound`.
   */
  mediaSlots?: Record<string, ReactNode>;
  /**
   * Vue éclatée annotée du kit, optionnelle. Rendue avant la grille
   * de cards (Kolenda §4.3 — pédagogie d'ensemble).
   */
  explodedView?: KitExplodedView;
}

export function CompositionReveal({
  items,
  ingredientsAnchor = 'ingredients-details',
  mediaSlots,
  explodedView,
}: CompositionRevealProps) {
  const cols =
    items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <section
      aria-labelledby="composition-title"
      // Fond sable Kolenda §4.3 : rupture de rythme avec le Hero (crème) et
      // la vidéo (crème) qui l'entourent. Annexe A — `#EFE9DD`.
      className="bg-[#EFE9DD] py-16 sm:py-24"
    >
      <Container width="wide">
        <div className="mb-10 max-w-2xl space-y-4">
          <Kicker>La composition</Kicker>
          <Heading id="composition-title" as="h2" size="display-sm">
            Trois objets, trois gestes.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Le kit tient dans une main. Chaque pièce a sa place dans le geste,
            sa place sur la table de chevet, sa place dans la saison.
          </Text>
        </div>
        {/* Vue éclatée annotée — optionnelle, ne rend rien si absente du CMS.
            Kolenda §4.3 : « plan d'ensemble » qui prépare la lecture des 3
            cards. Format paysage, fond sable cohérent avec la section. */}
        {explodedView ? (
          <Reveal direction="up" distance={12} duration={0.6}>
            <figure
              className="mb-12 lg:mb-16"
              data-testid="composition-exploded-view"
            >
              <Image
                src={explodedView.src}
                alt={explodedView.alt}
                width={explodedView.width}
                height={explodedView.height}
                ratio="16:9"
                sizes="(min-width: 1024px) 70vw, 100vw"
              />
            </figure>
          </Reveal>
        ) : null}

        <ul
          role="list"
          className={`grid grid-cols-1 gap-10 sm:grid-cols-2 ${cols} sm:gap-12`}
        >
          {items.map((item, index) => (
            <li key={item.id}>
              {/* Reveal Kolenda §2.4 / Luxury §18 : fade + translateY 16 →
                  0 sur 600 ms, stagger 120 ms entre cards. Respecte
                  prefers-reduced-motion via useReducedMotion (le wrapper
                  Reveal rend alors un <div> simple). */}
              <Reveal direction="up" distance={16} delay={index * 120}>
                <CompositionCard
                  subProduct={item}
                  index={index}
                  detailsHref={`#${ingredientsAnchor}-${item.id}`}
                  mediaSlot={mediaSlots?.[item.id]}
                />
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
