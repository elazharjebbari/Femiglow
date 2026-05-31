'use client';

import { EventMatrixRow } from '../EventMatrixRow';
import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';
import type { Provider, ProviderId, TrackingEvent } from '@/lib/tracking/plan/types';

const PRESET_EVENTS: string[] = [
  'page_view',
  'view_item',
  'add_to_cart',
  'checkout_intent',
  'purchase',
  'lead_capture',
];

const PROVIDER_LABEL: Record<ProviderId, string> = {
  ga4: 'GA4',
  googleAds: 'Ads',
  meta: 'Meta',
  tiktok: 'TikTok',
  snap: 'Snap',
  gtm: 'GTM',
};

export function StepEvents({
  providers,
  events,
  onChange,
}: {
  providers: Provider[];
  events: TrackingEvent[];
  onChange: (next: TrackingEvent[]) => void;
}): JSX.Element {
  const activeProviders = providers.filter((p) => p.active);
  const filtered = activeProviders.map((p) => ({
    id: p.id,
    active: p.active,
    label: PROVIDER_LABEL[p.id],
  }));

  function toggle(eventKey: string, providerId: ProviderId, on: boolean) {
    onChange(
      events.map((e) =>
        e.key === eventKey
          ? { ...e, providers: { ...e.providers, [providerId]: on } }
          : e,
      ),
    );
  }

  function addEvent(key: string) {
    if (events.some((e) => e.key === key)) return;
    onChange([...events, { key, providers: { ga4: true } }]);
  }

  function addCustom() {
    const key = `custom_event_${events.length + 1}`;
    onChange([...events, { key, providers: {} }]);
  }

  /**
   * Ajoute en lot tous les events du catalogue qui ne sont pas encore
   * dans le plan. Pratique quand le catalogue applicatif évolue (nouvel
   * event) et qu'on veut le faire apparaître dans un plan existant sans
   * cliquer sur chaque preset.
   */
  function syncFromCatalog() {
    const existing = new Set(events.map((e) => e.key));
    const missing = EVENT_CATALOG.filter((entry) => !existing.has(entry.name));
    if (missing.length === 0) return;
    const additions: TrackingEvent[] = missing.map((entry) => {
      const providers: Record<string, boolean> = {};
      // Mapping legacy → V2 (cf. canonical-seed.ts)
      for (const p of entry.defaultProviders) {
        if (p === 'google_ga4') providers.ga4 = true;
        else if (p === 'google_ads') providers.googleAds = true;
        else if (p === 'meta') providers.meta = true;
        else if (p === 'tiktok') providers.tiktok = true;
        else if (p === 'snap') providers.snap = true;
      }
      return { key: entry.name, label: entry.description, providers };
    });
    onChange([...events, ...additions]);
  }

  const catalogMissingCount = EVENT_CATALOG.filter(
    (entry) => !events.some((e) => e.key === entry.name),
  ).length;

  function rename(oldKey: string, nextKey: string) {
    onChange(events.map((e) => (e.key === oldKey ? { ...e, key: nextKey } : e)));
  }

  function remove(key: string) {
    onChange(events.filter((e) => e.key !== key));
  }

  return (
    <section aria-labelledby="step-events-h">
      <h2 id="step-events-h" className="mb-2 text-base font-semibold text-stone-900">
        Quels événements tracker ?
      </h2>
      <p className="mb-4 text-sm text-stone-600">
        Sélectionnez des presets, synchronisez depuis le catalogue applicatif,
        ou créez vos propres clés (snake_case).
      </p>

      {catalogMissingCount > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50/60 px-4 py-2 text-sm text-sky-900">
          <span>
            <strong>{catalogMissingCount}</strong>{' '}
            {catalogMissingCount > 1 ? 'événements' : 'événement'} du catalogue
            {catalogMissingCount > 1 ? ' ne sont pas' : " n'est pas"} dans ce
            plan (ex. <code className="font-mono">checkout_intent</code>).
          </span>
          <button
            type="button"
            onClick={syncFromCatalog}
            className="shrink-0 rounded-md border border-sky-600 bg-white px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
          >
            Synchroniser ({catalogMissingCount})
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESET_EVENTS.map((key) => {
          const exists = events.some((e) => e.key === key);
          return (
            <button
              key={key}
              type="button"
              disabled={exists}
              onClick={() => addEvent(key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                exists
                  ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400'
                  : 'border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              + {key}
            </button>
          );
        })}
        <button
          type="button"
          onClick={addCustom}
          className="rounded-full border border-stone-400 bg-white px-3 py-1 text-xs text-stone-700 hover:bg-stone-50"
        >
          + Personnalisé
        </button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">
          Aucun événement encore.
        </p>
      ) : (
        <table className="w-full border-collapse rounded-md border border-stone-200 bg-white">
          <thead>
            <tr className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2 text-left">Événement</th>
              {filtered.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center">
                  {p.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.key} className="border-b border-stone-100">
                <td colSpan={filtered.length + 1} className="px-0">
                  <table className="w-full">
                    <tbody>
                      <EventMatrixRow
                        event={e}
                        providers={filtered}
                        onToggle={(pid, on) => toggle(e.key, pid, on)}
                        onRename={(k) => rename(e.key, k)}
                      />
                    </tbody>
                  </table>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(e.key)}
                    className="text-xs text-rose-600 hover:underline"
                    aria-label={`Supprimer ${e.key}`}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
