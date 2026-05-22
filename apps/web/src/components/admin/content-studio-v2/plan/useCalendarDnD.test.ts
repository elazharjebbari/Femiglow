import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  computeNewScheduledAt,
  isPastDay,
  parseDropDayId,
  useCalendarDnD,
} from './useCalendarDnD';
import type { ContentPost } from '@/lib/content-studio/types';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Choose a fixed scheduledAt 30 days in the future relative to the test
 * run so the "past day" rejection scenario is reliable without fake
 * timers (vitest fake timers + microtasks-from-fetch were unstable).
 */
const FUTURE_OFFSET_DAYS = 30;

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function pastDate(daysFromNow: number): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - daysFromNow);
  return d;
}

function makePost(overrides: Partial<ContentPost> = {}): ContentPost {
  return {
    id: 'post_1',
    draftId: 'draft_1',
    status: 'scheduled',
    scheduledAt: futureDate(FUTURE_OFFSET_DAYS),
    publishedAt: null,
    utm: {},
    approvedBy: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-05-01T08:00:00Z'),
    updatedAt: new Date('2026-05-01T08:00:00Z'),
    ...overrides,
  };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('useCalendarDnD — pure helpers', () => {
  it('parseDropDayId — valid day id', () => {
    const d = parseDropDayId('day:2026-05-12');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(4);
    expect(d?.getDate()).toBe(12);
  });

  it('parseDropDayId — invalid prefix', () => {
    expect(parseDropDayId('post:abc')).toBeNull();
    expect(parseDropDayId('day:xx')).toBeNull();
  });

  it('computeNewScheduledAt — préserve heure et minute si elles existent', () => {
    const prev = new Date(2026, 4, 12, 14, 35, 0);
    const target = new Date(2026, 4, 20, 0, 0, 0);
    const iso = computeNewScheduledAt(prev, target);
    const next = new Date(iso);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(4);
    expect(next.getDate()).toBe(20);
    expect(next.getHours()).toBe(14);
    expect(next.getMinutes()).toBe(35);
  });

  it('computeNewScheduledAt — défaut 10h si aucune heure préalable', () => {
    const target = new Date(2026, 4, 20, 0, 0, 0);
    const iso = computeNewScheduledAt(null, target);
    const next = new Date(iso);
    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(0);
  });

  it('isPastDay — détecte les jours strictement passés', () => {
    const today = new Date(2026, 4, 15, 12, 0, 0);
    expect(isPastDay(new Date(2026, 4, 1), today)).toBe(true);
    expect(isPastDay(new Date(2026, 4, 15), today)).toBe(false);
    expect(isPastDay(new Date(2026, 4, 20), today)).toBe(false);
  });
});

describe('useCalendarDnD — handleDragEnd', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function dropEvent(postId: string, dKey: string): DragEndEvent {
    return {
      active: {
        id: `post:${postId}`,
        data: { current: {} },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: `day:${dKey}`,
        rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
        data: { current: {} },
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      collisions: null,
      activatorEvent: new Event('test'),
    } as unknown as DragEndEvent;
  }

  it('drop sur un futur jour → PATCH appelé avec nouveau scheduledAt et optimistic update', async () => {
    const post = makePost();
    const targetDate = futureDate(FUTURE_OFFSET_DAYS + 10);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ post: { ...post, scheduledAt: targetDate.toISOString() } }),
    });
    const onPersistSuccess = vi.fn();

    const { result } = renderHook(() =>
      useCalendarDnD({
        posts: [post],
        fetcher: fetcher as unknown as typeof fetch,
        onPersistSuccess,
      }),
    );

    await act(async () => {
      await result.current.handleDragEnd(dropEvent('post_1', dayKey(targetDate)));
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, opts] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/admin/content-studio/posts/post_1/reschedule');
    expect(opts.method).toBe('PATCH');
    const body = JSON.parse(opts.body as string);
    expect(body.scheduledAt).toBeTruthy();
    const next = new Date(body.scheduledAt);
    expect(next.getDate()).toBe(targetDate.getDate());
    expect(next.getMonth()).toBe(targetDate.getMonth());

    expect(onPersistSuccess).toHaveBeenCalledTimes(1);
    // Optimistic state — post reflects new date
    expect(result.current.posts[0]!.scheduledAt?.getDate()).toBe(targetDate.getDate());
  });

  it('drop sur jour passé → bloqué, pas de fetch', async () => {
    const post = makePost();
    const original = post.scheduledAt as Date;
    const fetcher = vi.fn();
    const { result } = renderHook(() =>
      useCalendarDnD({ posts: [post], fetcher: fetcher as unknown as typeof fetch }),
    );

    await act(async () => {
      await result.current.handleDragEnd(dropEvent('post_1', dayKey(pastDate(20))));
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.posts[0]!.scheduledAt?.getDate()).toBe(original.getDate());
  });

  it('rollback en cas d’erreur HTTP', async () => {
    const post = makePost();
    const original = post.scheduledAt as Date;
    const targetDate = futureDate(FUTURE_OFFSET_DAYS + 5);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const { result } = renderHook(() =>
      useCalendarDnD({ posts: [post], fetcher: fetcher as unknown as typeof fetch }),
    );

    await act(async () => {
      await result.current.handleDragEnd(dropEvent('post_1', dayKey(targetDate)));
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.posts[0]!.scheduledAt?.getDate()).toBe(original.getDate());
  });

  it('drop sur même jour → no-op (pas de fetch)', async () => {
    const post = makePost();
    const fetcher = vi.fn();
    const { result } = renderHook(() =>
      useCalendarDnD({ posts: [post], fetcher: fetcher as unknown as typeof fetch }),
    );

    await act(async () => {
      await result.current.handleDragEnd(dropEvent('post_1', dayKey(post.scheduledAt as Date)));
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
