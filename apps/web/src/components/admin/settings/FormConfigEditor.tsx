/**
 * Éditeur de form_config (CHA-230 admin).
 *
 * Structure :
 *   1. Steps + modes
 *   2. Defaults (formMode, currency, country, paymentMethods, defaultShippingMode)
 *   3. Copy (titles, CTAs, thank-you)
 *   4. Validation (phone, require_email, require_postal)
 *
 * - Validation client-side via `formConfigJsonSchema` (Zod strict).
 * - PATCH `/api/admin/form-config/[key]` avec header `If-Match` (optimistic lock).
 * - Onglet historique via `FormConfigHistory`.
 *
 * Cf. docs/admin-config/40-form-config-admin-integration-plan.md §3.3
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  formConfigJsonSchema,
  type FormConfigJson,
} from '@/lib/checkout/form-config/schema';
import type {
  FormMode,
  PaymentMethod,
  ShippingMode,
  StepName,
} from '@/lib/checkout/schemas/common';

import { FormConfigEditorShell } from './FormConfigEditorShell';
import { FormConfigHistory } from './FormConfigHistory';

const ALL_STEPS: StepName[] = [
  'cart_review',
  'lead',
  'address',
  'payment',
  'thank_you',
];
const REQUIRED_STEPS: StepName[] = ['lead', 'address', 'payment', 'thank_you'];

const ALL_MODES: FormMode[] = ['wizard_embed', 'wizard_cart', 'legacy_cart'];
const ALL_PAYMENT_METHODS: PaymentMethod[] = ['cod', 'bank_transfer', 'card'];
const ALL_SHIPPING_MODES: ShippingMode[] = ['standard', 'express', 'pickup'];

const MODE_LABELS: Record<FormMode, string> = {
  wizard_embed: 'Wizard embarqué (kit)',
  wizard_cart: 'Wizard panier (commander)',
  legacy_cart: 'Panier legacy',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: 'Paiement à la livraison (COD)',
  bank_transfer: 'Virement bancaire',
  card: 'Carte bancaire',
};

const SHIPPING_LABELS: Record<ShippingMode, string> = {
  standard: 'Standard',
  express: 'Express',
  pickup: 'Point relais',
};

const STEP_LABELS: Record<StepName, string> = {
  cart_review: 'Récap panier',
  lead: 'Coordonnées',
  address: 'Adresse',
  payment: 'Paiement',
  thank_you: 'Confirmation',
};

interface FormConfigEditorProps {
  formKey: string;
  initialConfig: FormConfigJson;
  initialVersion: number;
  initialActive: boolean;
  initialDescription: string | null;
}

const FORM_LABELS: Record<string, string> = {
  wizard_kit: 'Wizard Kit (page /kit)',
  wizard_commander: 'Wizard Commander (panier)',
};

export function FormConfigEditor({
  formKey,
  initialConfig,
  initialVersion,
  initialActive,
  initialDescription,
}: FormConfigEditorProps) {
  const [config, setConfig] = useState<FormConfigJson>(initialConfig);
  const [active, setActive] = useState(initialActive);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [version, setVersion] = useState(initialVersion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      JSON.stringify({ config, active, description }) !==
      JSON.stringify({
        config: initialConfig,
        active: initialActive,
        description: initialDescription ?? '',
      }),
    [config, active, description, initialConfig, initialActive, initialDescription],
  );

  const handleReset = useCallback(() => {
    setConfig(initialConfig);
    setActive(initialActive);
    setDescription(initialDescription ?? '');
    setError(null);
    setSuccess(null);
  }, [initialConfig, initialActive, initialDescription]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(null);
    const parsed = formConfigJsonSchema.safeParse(config);
    if (!parsed.success) {
      setError(
        `Validation : ${parsed.error.issues[0]?.path.join('.')} — ${
          parsed.error.issues[0]?.message
        }`,
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/form-config/${formKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': String(version),
        },
        body: JSON.stringify({
          config: parsed.data,
          description: description || undefined,
          active,
        }),
      });
      if (res.status === 401) {
        setError('Session expirée — recharge la page.');
        return;
      }
      if (res.status === 409) {
        setError(
          'Une autre modification est arrivée. Recharge pour voir la version courante.',
        );
        return;
      }
      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as {
          error?: { details?: Array<{ message?: string }> };
        } | null;
        const msg = body?.error?.details?.[0]?.message ?? 'Payload invalide.';
        setError(`Validation serveur : ${msg}`);
        return;
      }
      if (!res.ok) {
        setError('Erreur serveur.');
        return;
      }
      const data = (await res.json()) as {
        version: number;
        config: FormConfigJson;
        active: boolean;
        description: string | null;
      };
      setVersion(data.version);
      setConfig(data.config);
      setActive(data.active);
      setDescription(data.description ?? '');
      setSuccess(`Version ${data.version} enregistrée.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }, [config, formKey, version, description, active]);

  // ──────────────── Helpers ────────────────
  const toggleStep = (step: StepName) => {
    setConfig((c) => {
      const has = c.steps.includes(step);
      if (has) {
        if (REQUIRED_STEPS.includes(step)) return c;
        return { ...c, steps: c.steps.filter((s) => s !== step) };
      }
      return { ...c, steps: [...c.steps, step] };
    });
  };

  const toggleMode = (mode: FormMode) => {
    setConfig((c) => {
      const has = c.modes.includes(mode);
      if (has && c.modes.length === 1) return c; // min 1 mode
      return {
        ...c,
        modes: has ? c.modes.filter((m) => m !== mode) : [...c.modes, mode],
      };
    });
  };

  const togglePayment = (pm: PaymentMethod) => {
    setConfig((c) => {
      const has = c.defaults.paymentMethods.includes(pm);
      if (has && c.defaults.paymentMethods.length === 1) return c; // min 1
      return {
        ...c,
        defaults: {
          ...c.defaults,
          paymentMethods: has
            ? c.defaults.paymentMethods.filter((p) => p !== pm)
            : [...c.defaults.paymentMethods, pm],
        },
      };
    });
  };

  return (
    <FormConfigEditorShell
      formKey={formKey}
      label={FORM_LABELS[formKey] ?? formKey}
      description="Édite les steps, copy et validation du wizard. Toute sauvegarde est versionnée et auditée."
      version={version}
      active={active}
      dirty={dirty}
      saving={saving}
      errorMessage={error}
      successMessage={success}
      onSave={handleSave}
      onReset={handleReset}
      renderHistory={() => (
        <FormConfigHistory formKey={formKey} currentVersion={version} />
      )}
    >
      <div className="space-y-6">
        {/* ─── État (actif/inactif) ─── */}
        <fieldset className="rounded-md border border-stone-200 bg-white p-5">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            État
          </legend>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
              data-testid="form-config-active"
            />
            <span className="text-sm font-medium text-stone-900">
              Wizard actif (servi par la route publique)
            </span>
          </label>
          <div className="mt-3">
            <label
              htmlFor="form-config-description"
              className="text-xs font-medium text-stone-700"
            >
              Description (note interne, max 500 chars)
            </label>
            <textarea
              id="form-config-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
              placeholder="Ex. Augmentation du min phone à 10."
            />
          </div>
        </fieldset>

        {/* ─── Steps + modes ─── */}
        <fieldset className="rounded-md border border-stone-200 bg-white p-5">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Steps & modes
          </legend>
          <p className="text-xs text-stone-500">
            Steps requis :{' '}
            {REQUIRED_STEPS.map((s) => (
              <code key={s} className="rounded bg-stone-100 px-1 font-mono">
                {s}
              </code>
            ))}
            . Le seul step optionnel est <code className="font-mono">cart_review</code>.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ALL_STEPS.map((step) => {
              const isOn = config.steps.includes(step);
              const isReq = REQUIRED_STEPS.includes(step);
              return (
                <label
                  key={step}
                  className={`flex items-start gap-2 rounded-md border p-2 text-sm transition ${
                    isOn
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 bg-white'
                  } ${isReq ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={isReq}
                    onChange={() => toggleStep(step)}
                    className="mt-0.5 h-4 w-4 rounded border-stone-300"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{STEP_LABELS[step]}</p>
                    <p className="font-mono text-[10px] text-stone-500">{step}</p>
                    {isReq ? (
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                        requis
                      </p>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-stone-500">
            Modes (au moins 1, max 3) :
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {ALL_MODES.map((mode) => {
              const isOn = config.modes.includes(mode);
              return (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                    isOn ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggleMode(mode)}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  <span className="font-medium text-stone-900">
                    {MODE_LABELS[mode]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* ─── Defaults ─── */}
        <fieldset className="rounded-md border border-stone-200 bg-white p-5">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Defaults
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-700">Form mode défaut</label>
              <select
                value={config.defaults.formMode}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    defaults: { ...c.defaults, formMode: e.target.value as FormMode },
                  }))
                }
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
              >
                {ALL_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">
                Mode de livraison défaut
              </label>
              <select
                value={config.defaults.defaultShippingMode}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    defaults: {
                      ...c.defaults,
                      defaultShippingMode: e.target.value as ShippingMode,
                    },
                  }))
                }
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
              >
                {ALL_SHIPPING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {SHIPPING_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Devise (3 lettres)</label>
              <input
                type="text"
                value={config.defaults.currency}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    defaults: {
                      ...c.defaults,
                      currency: e.target.value.toUpperCase().slice(0, 3),
                    },
                  }))
                }
                maxLength={3}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 font-mono text-sm uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Pays (2 lettres)</label>
              <input
                type="text"
                value={config.defaults.country}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    defaults: {
                      ...c.defaults,
                      country: e.target.value.toUpperCase().slice(0, 2),
                    },
                  }))
                }
                maxLength={2}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 font-mono text-sm uppercase"
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Méthodes de paiement (min 1, max 3) :
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {ALL_PAYMENT_METHODS.map((pm) => {
              const isOn = config.defaults.paymentMethods.includes(pm);
              return (
                <label
                  key={pm}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                    isOn ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => togglePayment(pm)}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  <span className="font-medium text-stone-900">
                    {PAYMENT_LABELS[pm]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* ─── Copy ─── */}
        <fieldset className="rounded-md border border-stone-200 bg-white p-5">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Copy (textes affichés)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['title', 'Titre du wizard', 200],
                ['cta_cart', 'CTA récap panier', 80],
                ['cta_lead', 'CTA step coordonnées', 80],
                ['cta_address', 'CTA step adresse', 80],
                ['cta_payment', 'CTA step paiement', 80],
                ['thank_you_title', 'Titre de remerciement', 200],
                ['thank_you_subtitle', 'Sous-titre de remerciement', 300],
              ] as const
            ).map(([key, label, max]) => {
              const value = (config.copy[key] as string | undefined) ?? '';
              const tooLong = value.length > max;
              return (
                <div
                  key={key}
                  className={key.startsWith('thank_you') ? 'sm:col-span-2' : undefined}
                >
                  <label className="flex items-center justify-between text-xs font-medium text-stone-700">
                    <span>
                      {label}{' '}
                      <code className="ml-1 rounded bg-stone-100 px-1 font-mono text-[10px]">
                        {key}
                      </code>
                    </span>
                    <span
                      className={`text-[10px] ${
                        tooLong ? 'text-red-700' : 'text-stone-500'
                      }`}
                    >
                      {value.length}/{max}
                    </span>
                  </label>
                  <textarea
                    rows={key.startsWith('thank_you_subtitle') ? 2 : 1}
                    value={value}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        copy: { ...c.copy, [key]: e.target.value },
                      }))
                    }
                    maxLength={max}
                    className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* ─── Validation ─── */}
        <fieldset className="rounded-md border border-stone-200 bg-white p-5">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Validation
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-700">Phone min length</label>
              <input
                type="number"
                min={5}
                max={15}
                value={config.validation.phone_min_length}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    validation: {
                      ...c.validation,
                      phone_min_length: Number(e.target.value),
                    },
                  }))
                }
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Phone max length</label>
              <input
                type="number"
                min={5}
                max={15}
                value={config.validation.phone_max_length}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    validation: {
                      ...c.validation,
                      phone_max_length: Number(e.target.value),
                    },
                  }))
                }
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.validation.require_email_on_thank_you}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    validation: {
                      ...c.validation,
                      require_email_on_thank_you: e.target.checked,
                    },
                  }))
                }
                className="h-4 w-4 rounded border-stone-300"
              />
              <span className="text-sm text-stone-900">
                Email requis à la confirmation
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.validation.require_postal_code}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    validation: { ...c.validation, require_postal_code: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-stone-300"
              />
              <span className="text-sm text-stone-900">Code postal requis</span>
            </label>
          </div>
        </fieldset>
      </div>
    </FormConfigEditorShell>
  );
}
