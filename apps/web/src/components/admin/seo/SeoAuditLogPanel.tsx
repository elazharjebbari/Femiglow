/**
 * `SeoAuditLogPanel` — affiche les audit events scope SEO avec filtres et
 * pagination cursor.
 *
 * Composant client. Le SSR initial fournit la 1re page via `initialEvents`
 * et `initialNextCursor` (composant entièrement hydrate-friendly, pas de
 * skeleton flash).
 *
 * Filtres :
 *  - Action (select avec actions canoniques : create, update, publish,
 *    unpublish, delete, settings.update, settings.reset, settings.seed,
 *    bulk.publish, bulk.unpublish, bulk.delete).
 *  - Actor (input texte, ID admin).
 *
 * Pagination : bouton « Charger plus » qui consomme `nextCursor`.
 * Les filtres réinitialisent la liste.
 *
 * UX :
 *  - Regroupement visuel par jour (label sticky).
 *  - Diff visible : pour chaque event, affichage compact des clés modifiées
 *    (extraites de `meta.fields` quand disponible).
 *  - Cliquer sur un event affiche la `meta` complète dans un panel à droite.
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

import type { AuditEvent } from '@/lib/db/types';

export interface SeoAuditLogPanelProps {
  initialEvents: AuditEvent[];
  initialNextCursor: string | null;
}

const SEO_ACTIONS = [
  '',
  'seo.create',
  'seo.update',
  'seo.publish',
  'seo.unpublish',
  'seo.delete',
  'seo.restore',
  'seo.settings.update',
  'seo.settings.reset',
  'seo.settings.seed',
  'seo.bulk.publish',
  'seo.bulk.unpublish',
  'seo.bulk.delete',
] as const;

interface FetchPage {
  events: AuditEvent[];
  nextCursor: string | null;
}

export function SeoAuditLogPanel({
  initialEvents,
  initialNextCursor,
}: SeoAuditLogPanelProps): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /** Construit l'URL de l'API en respectant les filtres actifs. */
  const buildUrl = useCallback(
    (params: { cursor?: string | null } = {}) => {
      const url = new URL('/api/admin/seo/audit-log', window.location.origin);
      if (actionFilter) url.searchParams.set('action', actionFilter);
      if (actorFilter.trim()) url.searchParams.set('actorId', actorFilter.trim());
      if (params.cursor) url.searchParams.set('cursor', params.cursor);
      return url.toString();
    },
    [actionFilter, actorFilter],
  );

  /** Recharge depuis le début avec les filtres actuels. */
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FetchPage = await res.json();
      setEvents(data.events.map(rehydrate));
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  /** Charge la page suivante (concatène les events). */
  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl({ cursor }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FetchPage = await res.json();
      setEvents((prev) => [...prev, ...data.events.map(rehydrate)]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [buildUrl, cursor]);

  /** Regroupe les events par jour (label sticky). */
  const groups = useMemo(() => groupByDay(events), [events]);

  return (
    <div className="space-y-4" data-testid="seo-audit-log-panel">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-stone-200 bg-white p-3">
        <label className="flex flex-col text-xs font-medium text-stone-600">
          Action
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="mt-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
            data-testid="seo-audit-filter-action"
          >
            {SEO_ACTIONS.map((a) => (
              <option key={a || '_all'} value={a}>
                {a || '— toutes —'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-stone-600">
          Actor (ID admin)
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="adm_..."
            className="mt-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm font-mono"
            data-testid="seo-audit-filter-actor"
          />
        </label>
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          data-testid="seo-audit-filter-apply"
        >
          {loading ? 'Chargement…' : 'Appliquer les filtres'}
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {events.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500"
          data-testid="seo-audit-empty"
        >
          Aucune action récente sur ce périmètre.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ day, items }) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h3
                id={`day-${day}`}
                className="sticky top-0 z-10 -mx-2 mb-2 bg-stone-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600"
              >
                {day}
              </h3>
              <ul className="space-y-1">
                {items.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    expanded={expandedId === e.id}
                    onToggle={() =>
                      setExpandedId((prev) => (prev === e.id ? null : e.id))
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {cursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            data-testid="seo-audit-load-more"
          >
            {loading ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sous-composants                                                           */
/* -------------------------------------------------------------------------- */

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: AuditEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const time = event.createdAt.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const target =
    event.resourceType && event.resourceId
      ? `${event.resourceType}:${event.resourceId}`
      : event.resourceType ?? '—';
  const fields = Array.isArray((event.meta as { fields?: unknown[] })?.fields)
    ? ((event.meta as { fields: string[] }).fields ?? []).join(', ')
    : null;
  return (
    <li className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-12 items-center gap-2 text-left"
        aria-expanded={expanded}
        data-testid={`seo-audit-event-${event.id}`}
      >
        <span className="col-span-2 font-mono text-xs text-stone-500">{time}</span>
        <span className="col-span-2 font-mono text-xs text-stone-700">
          {event.actorId ?? 'system'}
        </span>
        <span className="col-span-3 font-mono text-xs text-stone-800">{event.action}</span>
        <span className="col-span-4 truncate font-mono text-xs text-stone-600">{target}</span>
        <span className="col-span-1 text-right text-xs text-stone-400">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {fields ? (
        <div className="ml-[16.66%] mt-1 text-xs text-stone-500">Champs : {fields}</div>
      ) : null}
      {expanded ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-stone-50 p-2 text-[11px] text-stone-700">
          {JSON.stringify(event.meta, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

interface DayGroup {
  day: string;
  items: AuditEvent[];
}

function groupByDay(events: AuditEvent[]): DayGroup[] {
  const map = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  // Tri par jour décroissant (le plus récent en premier).
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([day, items]) => ({ day, items }));
}

/**
 * Convertit `createdAt: string` (sérialisation JSON) en `Date` côté client.
 */
function rehydrate(raw: AuditEvent): AuditEvent {
  return {
    ...raw,
    createdAt:
      raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt as unknown as string),
  };
}
