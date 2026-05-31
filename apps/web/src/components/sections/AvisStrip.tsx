import { Fragment, type ReactNode } from 'react';
import type { Testimonial } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Fleuron } from '@/components/ui/Fleuron';
import { TestimonialCard } from './TestimonialCard';

interface AvisStripProps {
  testimonials: Testimonial[];
  kicker?: string;
  title?: string;
  /**
   * Map keyée par `testimonial.id` → media slot déjà résolu côté serveur
   * (ex : `<ComponentMedia>`). Si absent pour un id, fallback sur `handImage`.
   */
  mediaSlotsByTestimonialId?: Record<string, ReactNode>;
  /**
   * Formateur localisé du libellé « Initiée depuis {date} ». Reçoit la date
   * brute du testimonial et retourne le texte affiché. Phase 9bis — sans lui,
   * `TestimonialCard` retombe sur le préfixe FR hardcodé.
   */
  formatInitiee?: (date: string) => string;
}

export function AvisStrip({
  testimonials,
  kicker = 'Voix',
  title = 'Celles qui ont essayé.',
  mediaSlotsByTestimonialId,
  formatInitiee,
}: AvisStripProps) {
  if (testimonials.length === 0) return null;
  return (
    <section className="border-y border-encre/10 py-20 sm:py-24" aria-labelledby="avis-strip-title">
      <Container width="wide">
        <header className="mb-14 space-y-3 text-center sm:mb-16">
          <Kicker tone="champagne" className="mx-auto">
            {kicker}
          </Kicker>
          <Heading as="h2" size="display-sm" italic="always" id="avis-strip-title">
            {title}
          </Heading>
        </header>
        <ul className="grid items-start gap-y-14 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-x-10">
          {testimonials.map((t, index) => (
            <Fragment key={t.id}>
              <li className="flex justify-center">
                <TestimonialCard
                  testimonial={t}
                  mediaSlot={mediaSlotsByTestimonialId?.[t.id]}
                  initieeLabel={
                    t.initieeDepuis && formatInitiee
                      ? formatInitiee(t.initieeDepuis)
                      : undefined
                  }
                />
              </li>
              {index < testimonials.length - 1 && (
                <li
                  aria-hidden="true"
                  className="hidden self-center lg:block"
                >
                  <Fleuron size="sm" tone="champagne" />
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      </Container>
    </section>
  );
}
