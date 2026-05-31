/**
 * Ligne d'une matrice événement × outils.
 *
 * Affiche le nom de l'événement et N cases à cocher (une par outil actif).
 * Le parent contrôle les valeurs (`enabledProviders`) et reçoit les changements
 * via `onToggle(providerId, on)`. Aucune mutation directe.
 */
'use client';

import type { ProviderId, TrackingEvent } from '@/lib/tracking/plan/types';

export interface EventMatrixRowProps {
  event: TrackingEvent;
  providers: ReadonlyArray<{ id: ProviderId; active: boolean; label?: string }>;
  onToggle: (providerId: ProviderId, on: boolean) => void;
  onRename?: (key: string) => void;
}

export function EventMatrixRow({
  event,
  providers,
  onToggle,
  onRename,
}: EventMatrixRowProps): JSX.Element {
  const activeProviders = providers.filter((p) => p.active);

  return (
    <tr className="border-b border-stone-200">
      <th
        scope="row"
        className="whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-stone-900"
      >
        {onRename ? (
          <input
            type="text"
            value={event.key}
            onChange={(e) => onRename(e.target.value)}
            aria-label="Clé de l'événement"
            className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        ) : (
          event.key
        )}
      </th>
      {activeProviders.map((p) => {
        const checked = !!event.providers[p.id];
        return (
          <td key={p.id} className="px-3 py-2 text-center">
            <label className="inline-flex cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(p.id, e.target.checked)}
                aria-label={`Activer ${event.key} sur ${p.label ?? p.id}`}
                className="h-4 w-4 cursor-pointer rounded border-stone-300 text-emerald-600 focus:ring-emerald-400"
              />
            </label>
          </td>
        );
      })}
    </tr>
  );
}
