'use client';

import { useState, useCallback, type ChangeEvent } from 'react';
import {
  GTM_ENVS,
  type GtmConfigPerEnv,
  type GtmEnv,
  type GtmEnvConfigDTO,
  emptyEnvConfig,
} from '@/lib/tracking/gtm/config-schema';
import { IconCopy, IconCheck } from './GtmIcons';
import { GtmTemplatePicker } from './GtmTemplatePicker';
import { GtmCsvImport } from './GtmCsvImport';

interface Props {
  initial?: GtmConfigPerEnv;
  onSubmit: (input: { name: string; notes: string | null; perEnv: GtmConfigPerEnv }) => Promise<void> | void;
  submitting?: boolean;
}

interface FieldDef {
  key: keyof GtmEnvConfigDTO | 'convPurchase' | 'convLead' | 'convSignup' | 'convInitCheckout';
  label: string;
  placeholder?: string;
  hint?: string;
}

const FIELDS: FieldDef[] = [
  { key: 'ga4MeasurementId', label: 'GA4 Measurement ID', placeholder: 'G-XXXXXXX' },
  { key: 'metaPixelId', label: 'Meta Pixel ID', placeholder: '11111111111' },
  { key: 'tiktokPixelId', label: 'TikTok Pixel ID' },
  { key: 'snapPixelId', label: 'Snap Pixel ID' },
  { key: 'pinterestTagId', label: 'Pinterest Tag ID' },
  { key: 'googleAdsCustomerId', label: 'Google Ads Customer ID', placeholder: '123-456-7890' },
  { key: 'convPurchase', label: 'Ads Conv — Purchase', placeholder: 'AW-XXX/abc123', hint: 'AW-…/label' },
  { key: 'convLead', label: 'Ads Conv — Lead', placeholder: 'AW-XXX/def456' },
  { key: 'convSignup', label: 'Ads Conv — Sign Up', placeholder: 'AW-XXX/ghi789' },
  { key: 'convInitCheckout', label: 'Ads Conv — Init Checkout', placeholder: 'AW-XXX/jkl000' },
  { key: 'defaultCurrency', label: 'Devise par défaut', placeholder: 'MAD' },
  { key: 'cookieDomain', label: 'Cookie domain', placeholder: 'auto' },
];

function getFieldValue(cfg: GtmEnvConfigDTO, key: FieldDef['key']): string {
  switch (key) {
    case 'convPurchase':
      return cfg.googleAdsConvLabels?.purchase ?? '';
    case 'convLead':
      return cfg.googleAdsConvLabels?.lead ?? '';
    case 'convSignup':
      return cfg.googleAdsConvLabels?.signup ?? '';
    case 'convInitCheckout':
      return cfg.googleAdsConvLabels?.initCheckout ?? '';
    default:
      return (cfg[key] as string) ?? '';
  }
}

function setFieldValue(
  cfg: GtmEnvConfigDTO,
  key: FieldDef['key'],
  value: string,
): GtmEnvConfigDTO {
  if (key.startsWith('conv')) {
    const labels = { ...(cfg.googleAdsConvLabels ?? {}) };
    if (key === 'convPurchase') labels.purchase = value;
    if (key === 'convLead') labels.lead = value;
    if (key === 'convSignup') labels.signup = value;
    if (key === 'convInitCheckout') labels.initCheckout = value;
    return { ...cfg, googleAdsConvLabels: labels };
  }
  return { ...cfg, [key]: value };
}

function emptyPerEnv(): GtmConfigPerEnv {
  return {
    production: emptyEnvConfig(),
    stage: emptyEnvConfig(),
    preview: emptyEnvConfig(),
    dev: emptyEnvConfig(),
  };
}

