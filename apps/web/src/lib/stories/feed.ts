import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import type { Story, StoryFeed, StorySegment, StorySource } from './types';

type I18nMap = Record<string, string> | null | undefined;

/** Résout une valeur i18n jsonb avec fallback locale par défaut → 1ʳᵉ valeur. */
export function pickI18n(map: I18nMap, locale: Locale): string | undefined {
  if (!map || typeof map !== 'object') return undefined;
  return (
    map[locale] ??
    map[DEFAULT_LOCALE] ??
    Object.values(map).find((v) => typeof v === 'string' && v.length > 0)
  );
}

function buildSources(videoUrl: string, webmUrl: string | null): StorySource[] {
  const sources: StorySource[] = [];
  // webm d'abord (meilleure compression), mp4 en fallback universel.
  if (webmUrl) sources.push({ url: webmUrl, mime: 'video/webm' });
  sources.push({ url: videoUrl, mime: 'video/mp4' });
  return sources;
}

/**
 * Feed des stories actives d'un `pageGroup`, ordonnées, déjà localisées.
 * Retourne `{ stories: [] }` en mode mémoire (pas de DB) ou si aucune story —
 * le composant se masque alors sans régression.
 */
export async function getStoriesFeed(
  locale: Locale = DEFAULT_LOCALE,
  pageGroup = 'kit',
): Promise<StoryFeed> {
  const drizzle = db();
  if (!drizzle) return { stories: [] };

  const storyRows = await drizzle
    .select()
    .from(schema.mediaStory)
    .where(
      and(
        eq(schema.mediaStory.pageGroup, pageGroup),
        eq(schema.mediaStory.isActive, true),
      ),
    )
    .orderBy(asc(schema.mediaStory.displayOrder));

  if (storyRows.length === 0) return { stories: [] };

  const storyIds = storyRows.map((s) => s.id);
  const segmentRows = await drizzle
    .select()
    .from(schema.mediaStorySegment)
    .where(
      and(
        inArray(schema.mediaStorySegment.storyId, storyIds),
        eq(schema.mediaStorySegment.isActive, true),
      ),
    )
    .orderBy(asc(schema.mediaStorySegment.displayOrder));

  const segmentsByStory = new Map<string, StorySegment[]>();
  for (const row of segmentRows) {
    const seg: StorySegment = {
      id: row.id,
      sources: buildSources(row.videoUrl, row.webmUrl),
      poster: row.posterUrl,
      durationMs: row.durationMs,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      caption: pickI18n(row.captionI18n as I18nMap, locale),
    };
    const ctaLabel = pickI18n(row.ctaLabelI18n as I18nMap, locale);
    if (ctaLabel && row.ctaTarget) {
      seg.cta = { label: ctaLabel, target: row.ctaTarget };
    }
    const list = segmentsByStory.get(row.storyId) ?? [];
    list.push(seg);
    segmentsByStory.set(row.storyId, list);
  }

  const stories: Story[] = storyRows
    .map((s): Story => ({
      id: s.id,
      slug: s.slug,
      title: pickI18n(s.titleI18n as I18nMap, locale) ?? s.slug,
      bubblePoster: s.bubblePosterUrl,
      accent: s.accent ?? undefined,
      segments: segmentsByStory.get(s.id) ?? [],
    }))
    // une story sans segment actif n'a rien à montrer.
    .filter((s) => s.segments.length > 0);

  return { stories };
}
