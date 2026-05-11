/**
 * Seed initial des Rituels partagés.
 * Insère 3 témoignages factices `featured = true` pour amorcer le module compact
 * de /kit et le drawer du wall avant les premières soumissions réelles.
 *
 * Cf. docs/reviews-wall/execution/00-runbook.md § Phase 1.12.
 *
 * Usage : pnpm --filter @femiglow/web tsx scripts/seed-rituals.ts
 */
/* eslint-disable no-console */
import { insertRitual, refreshRitualAggregate } from '@/lib/db/queries/rituals';

const PRODUCT_KEY = 'pack-femiglow';

const fixtures = [
  {
    body:
      "Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer. Je remarque que les cuticules ont apaisé doucement.",
    wouldRecommend: 'oui' as const,
    ritualTags: ['ongles-plus-lisses', 'plus-de-casse'],
    authorFirstName: 'Amal',
    authorCity: 'Rabat',
    initiatedSince: '2026-02',
  },
  {
    body:
      'Cinq minutes le soir, devenu un rituel agréable. Je le fais avec ma tisane après le travail. La main respire entre deux journées denses.',
    wouldRecommend: 'oui' as const,
    ritualTags: ['rituel-devenu-habitude', 'mains-detendues'],
    authorFirstName: 'Yasmine',
    authorCity: 'Rabat',
    initiatedSince: '2024-03',
  },
  {
    body:
      "La paste donne un fini qui me ressemble. Naturel, sans vernis. Cela faisait des années que je cherchais ce rendu simple, lisible, sobre.",
    wouldRecommend: 'oui' as const,
    ritualTags: ['eclat-naturel', 'fini-brillant'],
    authorFirstName: 'Inès',
    authorCity: 'Marrakech',
    initiatedSince: '2023-10',
  },
];

async function main() {
  console.log('[seed-rituals] insertion de 3 témoignages...');
  for (const fixture of fixtures) {
    const ritual = await insertRitual({
      ...fixture,
      productKey: PRODUCT_KEY,
      bodyOriginal: fixture.body,
      source: 'manual',
      status: 'APPROVED',
      featured: true,
      publishedAt: new Date(),
    });
    console.log(`  ✓ ${ritual.publicSlug} — ${fixture.authorFirstName}`);
  }

  console.log('[seed-rituals] refresh aggregate...');
  const agg = await refreshRitualAggregate(PRODUCT_KEY);
  console.log(
    `  ✓ aggregate : ${agg.totalCount} approuvés · ${agg.ouiCount} oui · top tags : ${agg.topTags.map((t) => t.tag).join(', ')}`,
  );
  console.log('[seed-rituals] terminé');
}

main().catch((err) => {
  console.error('[seed-rituals] échec', err);
  process.exit(1);
});
