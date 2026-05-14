'use client';

import type { PlanSettings } from '@/lib/tracking/plan/types';

export function StepSettings({
  settings,
  onChange,
}: {
  settings: PlanSettings;
  onChange: (next: PlanSettings) => void;
}): JSX.Element {
  const consentDefaults = settings.consentDefaults ?? {
    ad_storage: 'denied' as const,
    analytics_storage: 'denied' as const,
  };

  function patchDefault(
    key: 'ad_storage' | 'analytics_storage',
    value: 'granted' | 'denied',
  ) {
    onChange({
      ...settings,
      consentMode: settings.consentMode ?? 'v2',
      consentDefaults: { ...consentDefaults, [key]: value },
    });
  }

  return (
    <section aria-labelledby="step-settings-h">
      <h2 id="step-settings-h" className="mb-2 text-base font-semibold text-stone-900">
        Mode de consentement
      </h2>
      <p className="mb-4 text-sm text-stone-600">
        Conforme au RGPD et au Consent Mode v2 de Google. Par défaut, le consentement
        est <strong>denied</strong> tant que l'utilisateur n'a pas cliqué « Accepter ».
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ConsentToggle
          label="Stockage publicitaire (ad_storage)"
          value={consentDefaults.ad_storage}
          onChange={(v) => patchDefault('ad_storage', v)}
        />
        <ConsentToggle
          label="Stockage analytics (analytics_storage)"
          value={consentDefaults.analytics_storage}
          onChange={(v) => patchDefault('analytics_storage', v)}
        />
      </div>
    </section>
  );
}

function ConsentToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 'granted' | 'denied';
  onChange: (v: 'granted' | 'denied') => void;
}): JSX.Element {
  return (
    <fieldset className="rounded-md border border-stone-300 bg-white p-3">
      <legend className="px-1 text-sm font-medium text-stone-700">{label}</legend>
      <div className="mt-2 flex gap-3">
        {(['denied', 'granted'] as const).map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={label}
              checked={value === v}
              onChange={() => onChange(v)}
              className="text-emerald-600 focus:ring-emerald-400"
            />
            {v === 'denied' ? 'Refusé par défaut' : 'Accordé par défaut'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
