'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import * as Tabs from '@radix-ui/react-tabs';
import { DndContext, useDroppable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  ContentDraft,
  ContentPillar,
  ContentPlatform,
  ContentPost,
  ContentPostizDelivery,
  ContentStatus,
} from '@/lib/content-studio/types';
import { CONTENT_PILLARS, CONTENT_PLATFORMS } from '@/lib/content-studio/types';
import { Button } from '../primitives';
import { CalendarCard } from './CalendarCard';
import { QuickEditDrawer } from './QuickEditDrawer';
import { JobQueue } from './JobQueue';
import { PlanMetrics } from './PlanMetrics';
import { useCalendarDnD } from './useCalendarDnD';
import {
  addDays,
  buildFilteredItems,
  buildMonthDays,
  buildWeekDays,
  formatDateKey,
  groupItemsByDay,
  isSameDay,
  startOfWeek,
} from './calendar-helpers';
import type { CalendarMediaEntry, CalendarViewMode, PublishJobRow } from './types';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const CALENDAR_STATUSES: ContentStatus[] = [
  'approved',
  'scheduled',
  'published',
  'failed',
  'cancelled',
];

interface CalendarProps {
  posts: ContentPost[];
  drafts: ContentDraft[];
  deliveries: ContentPostizDelivery[];
  mediaByDraftId: Record<string, CalendarMediaEntry | undefined>;
  pillarByDraftId: Record<string, ContentPillar | undefined>;
  initialJobs?: PublishJobRow[];
}

