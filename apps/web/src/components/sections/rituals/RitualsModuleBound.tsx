import { Suspense } from 'react';
import { getRitualSummary, listRituals } from '@/lib/db/queries/rituals';
import { RitualsModule } from './RitualsModule';
import { RitualsModuleSkeleton } from './RitualsModuleSkeleton';
import type { RitualTestimonialPublic } from '@/lib/schemas/rituals';

/**
 * Server component qui fetch summary + 3 featured cards.
 * Fallback si < 3 featured : compléter par les plus récents avec photo.
 * Si total < 1 → render empty state via RitualsModule (option de retrait amont).
 *
 * Cf. docs/reviews-wall/execution/05-frontend-plan-action.md § 5
 */
async function RitualsModuleResolver({ productKey }: { productKey: string }) {
  const [summary, featuredList] = await Promise.all([
    getRitualSummary(productKey),
    listRituals({
      productKey,
      featured: true,
      sort: 'recommended',
      limit: 3,
    }),
  ]);

  let cards: RitualTestimonialPublic[] = featuredList.items;
  if (cards.length < 3) {
    const fallback = await listRituals({
      productKey,
      withPhotos: true,
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
      sort: 'recent',
      limit: 3 - cards.length,
    });
    const existing = new Set(cards.map((c) => c.publicSlug));
    cards = [
      ...cards,
      ...recents.items.filter((c) => !existing.has(c.publicSlug)),
    ];
  }

  return <RitualsModule summary={summary} cards={cards.slice(0, 3)} />;
}

export function RitualsModuleBound({ productKey }: { productKey: string }) {
  return (
    <Suspense fallback={<RitualsModuleSkeleton />}>
      <RitualsModuleResolver productKey={productKey} />
    </Suspense>
  );
}
