import type { ReactNode } from 'react';
import type { Hero as HeroData } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Image } from '@/components/ui/Image';
import { ButtonLink } from '@/components/ui/ButtonLink';

interface HeroProps {
  data: HeroData;
  priority?: boolean;
  /**
   * Slot media déjà résolu côté serveur (ex : ComponentMedia) qui remplace
   * `data.image`. Permet de garder Hero synchrone et testable en vitest.
   */
  mediaSlot?: ReactNode;
}

export function Hero({ data, priority = true, mediaSlot }: HeroProps) {

  return (
    <section className="relative overflow-hidden bg-creme-warm">
      <HeroDecoration />
      <Container width="page" className="relative">
        <div className="grid items-center gap-12 py-20 sm:py-24 lg:min-h-[92vh] lg:grid-cols-[6fr_5fr] lg:gap-16 lg:py-28">
          <div className="space-y-7">
            {data.kicker && (
              <Kicker tone="champagne" withRule>
                {data.kicker}
              </Kicker>
            )}
            <Heading as="h1" size="display-xl" italic="never">
              {data.title}
            </Heading>
            {data.subtitle && (
              <Text size="lead" tone="secondary" prose>
                {data.subtitle}
              </Text>
            )}
            {(data.cta || data.ctaSecondary) && (
              <div className="flex flex-wrap items-center gap-5 pt-3">
                {data.cta && (
                  <ButtonLink href={data.cta.href} variant={data.cta.variant} size="lg">
                    {data.cta.label}
                  </ButtonLink>
                )}
                {data.ctaSecondary && (
                  <ButtonLink
                    href={data.ctaSecondary.href}
                    variant={data.ctaSecondary.variant}
                    size="md"
                  >
                    {data.ctaSecondary.label}
                  </ButtonLink>
                )}
              </div>
            )}
          </div>
          {mediaSlot ? (
            <div className="relative">{mediaSlot}</div>
          ) : (
            data.image && (
              <div className="relative">
                <Image
                  src={data.image.src}
                  alt={data.image.alt}
                  width={data.image.width}
                  height={data.image.height}
                  ratio="4:5"
                  priority={priority}
                  sizes="(min-width: 1024px) 45vw, 100vw"
                />
              </div>
            )
          )}
        </div>
      </Container>
    </section>
  );
}

function HeroDecoration() {
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
    >
      <defs>
        <linearGradient id="hero-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="text-sauge-dark">
        <path
          d="M-100 720 C 240 640, 520 800, 820 700 S 1340 580, 1600 660"
          fill="none"
          stroke="url(#hero-wave)"
          strokeWidth="1"
        />
        <path
          d="M-100 760 C 280 680, 540 820, 860 740 S 1360 620, 1600 700"
          fill="none"
          stroke="url(#hero-wave)"
          strokeWidth="0.75"
        />
      </g>
      <g className="text-champagne-dark" transform="translate(1180 120)">
        <path
          d="M0 60 C -40 30, -40 -10, 0 -40 C 40 -10, 40 30, 0 60 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}
