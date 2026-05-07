/**
 * LiveEventStream — flux événements (buffer 100, FIFO côté client).
 * cf. docs/analytics/05-onglets-specs.md §2.4 D
 *
 * - Pause/Resume géré par le parent (via la prop `paused`).
 * - Filtre par catégorie d'event.
 * - Highlight 800 ms à l'arrivée d'un nouveau event_id.
 * - Format : [hh:mm:ss] event_name (badge) page_route · device · locale.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { ChartFrame } from '@/components/admin/analytics/primitives';
import type {
  LiveStreamEvent,
} from '@/lib/analytics/queries/live';
import type { TrackingEventCategory } from '@/lib/db/types';

const CATEGORY_LABELS: Record<TrackingEventCategory, string> = {
  page: 'Page',
  engagement: 'Engagement',
  ecommerce: 'E-commerce',
  lead: 'Lead',
  media: 'Média',
  admin: 'Admin',
  custom: 'Custom',
};

const CATEGORY_BADGE: Record<TrackingEventCategory, string> = {
  page: 'bg-stone-100 text-stone-700',
  engagement: 'bg-amber-50 text-amber-800',
  ecommerce: 'bg-emerald-50 text-emerald-800',
  lead: 'bg-sky-50 text-sky-800',
  media: 'bg-purple-50 text-purple-800',
  admin: 'bg-stone-200 text-stone-800',
  custom: 'bg-rose-50 text-rose-800',
};

const CATEGORY_OPTIONS: Array<TrackingEventCategory | 'all'> = [
  'all',
  'page',
  'engagement',
  'ecommerce',
  'lead',
  'media',
];

interface LiveEventStreamProps {
  events: LiveStreamEvent[];
  paused?: boolean;
}

export function LiveEventStream({ events, paused = false }: LiveEventStreamProps) {
  const [filter, setFilter] = useState<TrackingEventCategory | 'all'>('all');
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const lastIdsRef = useRef<Set<string>>(new Set());

  // Identifie les nouveaux event_ids depuis le dernier render et les marque
  // pour highlight pendant 800 ms. Pas de mise à jour si paused.
  useEffect(() => {
    if (paused) return;
    const newOnes = new Set<string>();
    for (const e of events) {
      if (!lastIdsRef.current.has(e.eventId)) newOnes.add(e.eventId);
    }
    if (newOnes.size > 0) {
      setHighlight(newOnes);
      const t = window.setTimeout(() => setHighlight(new Set()), 800);
      lastIdsRef.current = new Set(events.map((e) => e.eventId));
      return () => window.clearTimeout(t);
    }
    lastIdsRef.current = new Set(events.map((e) => e.eventId));
  }, [events, paused]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.eventCategory === filter);
  }, [events, filter]);

  return (
    <ChartFrame
      title="Flux événements"
      description={`${events.length} dans le buffer · live${paused ? ' · en pause' : ''}`}
      actions={
        <select
          aria-label="Filtrer par catégorie"
          className="rounded border border-stone-300 bg-white px-2 py-1 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value as TrackingEventCategory | 'all')}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'Toutes catégories' : CATEGORY_LABELS[opt]}
            </option>
          ))}
        </select>
      }
      isEmpty={filtered.length === 0}
      emptyMessage="Pas d’événement à afficher."
      height={384}
    >
      <ol
        className="overflow-y-auto font-mono text-xs"
        style={{ maxHeight: 384 }}
        data-testid="live-event-stream"
      >
        {filtered.map((e) => {
          const isNew = highlight.has(e.eventId);
          return (
            <li
              key={e.eventId}
              className={`flex items-center gap-2 border-b border-stone-100 px-1 py-1.5 transition-colors ${
                isNew ? 'bg-emerald-50' : ''
              }`}
            >
              <time className="text-stone-400 tabular-nums">
                {formatTime(e.receivedAt)}
              </time>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  CATEGORY_BADGE[e.eventCategory] ?? 'bg-stone-100 text-stone-700'
                }`}
              >
                {e.eventName}
              </span>
              <span className="truncate text-stone-700" title={e.pageRoute}>
                {e.pageRoute}
              </span>
              <span className="ml-auto text-stone-400">
                {e.device} · {e.locale.slice(0, 2)}
              </span>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return '--:--:--';
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
