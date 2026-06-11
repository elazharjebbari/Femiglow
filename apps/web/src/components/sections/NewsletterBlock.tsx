import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import type { Locale } from '@/i18n.config';

const NewsletterForm = dynamic(
  () => import('@/components/forms/NewsletterForm').then((m) => m.NewsletterForm),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="h-[260px] w-full animate-pulse rounded-md bg-encre/5"
      />
    ),
  },
);

interface NewsletterBlockProps {
  source?: string;
  kicker?: string;
  title?: string;
  description?: string;
}

/**
 * Phase 7E — résout les strings éditoriaux localisés du bloc newsletter
 * depuis `marketing.common.newsletter_block`. À appeler dans la page
 * parente (async, locale connue), puis injecter via les props `kicker`/
 * `title`/`description`. En FR, ces valeurs sont identiques aux défauts
 * hardcodés ci-dessous (zéro régression sur le legacy `(marketing)/*`).
 */
export async function getNewsletterBlockStringsForLocale(
  locale: Locale,
): Promise<{ kicker: string; title: string; description: string }> {
  const t = await getTranslations({
    locale,
    namespace: 'marketing.common.newsletter_block',
  });
  return {
    kicker: t('kicker'),
    title: t('title'),
    description: t('description'),
  };
}

export function NewsletterBlock({
  source = 'home-bottom',
  kicker = 'Lettre de la maison',
  title = 'Une lettre par saison.',
  description = 'Quatre fois par an, une lettre brève sur les gestes, les matières et la lumière de la maison. Aucun envoi commercial.',
}: NewsletterBlockProps) {
  return (
    <section className="bg-sauge-soft/40 py-20 sm:py-28" aria-labelledby="newsletter-block-title">
      <Container width="content">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <Kicker tone="sauge" withRule>
              {kicker}
            </Kicker>
            <Heading
              as="h2"
              size="display-md"
              italic="always"
              id="newsletter-block-title"
            >
              {title}
            </Heading>
            <Text size="lead" tone="secondary" prose>
              {description}
            </Text>
          </div>
          <div>
            <NewsletterForm variant="block" source={source} />
          </div>
        </div>
      </Container>
    </section>
  );
}
