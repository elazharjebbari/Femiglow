/**
 * Seed des Stories vidéo `/kit` (docs/stories-video-2026-08-21/).
 *
 * Multi-segments : une story = une bulle + N clips enchaînés (barres de
 * progression segmentées, tap suivant/précédent). Source vidéo P1 = assets
 * self-hosted `public/stories/*.mp4` (servis par Next avec Range),
 * poster `public/stories/*.jpg`.
 *
 * Idempotent : ré-aligne par `slug` (delete + insert, cascade sur segments).
 * Exécution : `node --env-file=.env --import tsx scripts/seed-stories.ts`
 */
import { inArray } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';

type I18n = { fr: string; ar: string; en: string };

interface SeedSegment {
  video: number; // /stories/{n}.mp4
  durationMs: number;
  caption?: I18n;
}
interface SeedStory {
  slug: string;
  title: I18n;
  segments: SeedSegment[];
}

const CTA_LABEL: I18n = { fr: 'Commander le pack', ar: 'اطلبي الطقم', en: 'Order the pack' };
const CTA_TARGET = '#commander-femiglow';

// Durées sondées (ffprobe) des 6 vidéos.
const DUR: Record<number, number> = { 1: 39381, 2: 49018, 3: 44490, 4: 58143, 5: 50852, 6: 11774 };

const STORIES: SeedStory[] = [
  {
    slug: 'kit-4-gestes',
    title: { fr: 'Le rituel en 4 gestes', ar: 'الطقوس في 4 خطوات', en: 'The 4-step ritual' },
    segments: [
      { video: 1, durationMs: DUR[1]!, caption: { fr: 'Le geste 1', ar: 'الخطوة 1', en: 'Step 1' } },
      { video: 2, durationMs: DUR[2]!, caption: { fr: 'Le geste 2', ar: 'الخطوة 2', en: 'Step 2' } },
      { video: 3, durationMs: DUR[3]!, caption: { fr: 'Le geste 3', ar: 'الخطوة 3', en: 'Step 3' } },
    ],
  },
  {
    slug: 'kit-avant-apres',
    title: { fr: 'Avant / Après', ar: 'قبل / بعد', en: 'Before / After' },
    segments: [{ video: 4, durationMs: DUR[4]! }],
  },
  {
    slug: 'kit-temoignages',
    title: { fr: 'Témoignages', ar: 'شهادات', en: 'Testimonials' },
    segments: [{ video: 5, durationMs: DUR[5]! }],
  },
  {
    slug: 'kit-le-pack',
    title: { fr: 'Le pack FemiGlow', ar: 'طقم FemiGlow', en: 'The FemiGlow pack' },
    segments: [{ video: 6, durationMs: DUR[6]! }],
  },
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
    const bubblePoster = `/stories/${s.segments[0]!.video}.jpg`;
    await drizzle.insert(schema.mediaStory).values({
      id: storyId,
      slug: s.slug,
      pageGroup: 'kit',
      titleI18n: s.title,
      bubblePosterUrl: bubblePoster,
      displayOrder: i,
      isActive: true,
    });
    for (let j = 0; j < s.segments.length; j++) {
      const seg = s.segments[j]!;
      await drizzle.insert(schema.mediaStorySegment).values({
        id: createId('seg'),
        storyId,
        videoUrl: `/stories/${seg.video}.mp4`,
        posterUrl: `/stories/${seg.video}.jpg`,
        durationMs: seg.durationMs,
        width: 360,
        height: 640,
        captionI18n: seg.caption ?? {},
        ctaLabelI18n: CTA_LABEL,
        ctaTarget: CTA_TARGET,
        displayOrder: j,
        isActive: true,
      });
      segCount += 1;
    }
  }
  return { stories: STORIES.length, segments: segCount };
}

// Exécution directe.
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
