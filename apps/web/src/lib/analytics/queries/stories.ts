/**
 * Analytics des Stories vidéo — funnel par `story_id`.
 *
 * Lit `tracking_events_log` (consent granted, fenêtre temporelle), agrège par
 * story : opens (story_open) → views (story_view, niveau segment) → completes
 * (story_complete) → CTA. NB : `story_cta_click` est NORMALISÉ en `cta_click`
 * à l'ingestion (payload.story_id conservé) → on compte les `cta_click`
 * porteurs d'un `story_id`.
 *
 * Dual-mode : SQL paramétré si DATABASE_URL, sinon memoryStore (dev/test).
 * cf. docs/stories-video-2026-08-21/.
 */
import { sql } from 'drizzle-orm';

import { db, memoryStore } from '@/lib/db/client';

const STORY_EVENTS = ['story_open', 'story_view', 'story_complete', 'cta_click'] as const;
const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60_000;

export interface StoryFunnelRow {
  storyId: string;
  opens: number;
  views: number;
  completes: number;
  ctaClicks: number;
  /** completes / opens. */
  completionRate: number | null;
  /** ctaClicks / opens. */
  ctr: number | null;
}

export interface StoriesAnalytics {
  rows: StoryFunnelRow[];
  totals: Omit<StoryFunnelRow, 'storyId'>;
}

interface RawEvent {
  eventName: string;
  payload: Record<string, unknown>;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
}

async function fetchStoryEvents(from: Date, to: Date): Promise<RawEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.execute(
      sql`SELECT event_name, payload
          FROM tracking_events_log
          WHERE received_at >= ${from.toISOString()}
            AND received_at < ${to.toISOString()}
            AND consent_snapshot->>'analytics_storage' = 'granted'
            AND event_name IN ('story_open','story_view','story_complete','cta_click')`,
    );
    return (rows as unknown as Record<string, unknown>[]).map((r) => ({
      eventName: String(r.event_name),
      payload: parsePayload(r.payload),
    }));
  }
  const store = memoryStore();
  const set = new Set<string>(STORY_EVENTS);
  return Array.from(store.trackingEventsLog.values())
    .filter(
      (e) =>
        e.receivedAt >= from &&
        e.receivedAt < to &&
        e.consentSnapshot?.analytics_storage === 'granted' &&
        set.has(e.eventName),
    )
    .map((e) => ({ eventName: e.eventName, payload: parsePayload(e.payload) }));
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

/**
 * Agrégation PURE du funnel (testable sans DB) : compte par `story_id`.
 * `cta_click` sans `story_id` (ex. pack) est ignoré.
 */
export function aggregateStoryFunnel(events: RawEvent[]): StoriesAnalytics {
  const acc = new Map<string, { opens: number; views: number; completes: number; ctaClicks: number }>();
  const bump = (storyId: string, key: 'opens' | 'views' | 'completes' | 'ctaClicks') => {
    const row = acc.get(storyId) ?? { opens: 0, views: 0, completes: 0, ctaClicks: 0 };
    row[key] += 1;
    acc.set(storyId, row);
  };

  for (const e of events) {
    const storyId = typeof e.payload.story_id === 'string' ? e.payload.story_id : null;
    if (!storyId) continue; // un cta_click sans story_id (ex. pack) est ignoré
    switch (e.eventName) {
      case 'story_open':
        bump(storyId, 'opens');
        break;
      case 'story_view':
        bump(storyId, 'views');
        break;
      case 'story_complete':
        bump(storyId, 'completes');
        break;
      case 'cta_click':
        bump(storyId, 'ctaClicks');
        break;
    }
  }

  const rows: StoryFunnelRow[] = [...acc.entries()]
    .map(([storyId, r]) => ({
      storyId,
      ...r,
      completionRate: ratio(r.completes, r.opens),
      ctr: ratio(r.ctaClicks, r.opens),
    }))
    .sort((a, b) => b.opens - a.opens);

  const sum = rows.reduce(
    (t, r) => ({
      opens: t.opens + r.opens,
      views: t.views + r.views,
      completes: t.completes + r.completes,
      ctaClicks: t.ctaClicks + r.ctaClicks,
    }),
    { opens: 0, views: 0, completes: 0, ctaClicks: 0 },
  );

  return {
    rows,
    totals: {
      ...sum,
      completionRate: ratio(sum.completes, sum.opens),
      ctr: ratio(sum.ctaClicks, sum.opens),
    },
  };
}

export async function getStoriesAnalytics(opts?: {
  from?: Date;
  to?: Date;
}): Promise<StoriesAnalytics> {
  const to = opts?.to ?? new Date();
  const from = opts?.from ?? new Date(to.getTime() - DEFAULT_WINDOW_MS);
  return aggregateStoryFunnel(await fetchStoryEvents(from, to));
}
