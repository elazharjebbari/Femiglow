/**
 * `JournalHero` — bandeau d'accueil de la page `/journal`.
 *
 * Phase 7C (2026-05) — Architecture dual (sync + helper async) :
 *  - composant sync : strings injectés via prop, sinon FR legacy.
 *  - `getJournalHeroStringsForLocale(locale)` — helper exporté.
 *
 * @see docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A2
 */
import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import type { Locale } from '@/i18n.config';

export interface JournalHeroStrings {
  title: string;
  description: string;
}

interface JournalHeroProps {
  strings?: JournalHeroStrings;
}

const LEGACY_FR: JournalHeroStrings = {
  title: 'Le carnet de la maison.',
  description:
    'Une lettre par mois. Sur le rituel, les matières marocaines, l’inspiration japonaise. Écrit à Rabat. Lent comme le geste.',
};

export async function getJournalHeroStringsForLocale(
  locale: Locale,
): Promise<JournalHeroStrings> {
  const t = await getTranslations({
    locale,
    namespace: 'marketing.journal.hero',
  });
  return { title: t('title'), description: t('description') };
}

export function JournalHero({ strings = LEGACY_FR }: JournalHeroProps = {}) {
  return (
    <section className="bg-creme py-20 sm:py-28">
      <Container width="prose">
        <div className="flex flex-col items-center gap-6 text-center">
          <Fleuron size="md" />
          <Heading as="h1" size="display-md" italic="always" balance>
            {strings.title}
          </Heading>
          <Text size="lead" tone="secondary" className="max-w-prose">
            {strings.description}
          </Text>
        </div>
      </Container>
    </section>
  );
}
