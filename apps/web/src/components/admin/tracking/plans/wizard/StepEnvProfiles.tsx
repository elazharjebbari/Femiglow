'use client';

import { IdInput } from '../IdInput';
import { GoogleAdsConversionLabelsEditor } from './GoogleAdsConversionLabelsEditor';
import { TrackingHelpPanel } from './TrackingHelpPanel';
import type {
  EnvProfile,
  GoogleAdsConversionLabels,
  Provider,
  ProviderId,
} from '@/lib/tracking/plan/types';

const ID_RULES: Record<
  ProviderId,
  { key: keyof NonNullable<EnvProfile['config']>; label: string; pattern: RegExp; hint: string }
> = {
  ga4: {
    key: 'ga4MeasurementId',
    label: 'GA4 Measurement ID',
    pattern: /^G-[A-Z0-9]{8,12}$/,
    hint: 'Format attendu : G-XXXXXXXXXX (8 à 12 caractères).',
  },
  googleAds: {
    key: 'googleAdsConversionId',
    label: 'Google Ads Conversion ID',
    pattern: /^AW-\d{6,12}$/,
    hint: 'Format attendu : AW-123456789.',
  },
  meta: {
    key: 'metaPixelId',
    label: 'Meta Pixel ID',
    pattern: /^\d{10,17}$/,
    hint: 'Identifiant numérique de 10 à 17 chiffres.',
  },
  tiktok: {
    key: 'tiktokPixelId',
    label: 'TikTok Pixel ID',
    pattern: /^[A-Z0-9]{15,25}$/i,
    hint: 'Alphanumérique 15 à 25 caractères.',
  },
  gtm: {
    key: 'gtmContainerId',
    label: 'GTM Container ID',
    pattern: /^GTM-[A-Z0-9]{6,10}$/,
    hint: 'Format attendu : GTM-XXXXXXX.',
  },
};

export function StepEnvProfiles({
  providers,
  profiles,
  onChange,
}: {
  providers: Provider[];
  profiles: EnvProfile[];
  onChange: (next: EnvProfile[]) => void;
}): JSX.Element {
  const prod = profiles.find((p) => p.env === 'production') ?? {
    env: 'production' as const,
    config: {},
  };
  const activeProviders = providers.filter((p) => p.active);
  const adsActive = activeProviders.some((p) => p.id === 'googleAds');

  function patchProd(patch: Record<string, unknown>) {
    const next: EnvProfile = {
      env: 'production',
      config: { ...prod.config, ...patch } as EnvProfile['config'],
    };
    const others = profiles.filter((p) => p.env !== 'production');
    onChange([next, ...others]);
  }

  function patchConversionLabel(key: string, value: string) {
    const current =
      (prod.config as { googleAdsConversionLabels?: GoogleAdsConversionLabels })
        .googleAdsConversionLabels ?? {};
    patchProd({
      googleAdsConversionLabels: { ...current, [key]: value },
    });
  }

  return (
    <section aria-labelledby="step-env-h" className="space-y-8">
      <TrackingHelpPanel />

      <div>
        <h2 id="step-env-h" className="mb-2 text-base font-semibold text-stone-900">
          Identifiants production
        </h2>
        <p className="mb-4 text-sm text-stone-600">
          Remplissez les IDs réels (placeholders type <code>G-PROD0000</code> refusés à l'activation).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {activeProviders.map((p) => {
            const rule = ID_RULES[p.id];
            const value = (prod.config as Record<string, string | undefined>)[rule.key] ?? '';
            return (
              <IdInput
                key={p.id}
                label={rule.label}
                value={value}
                onChange={(v) => patchProd({ [rule.key]: v })}
                pattern={rule.pattern}
                hint={rule.hint}
              />
            );
          })}
        </div>
      </div>

      {adsActive && <GoogleAdsConversionLabelsEditor prod={prod} onChange={patchConversionLabel} />}
    </section>
  );
}

