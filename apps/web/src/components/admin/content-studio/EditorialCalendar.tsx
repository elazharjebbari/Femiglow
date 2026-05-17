'use client';

import { useMemo, useState } from 'react';
import type { ContentDraft, ContentPost, ContentPostizDelivery, ContentPlatform, ContentStatus } from '@/lib/content-studio/types';
import { CONTENT_PLATFORMS, CONTENT_STATUSES } from '@/lib/content-studio/types';
import { SectionTitle } from './SectionTitle';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { formatShortDate } from './helpers';

type CalendarMode = 'week' | 'month';

const CALENDAR_STATUSES: ContentStatus[] = ['approved', 'scheduled', 'published', 'failed', 'cancelled'];
const ALL_PLATFORMS: ContentPlatform[] = [...CONTENT_PLATFORMS];
const ALL_STATUSES: ContentStatus[] = [...CALENDAR_STATUSES];

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, count: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

interface CalendarItem {
  post: ContentPost;
  draft: ContentDraft | undefined;
  latestDelivery: ContentPostizDelivery | null;
}

export function EditorialCalendar({
  posts,
  drafts,
  deliveries,
  onSelectDraft,
}: {
  posts: ContentPost[];
  drafts: ContentDraft[];
  deliveries: ContentPostizDelivery[];
  onSelectDraft?: (draftId: string) => void;
}) {
  const [mode, setMode] = useState<CalendarMode>('week');
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));

  const filteredItems = useMemo<CalendarItem[]>(() => {
    return posts
      .map((post) => {
        const draft = drafts.find((d) => d.id === post.draftId);
        const latestDelivery = deliveries.find((d) => d.postId === post.id) ?? null;
        return { post, draft, latestDelivery };
      })
      .filter((item) => {
        if (platformFilter !== 'all' && item.draft?.platform !== platformFilter) return false;
        if (statusFilter !== 'all' && item.post.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.post.scheduledAt ?? a.post.createdAt).getTime();
        const bTime = new Date(b.post.scheduledAt ?? b.post.createdAt).getTime();
        return aTime - bTime;
      });
  }, [posts, drafts, deliveries, platformFilter, statusFilter]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of filteredItems) {
      const date = toLocalDate(item.post.scheduledAt ?? item.post.createdAt);
      const key = formatDateKey(date);
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    return map;
  }, [filteredItems]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
  }, [cursor]);

  const monthDays = useMemo(() => {
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
  }, [cursor]);

  const days = mode === 'week' ? weekDays : monthDays;

  const navLabel =
    mode === 'week'
      ? `${formatShortDate(weekDays[0]!)} – ${formatShortDate(weekDays[6]!)}`
      : `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`;

  function navigate(direction: -1 | 1) {
    setCursor((prev) => {
      if (mode === 'week') return addDays(prev, 7 * direction);
      const m = prev.getMonth() + direction;
      return new Date(prev.getFullYear(), m, 1);
    });
  }

  function goToday() {
    setCursor(startOfWeek(new Date()));
  }

  const metrics = useMemo(() => {
    const approved = posts.filter((p) => p.status === 'approved').length;
    const scheduled = posts.filter((p) => p.status === 'scheduled').length;
    const sent = deliveries.filter((d) => d.status === 'sent').length;
    return { approved, scheduled, sent };
  }, [posts, deliveries]);

  return (
    <section className="rounded-md border border-teal-100 bg-teal-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          eyebrow="Calendrier"
          title="Pipeline éditorial"
          tone="teal"
          description="Suivre les posts validés, datés et envoyés à Postiz."
        />
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Approuvés" value={metrics.approved} />
          <Metric label="Planifiés" value={metrics.scheduled} />
          <Metric label="Postiz" value={metrics.sent} />
        </div>
      </div>

      {/* Toolbar: mode toggle, navigation, filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-teal-200 bg-white p-1">
          <button
            type="button"
            onClick={() => { setMode('week'); setCursor(startOfWeek(new Date())); }}
            className={`rounded px-3 py-1.5 text-xs font-medium ${mode === 'week' ? 'bg-teal-900 text-white' : 'text-teal-900 hover:bg-teal-50'}`}
          >
            Semaine
          </button>
          <button
            type="button"
            onClick={() => { setMode('month'); setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }}
            className={`rounded px-3 py-1.5 text-xs font-medium ${mode === 'month' ? 'bg-teal-900 text-white' : 'text-teal-900 hover:bg-teal-50'}`}
          >
            Mois
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigate(-1)} className="rounded border border-teal-200 bg-white px-2 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-50">
            ←
          </button>
          <button type="button" onClick={goToday} className="rounded border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-50">
            Auj.
          </button>
          <button type="button" onClick={() => navigate(1)} className="rounded border border-teal-200 bg-white px-2 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-50">
            →
          </button>
          <span className="ml-1 text-sm font-medium text-teal-900">{navLabel}</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')}
          className="rounded-md border border-teal-200 bg-white px-2 py-1.5 text-xs text-teal-900"
        >
          <option value="all">Tous statuts</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as ContentPlatform | 'all')}
          className="rounded-md border border-teal-200 bg-white px-2 py-1.5 text-xs text-teal-900"
        >
          <option value="all">Toutes plateformes</option>
          {ALL_PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Calendar grid */}
      <div className="mt-4 overflow-x-auto">
        {mode === 'week' ? (
          <div className="grid grid-cols-7 gap-px rounded border border-teal-200 bg-teal-200">
            {DAYS_FR.map((dayName) => (
              <div key={dayName} className="bg-teal-50 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-teal-800">
                {dayName}
              </div>
            ))}
            {weekDays.map((day) => {
              const key = formatDateKey(day);
              const dayItems = groupedByDay.get(key) ?? [];
              const isToday = isSameDay(day, new Date());
              return (
                <div key={key} className={`min-h-[120px] bg-white p-2 ${isToday ? 'ring-2 ring-inset ring-teal-500' : ''}`}>
                  <p className={`mb-1 text-xs font-medium ${isToday ? 'text-teal-900' : 'text-stone-500'}`}>
                    {day.getDate()}
                  </p>
                  {dayItems.length === 0 ? (
                    <p className="text-[10px] text-stone-400">Aucun post</p>
                  ) : (
                    <ul className="space-y-1">
                      {dayItems.map(({ post, draft, latestDelivery }) => (
                        <CalendarCard
                          key={post.id}
                          post={post}
                          draft={draft}
                          latestDelivery={latestDelivery}
                          onSelect={onSelectDraft}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px rounded border border-teal-200 bg-teal-200">
            {DAYS_FR.map((dayName) => (
              <div key={dayName} className="bg-teal-50 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                {dayName}
              </div>
            ))}
            {monthDays.map((day) => {
              const key = formatDateKey(day);
              const dayItems = groupedByDay.get(key) ?? [];
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = day.getMonth() === cursor.getMonth();
              return (
                <div key={key} className={`min-h-[80px] bg-white p-1 ${!isCurrentMonth ? 'bg-stone-50' : ''} ${isToday ? 'ring-2 ring-inset ring-teal-500' : ''}`}>
                  <p className={`mb-0.5 text-[10px] font-medium ${isToday ? 'text-teal-900' : isCurrentMonth ? 'text-stone-700' : 'text-stone-400'}`}>
                    {day.getDate()}
                  </p>
                  {dayItems.slice(0, 3).map(({ post, draft, latestDelivery }) => (
                    <MiniCalendarCard
                      key={post.id}
                      post={post}
                      draft={draft}
                      latestDelivery={latestDelivery}
                      onSelect={onSelectDraft}
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-[9px] text-stone-500">+{dayItems.length - 3} autres</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filteredItems.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">Aucun post ne correspond aux filtres sélectionnés.</p>
      )}
    </section>
  );
}

function CalendarCard({
  post,
  draft,
  latestDelivery,
  onSelect,
}: {
  post: ContentPost;
  draft: ContentDraft | undefined;
  latestDelivery: ContentPostizDelivery | null;
  onSelect?: (draftId: string) => void;
}) {
  const statusColor: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    scheduled: 'bg-sky-50 text-sky-800 border-sky-200',
    published: 'bg-teal-50 text-teal-800 border-teal-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
    cancelled: 'bg-stone-50 text-stone-600 border-stone-200',
  };
  const color = statusColor[post.status] ?? 'bg-stone-50 text-stone-600 border-stone-200';

  return (
    <li
      className={`cursor-pointer rounded border px-2 py-1.5 text-xs ${color}`}
      onClick={() => draft && onSelect?.(draft.id)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect && draft ? (e) => { if (e.key === 'Enter') onSelect(draft.id); } : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-medium">{draft?.hook ?? draft?.variantLabel ?? post.id.slice(0, 8)}</span>
        <DeliveryStatusBadge status={latestDelivery?.status ?? 'pending'} />
      </div>
      <p className="mt-0.5 text-[10px] opacity-75">
        {draft?.platform ?? 'social'} · {draft?.format ?? 'post'}
      </p>
      {post.scheduledAt && (
        <p className="mt-0.5 text-[10px] opacity-60">{formatShortDate(post.scheduledAt)}</p>
      )}
    </li>
  );
}

function MiniCalendarCard({
  post,
  draft,
  latestDelivery,
  onSelect,
}: {
  post: ContentPost;
  draft: ContentDraft | undefined;
  latestDelivery: ContentPostizDelivery | null;
  onSelect?: (draftId: string) => void;
}) {
  const statusDot: Record<string, string> = {
    approved: 'bg-emerald-500',
    scheduled: 'bg-sky-500',
    published: 'bg-teal-500',
    failed: 'bg-red-500',
    cancelled: 'bg-stone-400',
  };
  const dot = statusDot[post.status] ?? 'bg-stone-400';

  return (
    <div
      className="cursor-pointer truncate rounded px-1 py-0.5 text-[10px] hover:bg-teal-50"
      onClick={() => draft && onSelect?.(draft.id)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect && draft ? (e) => { if (e.key === 'Enter') onSelect(draft.id); } : undefined}
      title={`${draft?.hook ?? draft?.variantLabel ?? post.id} — ${post.status}${post.scheduledAt ? ` · ${formatShortDate(post.scheduledAt)}` : ''}`}
    >
      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {draft?.hook ?? draft?.variantLabel ?? post.id.slice(0, 8)}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-teal-100 bg-white px-3 py-2">
      <p className="text-base font-semibold text-teal-950">{value}</p>
      <p className="text-[11px] text-teal-800">{label}</p>
    </div>
  );
}