export function GtmConfigForm({ initial, onSubmit, submitting = false }: Props) {
  const [perEnv, setPerEnv] = useState<GtmConfigPerEnv>(initial ?? emptyPerEnv());
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [propagatedKey, setPropagatedKey] = useState<string | null>(null);

  const update = useCallback(
    (env: GtmEnv, key: FieldDef['key']) =>
      (e: ChangeEvent<HTMLInputElement>) => {
        setPerEnv((cur) => ({ ...cur, [env]: setFieldValue(cur[env], key, e.target.value) }));
      },
    [],
  );

  const propagate = useCallback(
    (key: FieldDef['key'], from: GtmEnv, scope: 'all' | 'public') => {
      setPerEnv((cur) => {
        const value = getFieldValue(cur[from], key);
        const targets: GtmEnv[] =
          scope === 'all'
            ? GTM_ENVS.filter((e) => e !== from)
            : (['production', 'stage', 'preview'] as GtmEnv[]).filter((e) => e !== from);
        const next = { ...cur };
        for (const target of targets) {
          next[target] = setFieldValue(next[target], key, value);
        }
        return next;
      });
      setPropagatedKey(`${from}:${key}:${scope}`);
      setTimeout(() => setPropagatedKey(null), 1400);
    },
    [],
  );

  const onFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      try {
        await onSubmit({ name: name.trim(), notes: notes.trim() || null, perEnv });
        setName('');
        setNotes('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    },
    [onSubmit, name, notes, perEnv],
  );

  return (
    <form onSubmit={onFormSubmit} className="space-y-6" noValidate>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-stone-900">Nouvelle configuration</h3>
          <p className="mt-1 text-xs text-stone-500">
            Renseigne les valeurs des variables. Tu peux propager une valeur de
            PROD vers STAGE/PREVIEW/DEV en un clic via les boutons{' '}
            <span className="rounded bg-[#A8C4A6]/15 px-1 py-0.5 font-mono text-[10px] text-[#3F5B41]">
              broadcast
            </span>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <GtmTemplatePicker onPick={(p) => setPerEnv(p)} />
          <GtmCsvImport
            base={perEnv}
            onApply={(r) => setPerEnv(r.perEnv)}
          />
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">
            Nom de la version
          </span>
          <input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="v1 — pixels initiaux"
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">
            Notes (optionnel)
          </span>
          <input
            type="text"
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Initialisation Pixel Meta production"
            className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left">
              <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-stone-500">
                Variable
              </th>
              {GTM_ENVS.map((env) => (
                <th
                  key={env}
                  className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-stone-500"
                >
                  {env}
                </th>
              ))}
              <th className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {FIELDS.map((field) => (
              <tr key={field.key as string}>
                <td className="py-2 pr-4 align-top">
                  <div className="text-sm text-stone-900">{field.label}</div>
                  {field.hint ? (
                    <div className="mt-0.5 text-[11px] text-stone-400">{field.hint}</div>
                  ) : null}
                </td>
                {GTM_ENVS.map((env) => (
                  <td key={env} className="px-2 py-2 align-top">
                    <input
                      type="text"
                      value={getFieldValue(perEnv[env], field.key)}
                      placeholder={field.placeholder}
                      onChange={update(env, field.key)}
                      className="block w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-xs shadow-sm focus:border-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                    />
                  </td>
                ))}
                <td className="px-1 py-2 align-top text-right">
                  <div className="inline-flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => propagate(field.key, 'production', 'all')}
                      title="Propager la valeur de production vers stage/preview/dev"
                      className="inline-flex items-center gap-1 rounded border border-[#A8C4A6]/40 bg-[#A8C4A6]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#3F5B41] transition hover:bg-[#A8C4A6]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                    >
                      {propagatedKey === `production:${field.key}:all` ? (
                        <IconCheck className="h-3 w-3" />
                      ) : (
                        <IconCopy className="h-3 w-3" />
                      )}
                      Tous
                    </button>
                    <button
                      type="button"
                      onClick={() => propagate(field.key, 'production', 'public')}
                      title="Propager vers stage + preview seulement (skip dev)"
                      className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-700 transition hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                    >
                      {propagatedKey === `production:${field.key}:public` ? (
                        <IconCheck className="h-3 w-3" />
                      ) : (
                        <IconCopy className="h-3 w-3" />
                      )}
                      Pub.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Enregistrement…' : 'Créer la version'}
        </button>
        <p className="text-xs text-stone-500">
          La version créée est ajoutée à l'historique. Elle devient active si
          aucune autre version ne l'est.
        </p>
      </div>
    </form>
  );
}
