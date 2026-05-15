'use client';

import { IdInput } from '../IdInput';
import { AudienceStrategyPanel } from './AudienceStrategyPanel';
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
    hint: 'Format attendu : AW-123456789. L\'exporter strip le préfixe AW- automatiquement avant injection dans GTM (template awct le re-préfixe lui-même).',
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
      <AudienceStrategyPanel />

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

      {adsActive && (
        <>
          <GoogleAdsEnhancedConversionsToggle
            prod={prod}
            onChange={(value) =>
              patchProd({ googleAdsEnhancedConversions: value })
            }
          />
          <GoogleAdsConversionLabelsEditor
            prod={prod}
            onChange={patchConversionLabel}
          />
        </>
      )}
    </section>
  );
}

function GoogleAdsEnhancedConversionsToggle({
  prod,
  onChange,
}: {
  prod: EnvProfile;
  onChange: (value: boolean) => void;
}): JSX.Element {
  const cfg = prod.config as { googleAdsEnhancedConversions?: boolean };
  // Default true si pas explicitement défini.
  const enabled = cfg.googleAdsEnhancedConversions !== false;
  return (
    <div>
      <h2 className="mb-2 text-base font-semibold text-stone-900">
        Enhanced Conversions
      </h2>
      <p className="mb-4 text-sm text-stone-600">
        Améliore le matching des conversions Google Ads en envoyant les
        données client hashées (email, téléphone) au moment de la
        conversion. Google déclare un gain moyen de{' '}
        <strong>5 à 30 % de conversions matchées en plus</strong>{' '}
        (notamment pour les acheteurs sans cookie de clic). Aucune
        donnée non hashée ne quitte le navigateur — voir{' '}
        <a
          href="https://support.google.com/google-ads/answer/13262500"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
        >
          documentation Google
        </a>
        .
      </p>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${
          enabled
            ? 'border-emerald-300 bg-emerald-50/40'
            : 'border-stone-200 bg-white hover:border-stone-400'
        }`}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-emerald-700"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-900">
              Activer Enhanced Conversions
            </span>
            {enabled && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                ★ Recommandé
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-stone-600">
            Active le param <code>allow_enhanced_conversions: true</code>{' '}
            sur les tags <code>awct</code> exportés. Le tag scrape
            automatiquement <code>user_data.sha256_email_address</code>{' '}
            et <code>user_data.sha256_phone_number</code> du dataLayer.
          </p>
          <p className="mt-1 text-[11px] text-stone-400">
            ⚠️ Pour que ça fonctionne effectivement, la conversion
            Google Ads doit aussi être configurée côté Google Ads UI :{' '}
            <em>
              Outils → Conversions → ta conversion → onglet «&nbsp;Conversions
              améliorées&nbsp;» → activer
            </em>
            .
          </p>
        </div>
      </label>
    </div>
  );
}

