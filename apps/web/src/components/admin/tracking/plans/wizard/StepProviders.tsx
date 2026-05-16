'use client';

import { PROVIDER_IDS, type Provider, type ProviderId } from '@/lib/tracking/plan/types';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  ga4: 'Google Analytics 4',
  googleAds: 'Google Ads',
  meta: 'Meta Pixel',
  tiktok: 'TikTok Pixel',
  snap: 'Snapchat Pixel',
  gtm: 'Google Tag Manager',
};

const PROVIDER_HINT: Record<ProviderId, string> = {
  ga4: 'Analyse comportementale et conversions principales.',
  googleAds: 'Conversions Google Ads. Requiert un Conversion ID.',
  meta: 'Pixel Meta pour publicité Facebook / Instagram.',
  tiktok: 'Pixel TikTok pour publicité TikTok Ads.',
  snap: 'Pixel Snapchat Ads, audiences et conversions Snap.',
  gtm: 'Conteneur GTM (déploiement centralisé des tags).',
};

export function StepProviders({
  providers,
  onChange,
}: {
  providers: Provider[];
  onChange: (next: Provider[]) => void;
}): JSX.Element {
  function toggle(id: ProviderId) {
    onChange(providers.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  }

  return (
    <section aria-labelledby="step-providers-h">
      <h2 id="step-providers-h" className="mb-2 text-base font-semibold text-stone-900">
        Quels outils utilisez-vous ?
      </h2>
      <p className="mb-4 text-sm text-stone-600">
        Activez les outils dont vous voulez tracker l'audience. Vous pourrez en ajouter plus tard.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PROVIDER_IDS.map((id) => {
          const provider = providers.find((p) => p.id === id);
          const active = provider?.active ?? false;
          return (
            <li key={id}>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => toggle(id)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                  active
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 ${
                    active ? 'justify-end bg-emerald-600' : 'justify-start bg-stone-300'
                  }`}
                >
                  <span className="block h-4 w-4 rounded-full bg-white" />
                </span>
                <span>
                  <strong className="block text-sm font-medium">{PROVIDER_LABELS[id]}</strong>
                  <span className="block text-xs">{PROVIDER_HINT[id]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
