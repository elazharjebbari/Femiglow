'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import type { ContentPost } from '@/lib/content-studio/types';

export interface UseCalendarDnDOptions {
  posts: ContentPost[];
  /**
   * Endpoint used to persist the new `scheduledAt`. Defaults to the
   * existing reschedule route. Exposed so tests can override.
   */
  endpoint?: (postId: string) => string;
  /**
   * Used by tests to inject a mock fetch.
   */
  fetcher?: typeof fetch;
  /**
   * Called when DB write succeeds — typically `router.refresh()`.
   */
  onPersistSuccess?: (post: ContentPost) => void;
}

interface UseCalendarDnDResult {
  posts: ContentPost[];
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  handleDragCancel: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Day key parsing — expects droppable id of shape `day:YYYY-MM-DD`.
 * Returns the target Date (midnight local).
 */
export function parseDropDayId(rawId: string): Date | null {
  if (!rawId.startsWith('day:')) return null;
  const [year, month, day] = rawId.slice(4).split('-').map((s) => Number.parseInt(s, 10));
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns the new `scheduledAt` ISO string for a post when dropped on
 * a target day. The original time-of-day is preserved; if the post had
 * no schedule we default to 10:00 local.
 */
export function computeNewScheduledAt(
  currentScheduledAt: Date | string | null,
  targetDay: Date,
): string {
  const next = new Date(targetDay);
  if (currentScheduledAt) {
    const prev = currentScheduledAt instanceof Date ? currentScheduledAt : new Date(currentScheduledAt);
    if (!Number.isNaN(prev.getTime())) {
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    } else {
      next.setHours(10, 0, 0, 0);
    }
  } else {
    next.setHours(10, 0, 0, 0);
  }
  return next.toISOString();
}

function signaturesFor(posts: ContentPost[]): string {
  return posts
    .map((p) => `${p.id}:${p.scheduledAt ? new Date(p.scheduledAt).getTime() : 0}:${p.status}`)
    .join('|');
}

export function isPastDay(target: Date, now: Date = new Date()): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime() - DAY_MS + 1; // strictly before yesterday is past; same-day allowed
}

export function useCalendarDnD({
  posts,
  endpoint = (id) => `/api/admin/content-studio/posts/${id}/reschedule`,
  fetcher = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined,
  onPersistSuccess,
}: UseCalendarDnDOptions): UseCalendarDnDResult & { posts: ContentPost[] } {
  const [localPosts, setLocalPosts] = useState<ContentPost[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastSignatureRef = useRef<string>(signaturesFor(posts));

  // Re-sync if parent re-fetches (e.g. router.refresh). We compare by a
  // shallow signature (id + scheduledAt) so a new array reference with
  // identical content does not cause an infinite render loop when the
  // parent re-renders.
  useEffect(() => {
    const sig = signaturesFor(posts);
    if (sig !== lastSignatureRef.current) {
      lastSignatureRef.current = sig;
      setLocalPosts(posts);
    }
  }, [posts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;
      const activeIdRaw = String(active.id);
      const overIdRaw = String(over.id);
      if (!activeIdRaw.startsWith('post:')) return;
      const postId = activeIdRaw.slice(5);
      const targetDay = parseDropDayId(overIdRaw);
      if (!targetDay) return;

      if (isPastDay(targetDay)) {
        toast.error('Impossible de reprogrammer dans le passé.');
        return;
      }

      const before = localPosts.find((p) => p.id === postId);
      if (!before) return;
      const newScheduledAt = computeNewScheduledAt(before.scheduledAt, targetDay);

      // Same-day drop = no-op
      if (
        before.scheduledAt &&
        new Date(before.scheduledAt).toDateString() === targetDay.toDateString()
      ) {
        return;
      }

      // Optimistic update
      const optimistic: ContentPost = {
        ...before,
        scheduledAt: new Date(newScheduledAt),
        status: before.status === 'approved' ? 'scheduled' : before.status,
      };
      setLocalPosts((prev) => prev.map((p) => (p.id === postId ? optimistic : p)));

      if (!fetcher) {
        toast.error('Reprogrammation indisponible (réseau).');
        setLocalPosts((prev) => prev.map((p) => (p.id === postId ? before : p)));
        return;
      }

      try {
        const res = await fetcher(endpoint(postId), {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scheduledAt: newScheduledAt }),
        });
        if (!res.ok) {
          throw new Error(`http_${res.status}`);
        }
        const json = (await res.json().catch(() => null)) as { post?: ContentPost } | null;
        toast.success('Post reprogrammé.');
        if (json?.post) onPersistSuccess?.(json.post);
        else onPersistSuccess?.(optimistic);
      } catch (err) {
        toast.error(
          err instanceof Error ? `Échec de reprogrammation : ${err.message}` : 'Échec de reprogrammation.',
        );
        setLocalPosts((prev) => prev.map((p) => (p.id === postId ? before : p)));
      }
    },
    [endpoint, fetcher, localPosts, onPersistSuccess],
  );

  return {
    posts: localPosts,
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
