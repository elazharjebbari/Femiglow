/**
 * Seed des Stories vidéo `/kit` (docs/stories-video-2026-08-21/).
 *
 * 6 stories (une par vidéo) → rail de 6 bulles scrollable horizontalement.
 * Source vidéo self-hosted `public/stories/*.mp4` + `.webm` (servis avec Range),
 * poster `public/stories/*.jpg`. Le modèle supporte le multi-segments (admin).
 *
 * Idempotent : ré-aligne par `slug` (delete + insert, cascade sur segments).
 * Exécution : `node --env-file=.env --import tsx scripts/seed-stories.ts`
 */
import { inArray } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';

type I18n = { fr: string; ar: string; en: string };

interface SeedStory {
  slug: string;
  title: I18n;
  video: number; // /stories/{n}.{mp4,webm,jpg}
  durationMs: number;
}

const CTA_LABEL: I18n = { fr: 'Commander le pack', ar: 'اطلبي الطقم', en: 'Order the pack' };
const CTA_TARGET = '#commander-femiglow';
const DUR: Record<number, number> = { 1: 39381, 2: 49018, 3: 44490, 4: 58143, 5: 50852, 6: 11774 };

const STORIES: SeedStory[] = [
  { slug: 'kit-rituel-soir', title: { fr: 'Le rituel du soir', ar: 'طقوس المساء', en: 'Evening ritual' }, video: 1, durationMs: DUR[1]! },
  { slug: 'kit-4-gestes', title: { fr: 'Les 4 gestes', ar: 'الخطوات الأربع', en: 'The 4 steps' }, video: 2, durationMs: DUR[2]! },
  { slug: 'kit-avant-apres', title: { fr: 'Avant / Après', ar: 'قبل / بعد', en: 'Before / After' }, video: 3, durationMs: DUR[3]! },
  { slug: 'kit-temoignage', title: { fr: 'Témoignage', ar: 'شهادة', en: 'Testimonial' }, video: 4, durationMs: DUR[4]! },
  { slug: 'kit-le-pack', title: { fr: 'Le pack FemiGlow', ar: 'طقم FemiGlow', en: 'The FemiGlow pack' }, video: 5, durationMs: DUR[5]! },
  { slug: 'kit-ingredients', title: { fr: 'Nos ingrédients', ar: 'مكوّناتنا', en: 'Our ingredients' }, video: 6, durationMs: DUR[6]! },
];

export async function runStoriesSeed(): Promise<{ stories: number; segments: number }> {
  const drizzle = db();
  if (!drizzle) {
    // eslint-disable-next-line no-console
    console.warn('[seed:stories] pas de DATABASE_URL — rien à faire (mode mémoire).');
    return { stories: 0, segments: 0 };
  }

  const slugs = STORIES.map((s) => s.slug);
  await drizzle.delete(schema.mediaStory).where(inArray(schema.mediaStory.slug, slugs));

  let segCount = 0;
  for (let i = 0; i < STORIES.length; i++) {
    const s = STORIES[i]!;
    const storyId = createId('sty');
    const poster = `/stories/${s.video}.jpg`;
    await drizzle.insert(schema.mediaStory).values({
      id: storyId,
      slug: s.slug,
      pageGroup: 'kit',
      titleI18n: s.title,
      bubblePosterUrl: poster,
      displayOrder: i,
      isActive: true,
    });
    await drizzle.insert(schema.mediaStorySegment).values({
      id: createId('seg'),
      storyId,
      videoUrl: `/stories/${s.video}.mp4`,
      webmUrl: `/stories/${s.video}.webm`,
      posterUrl: poster,
      durationMs: s.durationMs,
      width: 360,
      height: 640,
      captionI18n: {},
      ctaLabelI18n: CTA_LABEL,
      ctaTarget: CTA_TARGET,
      displayOrder: 0,
      isActive: true,
    });
    segCount += 1;
  }
  return { stories: STORIES.length, segments: segCount };
}

if (process.argv[1] && process.argv[1].endsWith('seed-stories.ts')) {
  runStoriesSeed()
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(`[seed:stories] stories=${r.stories} segments=${r.segments}`);
      process.exit(0);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[seed:stories] échec', e);
      process.exit(1);
    });
}
