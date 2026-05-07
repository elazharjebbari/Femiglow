import NextImage from 'next/image';
import type { ReactNode } from 'react';
import type { Hero as HeroData } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface HeroLifestyleProps {
  data: HeroData;
  priority?: boolean;
  /**
   * Slot media full-bleed déjà résolu côté serveur (ex : `<ComponentMedia>`)
   * qui remplace `data.image`. Doit gérer son propre `position: absolute` ou
   * `fill` — l'enveloppe le positionne en `absolute inset-0`.
   */
  mediaSlot?: ReactNode;
}

export function HeroLifestyle({ data, priority = true, mediaSlot }: HeroLifestyleProps) {
  return (
    <section
      aria-labelledby="hero-rituel-title"
      className="relative isolate overflow-hidden bg-encre min-h-[78vh] lg:min-h-[86vh] flex items-end"
    >
      {mediaSlot ? (
        <div className="absolute inset-0">{mediaSlot}</div>
      ) : (
        data.image && (
          <NextImage
            src={data.image.src}
            alt={data.image.alt}
            fill
            priority={priority}
            fetchPriority={priority ? 'high' : 'auto'}
            sizes="100vw"
            placeholder={data.image.blurDataURL ? 'blur' : 'empty'}
            blurDataURL={data.image.blurDataURL}
            className="object-cover object-center"
          />
        )
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-encre/0 via-encre/15 to-encre/65"
      />
      <Container width="page" className="relative z-10 pb-20 pt-32 lg:pb-28 lg:pt-40">
        <div className="max-w-2xl space-y-6 text-creme">
          {data.kicker && (
            <Kicker tone="on-dark" withRule>
              {data.kicker}
            </Kicker>
          )}
          <Heading
            id="hero-rituel-title"
            as="h1"
            size="display-lg"
            tone="on-dark"
            italic="never"
          >
            {data.title}
          </Heading>
          {data.subtitle && (
            <Text size="lead" tone="on-dark" className="opacity-90">
              {data.subtitle}
            </Text>
          )}
        </div>
      </Container>
    </section>
  );
}
