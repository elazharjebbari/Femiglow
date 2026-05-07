import type { ReactNode } from 'react';
import type { Image as ImageData } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { Image } from '@/components/ui/Image';
import { Reveal } from '@/components/patterns/Reveal';
import { cn } from '@/lib/utils/cn';

type NarrativeTone = 'creme' | 'sauge-soft' | 'sepia';

interface SectionNarrativeProps {
  id?: string;
  kicker: string;
  titre: string;
  paragraphes: string[];
  image: ImageData;
  imageSide?: 'left' | 'right';
  tone?: NarrativeTone;
  /**
   * Slot media déjà résolu côté serveur (`<ComponentMedia>`) qui remplace
   * `image`. Le filtre sépia (tone='sepia') reste appliqué via la classe
   * `[&>picture]:grayscale-[0.35]` sur le wrapper.
   */
  mediaSlot?: ReactNode;
}

export function SectionNarrative({
  id,
  kicker,
  titre,
  paragraphes,
  image,
  imageSide = 'right',
  tone = 'sepia',
  mediaSlot,
}: SectionNarrativeProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-20 lg:py-28',
        tone === 'sauge-soft' ? 'bg-sauge-soft' : 'bg-creme',
      )}
    >
      <Container width="page">
        <div
          className={cn(
            'grid items-center gap-10 lg:grid-cols-12 lg:gap-16',
            imageSide === 'left' && 'lg:[&>*:first-child]:order-2',
          )}
        >
          <div className="lg:col-span-7">
            <div className="max-w-prose space-y-6">
              <Reveal>
                <Kicker tone="champagne" withRule>
                  {kicker}
                </Kicker>
              </Reveal>
              <Reveal delay={80}>
                <Heading as="h2" size="display-md" italic="always">
                  {titre}
                </Heading>
              </Reveal>
              {paragraphes.map((paragraphe, i) => (
                <Reveal key={i} delay={160 + i * 80}>
                  <Text size="body" prose>
                    {paragraphe}
                  </Text>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            {mediaSlot ? (
              <div
                className={cn(
                  tone === 'sepia' &&
                    '[&>picture]:grayscale-[0.35] [&>picture]:sepia-[0.15]',
                )}
              >
                {mediaSlot}
              </div>
            ) : (
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                ratio="4:5"
                sizes="(min-width: 1024px) 40vw, 100vw"
                className={cn(tone === 'sepia' && 'grayscale-[0.35] sepia-[0.15]')}
              />
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
