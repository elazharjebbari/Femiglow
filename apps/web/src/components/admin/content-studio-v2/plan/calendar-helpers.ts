import type {
  ContentDraft,
  ContentPillar,
  ContentPlatform,
  ContentPost,
  ContentPostizDelivery,
  ContentStatus,
} from '@/lib/content-studio/types';
import type { CalendarItem, CalendarMediaEntry } from './types';

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday-first week (FR convention).
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, count: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toLocalDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

interface BuildItemsInput {
  posts: ContentPost[];
  drafts: ContentDraft[];
  deliveries: ContentPostizDelivery[];
  mediaByDraftId: Record<string, CalendarMediaEntry | undefined>;
  pillarByDraftId: Record<string, ContentPillar | undefined>;
  platformFilter: ContentPlatform | 'all';
  statusFilter: ContentStatus | 'all';
  pillarFilter: ContentPillar | 'all';
}

export function buildFilteredItems(input: BuildItemsInput): CalendarItem[] {
  const {
    posts,
    drafts,
    deliveries,
    mediaByDraftId,
    pillarByDraftId,
    platformFilter,
    statusFilter,
    pillarFilter,
  } = input;
  return posts
    .map<CalendarItem>((post) => {
      const draft = drafts.find((d) => d.id === post.draftId);
      const latestDelivery = deliveries.find((d) => d.postId === post.id) ?? null;
      const media = draft ? mediaByDraftId[draft.id] : undefined;
      const pillar = draft ? pillarByDraftId[draft.id] : undefined;
      return { post, draft, latestDelivery, media, pillar };
    })
    .filter((item) => {
      if (platformFilter !== 'all' && item.draft?.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && item.post.status !== statusFilter) return false;
      if (pillarFilter !== 'all' && item.pillar !== pillarFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.post.scheduledAt ?? a.post.createdAt).getTime();
      const bTime = new Date(b.post.scheduledAt ?? b.post.createdAt).getTime();
      return aTime - bTime;
    });
}

export function groupItemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const date = toLocalDate(item.post.scheduledAt ?? item.post.createdAt);
    const key = formatDateKey(date);
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }
  return map;
}

export function buildWeekDays(cursor: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
}

export function buildMonthDays(cursor: Date): Date[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = startOfWeek(firstDay);
  const days: Date[] = [];
  let current = startPad;
  while (current <= lastDay || days.length < 35) {
    days.push(current);
    current = addDays(current, 1);
    if (days.length >= 42) break;
  }
  return days;
}
