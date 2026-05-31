'use client';

import type { TrackingPlanInput } from '@/lib/tracking/plan/types';

export function StepReview({
  draft,
  name,
  onChangeName,
}: {
  draft: TrackingPlanInput;
  name: string;
  onChangeName: (s: string) => void;
}): JSX.Element {
  const activeProviders = draft.providers.filter((p) => p.active);
  const prod = draft.envProfiles.find((e) => e.env === 'production');

  return (
    <section aria-labelledby="step-review-h" className="space-y-6">
      <div>
        <h2 id="step-review-h" className="mb-2 text-base font-semibold text-stone-900">
          Récapitulatif
        </h2>
        <p className="text-sm text-stone-600">
          Donnez un nom au plan, puis enregistrez en brouillon. Vous pourrez l'activer
          ensuite (l'activation déclenche une validation stricte).
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-stone-700">Nom du plan</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="ex. Plan tracking — Mai 2026"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </label>

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <ReviewItem
          term="Outils actifs"
          desc={
            activeProviders.length === 0
              ? 'Aucun (activation impossible)'
              : activeProviders.map((p) => p.id).join(', ')
          }
        />
        <ReviewItem
          term="Production — GA4"
          desc={prod?.config.ga4MeasurementId ?? '—'}
        />
        <ReviewItem
          term="Production — Ads"
          desc={prod?.config.googleAdsConversionId ?? '—'}
        />
        <ReviewItem
          term="Production — Meta"
          desc={prod?.config.metaPixelId ?? '—'}
        />
        <ReviewItem
          term="Production — GTM"
          desc={prod?.config.gtmContainerId ?? '—'}
        />
        <ReviewItem term="Événements" desc={`${draft.events.length} défini(s)`} />
      </dl>
    </section>
  );
}

function ReviewItem({ term, desc }: { term: string; desc: string }): JSX.Element {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{term}</dt>
      <dd className="mt-0.5 text-sm font-medium text-stone-900">{desc}</dd>
    </div>
  );
}
