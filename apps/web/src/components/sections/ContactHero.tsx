/**
 * `ContactHero` — bandeau d'accueil de la page Contact.
 *
 * Phase 7C (2026-05) — Architecture **dual** pour i18n-aware sans casser le
 * mode legacy :
 *  - `<ContactHero email={…} />` — composant sync (legacy). Affiche les
 *    strings FR hardcodées. Utilisé par `(marketing)/contact/page.tsx` et
 *    par tous les tests vitest existants (axe + DOM check).
 *  - `<ContactHero email={…} strings={…} />` — sync, strings injectés par
 *    le parent. Permet à la page locale de pré-résoudre via
 *    `getTranslations` puis passer un objet plain — pas d'async dans la
 *    chaîne de rendu, donc compatible @testing-library.
 *  - `getContactHeroStringsForLocale(locale)` — helper async exporté à
 *    utiliser dans les pages `[locale]/contact/page.tsx`.
 *
 * Les clés `marketing.contact.hero.{kicker,title,subtitle}` existent déjà
 * dans `messages/{fr,ar,en}.json`. Aucune key à ajouter.
 *
 * @see docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A2
 */
import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import type { Locale } from '@/i18n.config';

export interface ContactHeroStrings {
  kicker: string;
  title: string;
  subtitle: string;
}

interface ContactHeroProps {
  email: string;
  /**
   * Strings éditoriaux pré-résolus. Si absent, les strings FR par défaut
   * sont utilisés (legacy `(marketing)/contact`). Pour la version
   * localisée, utiliser `getContactHeroStringsForLocale(locale)`.
   */
  strings?: ContactHeroStrings;
}

const LEGACY_STRINGS_FR: ContactHeroStrings = {
  kicker: 'Écrire à la maison',
  title: 'Contact.',
  subtitle:
    'Une question sur le rituel, le kit, une commande, un échange professionnel ?',
};

/**
 * Résout les strings depuis `messages/<locale>.json` namespace
 * `marketing.contact.hero`. À appeler dans la page parente, puis injecter
 * via la prop `strings`.
 */
export async function getContactHeroStringsForLocale(
  locale: Locale,
): Promise<ContactHeroStrings> {
  const t = await getTranslations({
    locale,
    namespace: 'marketing.contact.hero',
  });
  return {
    kicker: t('kicker'),
    title: t('title'),
    subtitle: t('subtitle'),
  };
}

export function ContactHero({ email, strings = LEGACY_STRINGS_FR }: ContactHeroProps) {
  return (
    <section className="flex min-h-[40vh] items-center bg-creme py-16 sm:py-20">
      <Container width="prose">
        <div className="space-y-5">
          <Kicker>{strings.kicker}</Kicker>
          <Heading as="h1" size="display-md">
            {strings.title}
          </Heading>
          <Text size="lead" tone="secondary">
            {strings.subtitle}
          </Text>
          <Text size="body" tone="default">
            <a
              href={`mailto:${email}`}
              className="underline decoration-encre/20 underline-offset-4 transition-colors duration-base hover:decoration-encre"
            >
              {email}
            </a>
          </Text>
        </div>
      </Container>
    </section>
  );
}
