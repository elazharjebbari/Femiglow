import type { ReactNode } from 'react';
import type { Testimonial } from '@/lib/schemas';
import { Image } from '@/components/ui/Image';
import { Text } from '@/components/ui/Text';

interface TestimonialCardProps {
  testimonial: Testimonial;
  /**
   * Slot media déjà résolu côté serveur (ex : ComponentMedia) qui remplace
   * `testimonial.handImage`. Permet de garder TestimonialCard synchrone et
   * testable en vitest.
   */
  mediaSlot?: ReactNode;
}

export function TestimonialCard({ testimonial, mediaSlot }: TestimonialCardProps) {
  const { authorFirstName, authorContext, quote, handImage, initieeDepuis } = testimonial;
  return (
    <figure className="flex flex-col items-center gap-6 text-center">
      {mediaSlot ? (
        <div className="w-full max-w-[280px]">{mediaSlot}</div>
      ) : (
        handImage && (
          <Image
            src={handImage.src}
            alt={handImage.alt}
            width={handImage.width}
            height={handImage.height}
            ratio="4:5"
            rounded
            sizes="(min-width: 1024px) 320px, (min-width: 720px) 40vw, 80vw"
            className="w-full max-w-[280px]"
          />
        )
      )}
      <blockquote className="max-w-prose">
        <Text size="lead" italic family="display" balance>
          «&#8239;{quote}&#8239;»
        </Text>
      </blockquote>
      <figcaption className="space-y-1">
        <Text size="caption" tone="secondary">
          {authorFirstName}
          {authorContext ? `, ${authorContext}` : ''}
        </Text>
        {initieeDepuis && (
          <Text size="small" tone="tertiary" italic family="display">
            Initiée depuis {initieeDepuis}
          </Text>
        )}
      </figcaption>
    </figure>
  );
}