export function Calendar({
  posts,
  drafts,
  deliveries,
  mediaByDraftId,
  pillarByDraftId,
  initialJobs,
}: CalendarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/content-studio-v2/plan';
  const searchParams = useSearchParams();

  // URL-synced filters
  const initialView = (searchParams?.get('view') as CalendarViewMode | null) ?? 'week';
  const [mode, setMode] = useState<CalendarViewMode>(initialView);
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform | 'all'>(
    (searchParams?.get('platform') as ContentPlatform | 'all' | null) ?? 'all',
  );
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>(
    (searchParams?.get('status') as ContentStatus | 'all' | null) ?? 'all',
  );
  const [pillarFilter, setPillarFilter] = useState<ContentPillar | 'all'>(
    (searchParams?.get('pillar') as ContentPillar | 'all' | null) ?? 'all',
  );
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));

  // Quick-edit drawer state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const dnd = useCalendarDnD({
    posts,
    onPersistSuccess: () => {
      router.refresh();
    },
  });

  const updateUrl = useCallback(
    (next: Partial<Record<'view' | 'platform' | 'status' | 'pillar', string>>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      for (const [k, v] of Object.entries(next)) {
        if (!v || v === 'all') params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filteredItems = useMemo(
    () =>
      buildFilteredItems({
        posts: dnd.posts,
        drafts,
        deliveries,
        mediaByDraftId,
        pillarByDraftId,
        platformFilter,
        statusFilter,
        pillarFilter,
      }),
    [
      dnd.posts,
      drafts,
      deliveries,
      mediaByDraftId,
      pillarByDraftId,
      platformFilter,
      statusFilter,
      pillarFilter,
    ],
  );

  const groupedByDay = useMemo(() => groupItemsByDay(filteredItems), [filteredItems]);

  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);
  const monthDays = useMemo(() => buildMonthDays(cursor), [cursor]);

  const navLabel =
    mode === 'week'
      ? `${weekDays[0]?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} – ${weekDays[6]?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
      : mode === 'month'
        ? `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`
        : 'Liste';

  function navigate(direction: -1 | 1) {
    setCursor((prev) => {
      if (mode === 'week') return addDays(prev, 7 * direction);
      if (mode === 'month') {
        const m = prev.getMonth() + direction;
        return new Date(prev.getFullYear(), m, 1);
      }
      return prev;
    });
  }

  function goToday() {
    setCursor(mode === 'month'
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      : startOfWeek(new Date()));
  }

  const editingPost = useMemo(
    () => (editingPostId ? dnd.posts.find((p) => p.id === editingPostId) ?? null : null),
    [dnd.posts, editingPostId],
  );
  const editingDraft = useMemo(
    () => (editingPost ? drafts.find((d) => d.id === editingPost.draftId) : undefined),
    [drafts, editingPost],
  );

  return (
    <section>
      <PlanMetrics posts={dnd.posts} deliveries={deliveries} />

      <div
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border)',
          borderRadius: 'var(--cs-radius-md)',
          padding: 16,
        }}
      >
        <Tabs.Root
          value={mode}
          onValueChange={(v) => {
            setMode(v as CalendarViewMode);
            updateUrl({ view: v });
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Tabs.List
              aria-label="Vue calendrier"
              style={{
                display: 'inline-flex',
                background: 'var(--cs-bg-sunken)',
                borderRadius: 'var(--cs-radius-sm)',
                padding: 3,
                gap: 2,
              }}
            >
              {(['week', 'month', 'list'] as CalendarViewMode[]).map((v) => (
                <Tabs.Trigger
                  key={v}
                  value={v}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 'var(--cs-radius-sm)',
                    border: 'none',
                    background: mode === v ? 'var(--cs-bg-elevated)' : 'transparent',
                    color: mode === v ? 'var(--cs-fg-primary)' : 'var(--cs-fg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {v === 'week' ? 'Semaine' : v === 'month' ? 'Mois' : 'Liste'}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {mode !== 'list' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Précédent"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToday}>
                  Aujourd’hui
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Suivant"
                  onClick={() => navigate(1)}
                >
                  <ChevronRight size={14} />
                </Button>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--cs-fg-primary)',
                  }}
                >
                  {navLabel}
                </span>
              </div>
            ) : null}

            <div style={{ flex: 1 }} />

            <FilterSelect
              label="Statut"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v as ContentStatus | 'all');
                updateUrl({ status: v });
              }}
              options={['all', ...CALENDAR_STATUSES]}
              testId="filter-status"
            />
            <FilterSelect
              label="Plateforme"
              value={platformFilter}
              onChange={(v) => {
                setPlatformFilter(v as ContentPlatform | 'all');
                updateUrl({ platform: v });
              }}
              options={['all', ...CONTENT_PLATFORMS]}
              testId="filter-platform"
            />
            <FilterSelect
              label="Pilier"
              value={pillarFilter}
              onChange={(v) => {
                setPillarFilter(v as ContentPillar | 'all');
                updateUrl({ pillar: v });
              }}
              options={['all', ...CONTENT_PILLARS]}
              testId="filter-pillar"
            />
          </div>

          <DndContext
            sensors={dnd.sensors}
            onDragStart={dnd.handleDragStart}
            onDragEnd={dnd.handleDragEnd}
            onDragCancel={dnd.handleDragCancel}
          >
            <Tabs.Content value="week">
              <WeekGrid
                days={weekDays}
                groupedByDay={groupedByDay}
                mediaByDraftId={mediaByDraftId}
                onCardDoubleClick={setEditingPostId}
              />
            </Tabs.Content>
            <Tabs.Content value="month">
              <MonthGrid
                days={monthDays}
                cursor={cursor}
                groupedByDay={groupedByDay}
                mediaByDraftId={mediaByDraftId}
                onCardDoubleClick={setEditingPostId}
              />
            </Tabs.Content>
            <Tabs.Content value="list">
              <ListView
                items={filteredItems}
                onCardDoubleClick={setEditingPostId}
                mediaByDraftId={mediaByDraftId}
              />
            </Tabs.Content>
          </DndContext>
        </Tabs.Root>

        {filteredItems.length === 0 ? (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--cs-fg-secondary)' }}>
            Aucun post ne correspond aux filtres sélectionnés.
          </p>
        ) : null}
      </div>

      <JobQueue initialJobs={initialJobs ?? []} />

      <QuickEditDrawer
        open={editingPostId !== null}
        onOpenChange={(o) => {
          if (!o) setEditingPostId(null);
        }}
        post={editingPost}
        draft={editingDraft}
        onUpdated={() => router.refresh()}
      />
    </section>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  testId?: string;
}

function FilterSelect({ label, value, onChange, options, testId }: FilterSelectProps) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--cs-fg-secondary)',
      }}
    >
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        style={{
          padding: '4px 8px',
          borderRadius: 'var(--cs-radius-sm)',
          border: '1px solid var(--cs-border)',
          background: 'var(--cs-bg-base)',
          color: 'var(--cs-fg-primary)',
          fontSize: 12,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === 'all' ? 'Tous' : o}
          </option>
        ))}
      </select>
    </label>
  );
}

interface GridProps {
  days: Date[];
  groupedByDay: Map<string, ReturnType<typeof groupItemsByDay> extends Map<string, infer V> ? V : never>;
  mediaByDraftId: Record<string, CalendarMediaEntry | undefined>;
  onCardDoubleClick: (postId: string) => void;
}

function WeekGrid({ days, groupedByDay, onCardDoubleClick }: Omit<GridProps, 'mediaByDraftId'> & { mediaByDraftId: GridProps['mediaByDraftId'] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 1,
        background: 'var(--cs-border)',
        border: '1px solid var(--cs-border)',
        borderRadius: 'var(--cs-radius-sm)',
        overflow: 'hidden',
      }}
    >
      {DAYS_FR.map((dayName) => (
        <div
          key={dayName}
          style={{
            background: 'var(--cs-bg-sunken)',
            padding: '6px 8px',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
            color: 'var(--cs-fg-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {dayName}
        </div>
      ))}
      {days.map((day) => (
        <DroppableDay
          key={formatDateKey(day)}
          day={day}
          items={groupedByDay.get(formatDateKey(day)) ?? []}
          minHeight={120}
          onCardDoubleClick={onCardDoubleClick}
        />
      ))}
    </div>
  );
}

function MonthGrid({
  days,
  cursor,
  groupedByDay,
  onCardDoubleClick,
}: GridProps & { cursor: Date }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 1,
        background: 'var(--cs-border)',
        border: '1px solid var(--cs-border)',
        borderRadius: 'var(--cs-radius-sm)',
        overflow: 'hidden',
      }}
    >
      {DAYS_FR.map((dayName) => (
        <div
          key={dayName}
          style={{
            background: 'var(--cs-bg-sunken)',
            padding: '4px 6px',
            fontSize: 10,
            fontWeight: 600,
            textAlign: 'center',
            color: 'var(--cs-fg-secondary)',
          }}
        >
          {dayName}
        </div>
      ))}
      {days.map((day) => {
        const isCurrentMonth = day.getMonth() === cursor.getMonth();
        return (
          <DroppableDay
            key={`m-${formatDateKey(day)}`}
            day={day}
            items={groupedByDay.get(formatDateKey(day)) ?? []}
            minHeight={90}
            mini
            dimmed={!isCurrentMonth}
            onCardDoubleClick={onCardDoubleClick}
          />
        );
      })}
    </div>
  );
}

function DroppableDay({
  day,
  items,
  minHeight,
  mini = false,
  dimmed = false,
  onCardDoubleClick,
}: {
  day: Date;
  items: ReturnType<typeof groupItemsByDay> extends Map<string, infer V> ? V : never;
  minHeight: number;
  mini?: boolean;
  dimmed?: boolean;
  onCardDoubleClick: (postId: string) => void;
}) {
  const dayId = `day:${formatDateKey(day)}`;
  const { setNodeRef, isOver } = useDroppable({ id: dayId });
  const today = new Date();
  const isToday = isSameDay(day, today);

  return (
    <div
      ref={setNodeRef}
      data-testid={`day-${formatDateKey(day)}`}
      style={{
        background: dimmed ? 'var(--cs-bg-sunken)' : 'var(--cs-bg-elevated)',
        minHeight,
        padding: 6,
        outline: isOver ? '2px solid var(--cs-accent)' : isToday ? '2px solid var(--cs-border-focus, var(--cs-accent))' : 'none',
        outlineOffset: -2,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: mini ? 10 : 11,
          fontWeight: 600,
          color: dimmed ? 'var(--cs-fg-muted, var(--cs-fg-secondary))' : 'var(--cs-fg-primary)',
        }}
      >
        {day.getDate()}
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: '4px 0 0',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {items.slice(0, mini ? 3 : 10).map((item) => (
          <li key={item.post.id}>
            <CalendarCard
              post={item.post}
              draft={item.draft}
              media={item.media}
              latestDelivery={item.latestDelivery}
              pillar={item.pillar}
              variant={mini ? 'mini' : 'full'}
              onDoubleClick={onCardDoubleClick}
            />
          </li>
        ))}
        {mini && items.length > 3 ? (
          <li style={{ fontSize: 10, color: 'var(--cs-fg-secondary)' }}>+{items.length - 3} autres</li>
        ) : null}
      </ul>
    </div>
  );
}

function ListView({
  items,
  onCardDoubleClick,
}: {
  items: ReturnType<typeof groupItemsByDay> extends Map<string, infer V> ? V : never;
  mediaByDraftId: Record<string, CalendarMediaEntry | undefined>;
  onCardDoubleClick: (postId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {items.map((item) => (
        <li key={item.post.id}>
          <CalendarCard
            post={item.post}
            draft={item.draft}
            media={item.media}
            latestDelivery={item.latestDelivery}
            pillar={item.pillar}
            variant="full"
            onDoubleClick={onCardDoubleClick}
          />
        </li>
      ))}
    </ul>
  );
}
