import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getRitualSummary, listRituals } from '@/lib/db/queries/rituals';
import { RitualsModule } from './RitualsModule';
import { resolveRitualsModuleStrings } from './strings';
import { RitualsModuleSkeleton } from './RitualsModuleSkeleton';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import type { RitualTestimonialPublic } from '@/lib/schemas/rituals';

/**
 * Server component qui fetch summary + 3 featured cards.
 * Fallback si < 3 featured : compléter par les plus récents avec photo.
 * Si total < 1 → render empty state via RitualsModule (option de retrait amont).
 *
 * Cf. docs/reviews-wall/execution/05-frontend-plan-action.md § 5
 */
async function RitualsModuleResolver({
  productKey,
  locale,
}: {
  productKey: string;
  locale: Locale;
}) {
  // Phase 7E-11 — `Locale` ('fr'|'ar'|'en') correspond 1:1 à la langue éditoriale
  // des témoignages. On filtre par langue avec repli FR côté `listRituals`.
  const language = locale;
  const [summary, featuredList, t] = await Promise.all([
    getRitualSummary(productKey),
    listRituals({
      productKey,
      featured: true,
      language,
      sort: 'recommended',
      limit: 3,
    }),
    getTranslations({ locale, namespace: 'marketing.kit.rituals' }),
  ]);

  let cards: RitualTestimonialPublic[] = featuredList.items;
  if (cards.length < 3) {
    const fallback = await listRituals({
      productKey,
      withPhotos: true,
      language,
      sort: 'recommended',
      limit: 3 - cards.length,
    });
    const existing = new Set(cards.map((c) => c.publicSlug));
    cards = [
      ...cards,
      ...fallback.items.filter((c) => !existing.has(c.publicSlug)),
    ];
  }

  if (cards.length < 3) {
    const recents = await listRituals({
      productKey,
      language,
      sort: 'recent',
      limit: 3 - cards.length,
    });
    const existing = new Set(cards.map((c) => c.publicSlug));
    cards = [
      ...cards,
      ...recents.items.filter((c) => !existing.has(c.publicSlug)),
    ];
  }

  const strings = resolveRitualsModuleStrings(
    // next-intl interdit les clés dynamiques (`tag_labels.${slug}`) en strict ;
    // le runtime les résout sans souci (cf. strings.ts).
    t as unknown as Parameters<typeof resolveRitualsModuleStrings>[0],
  );

  return (
    <RitualsModule
      summary={summary}
      cards={cards.slice(0, 3)}
      strings={strings}
    />
  );
}

export function RitualsModuleBound({
  productKey,
  locale = DEFAULT_LOCALE,
}: {
  productKey: string;
  /** Phase 7 wiring — locale active. Défaut FR (usage legacy `(marketing)/kit`). */
  locale?: Locale;
}) {
  return (
    <Suspense fallback={<RitualsModuleSkeleton />}>
      <RitualsModuleResolver productKey={productKey} locale={locale} />
    </Suspense>
  );
}
