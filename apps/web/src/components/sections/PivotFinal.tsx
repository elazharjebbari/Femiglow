import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { AddToCartButton } from '@/components/commerce/AddToCartButton';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import { routes } from '@/lib/routes';
import type { Product } from '@/lib/schemas';

interface PivotFinalProps {
  product: Product;
  /**
   * Phase 7E — locale active. Résout `marketing.kit.pivot_final` (FR/AR/EN).
   * Défaut FR si absent (legacy / tests). Composant rendu uniquement dans le
   * layout v1 (server component), d'où l'async sans risque côté client.
   */
  locale?: Locale;
}

export async function PivotFinal({ product, locale }: PivotFinalProps) {
  const t = await getTranslations({
    locale: locale ?? DEFAULT_LOCALE,
    namespace: 'marketing.kit',
  });
  return (
    <section
      aria-labelledby="pivot-final-title"
      className="bg-sauge-soft py-20 sm:py-28"
    >
      <Container width="content">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <Kicker>{t('pivot_final.kicker')}</Kicker>
          <Heading id="pivot-final-title" as="h2" size="display-md">
            {t('pivot_final.title')}
          </Heading>
          <Text size="lead" tone="secondary" prose className="mx-auto">
            {t('pivot_final.body')}
          </Text>
          <div className="mx-auto max-w-sm space-y-3 pt-4">
            <AddToCartButton product={product} size="lg" fullWidth>
              {t('hero.cta_commander')}
            </AddToCartButton>
            <Link
              href={routes.rituel}
              className="inline-flex items-center gap-1 text-sm tracking-tight text-encre underline-offset-4 hover:underline"
            >
              {t('pivot_final.cta_secondary')} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
