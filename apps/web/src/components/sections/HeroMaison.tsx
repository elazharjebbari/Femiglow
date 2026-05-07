import type { ReactNode } from 'react';
import type { Hero as HeroData } from '@/lib/schemas';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

interface HeroMaisonProps {
  data: HeroData;
  /**
   * Slot media full-bleed (résolu côté serveur). Affiché en fond sous une
   * voile crème pour préserver la lisibilité du titre. Optionnel.
   */
  mediaSlot?: ReactNode;
}

export function HeroMaison({ data, mediaSlot }: HeroMaisonProps) {
  // Sur mobile l'image full-bleed est sombre (le flacon ambré domine le cadre
  // étroit) : on superpose un voile encre + on passe la typo en crème pour
  // garantir le contraste. Sur sm+ l'image laisse plus de place aux clairs,
  // donc on revient au voile crème et à la typo encre habituels.
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-creme via-creme-warm to-champagne/30">
      {mediaSlot && (
        <>
          <div className="absolute inset-0">{mediaSlot}</div>
          {/* Voile mobile : dégradé encre → laisse l'image sombre transparaître,
              renforce la lisibilité de la typo crème.
              NOTE: on passe en arbitrary `rgba()` car nos couleurs Tailwind
              (`encre`, `creme`) sont définies en `var(--color-x)` avec un
              hex direct — le modifier `/opacity` ne se compile alors pas
              (Tailwind v3 attend des CSS vars en canaux `<r> <g> <b>`). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(44,42,40,0.6),rgba(44,42,40,0.35),rgba(44,42,40,0.1))] sm:hidden"
          />
          {/* Voile desktop : crème opaque 70 %, comportement historique du hero. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden bg-[rgba(251,248,241,0.7)] sm:block"
          />
        </>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-10 opacity-20 sm:right-16 sm:top-16"
      >
        <Fleuron size="lg" tone="champagne" />
      </div>
      <Container width="page" className="relative">
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 py-24 text-center sm:py-32 lg:min-h-[92vh]">
          {data.kicker ? (
            <Kicker tone="champagne" withRule>
              {data.kicker}
            </Kicker>
          ) : null}
          <Heading
            as="h1"
            size="display-xl"
            italic="auto"
            balance
            // `cn()` ne fait pas de tailwind-merge : pour que `text-creme`
            // (mobile, sur image sombre) gagne contre `text-encre` injecté
            // par le `tone="default"` du Heading, on force avec `!`.
            className={
              mediaSlot
                ? 'max-w-[18ch] !text-creme drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] sm:!text-encre sm:drop-shadow-none'
                : 'max-w-[18ch]'
            }
          >
            {data.title}
          </Heading>
          {data.subtitle ? (
            <Text
              size="lead"
              tone={mediaSlot ? 'on-dark' : 'secondary'}
              prose
              className={
                mediaSlot
                  ? // NB: on utilise des arbitrary `rgba()` plutôt que
                    // `!text-creme/90` / `!text-encre/70` car nos couleurs
                    // Tailwind sont des `var(--color-x)` en hex direct, ce
                    // qui empêche le modifier d'opacité de compiler.
                    'max-w-[42ch] !text-[rgba(251,248,241,0.92)] drop-shadow-[0_1px_6px_rgba(0,0,0,0.25)] sm:!text-[rgba(44,42,40,0.7)] sm:drop-shadow-none'
                  : 'max-w-[42ch]'
              }
            >
              {data.subtitle}
            </Text>
          ) : null}
          {data.cta ? (
            <div className="pt-2">
              <ButtonLink href={data.cta.href} variant={data.cta.variant} size="md">
                {data.cta.label}
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
