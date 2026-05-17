'use client';

import { useState } from 'react';
import type { TrackingProviderKind, TrackingProviderStatus } from '@/lib/db/types';
import { CapiTokenField } from './CapiTokenField';

const ID_RULES: Record<TrackingProviderKind, { pattern: RegExp; placeholder: string; hint: string }> = {
  snap: { pattern: /^[a-f0-9-]{32,36}$/i, placeholder: '9bd26a82-3ecf-42aa-a3de-...', hint: 'UUID Snap Pixel' },
  meta: { pattern: /^\d{10,17}$/, placeholder: '1234567890123456', hint: 'ID numérique Meta Pixel' },
  tiktok: { pattern: /^[A-Z0-9]{15,25}$/i, placeholder: 'ABCDEFGHIJKLMNO', hint: 'ID TikTok Pixel' },
  google_ga4: { pattern: /^G-[A-Z0-9]{8,12}$/, placeholder: 'G-ABC123DEF', hint: 'Measurement ID GA4' },
  google_ads: { pattern: /^AW-\d{6,12}$/, placeholder: 'AW-123456789', hint: 'Conversion ID Google Ads' },
  pinterest: { pattern: /^\d{10,15}$/, placeholder: '1234567890123', hint: 'Ad Account ID Pinterest' },
  gtm: { pattern: /^GTM-[A-Z0-9]{6,10}$/, placeholder: 'GTM-ABCDEF', hint: 'Container ID GTM' },
  custom: { pattern: /.+/, placeholder: 'custom-provider-id', hint: 'Identifiant libre' },
};

interface ProviderConfigCardProps {
  kind: TrackingProviderKind;
  provider: {
    status: TrackingProviderStatus;
    pixelId: string | null;
    hasCapiToken: boolean;
    testEventCode: string | null;
    enabledEvents: string[];
    lastEventAt: string | null;
    errorCount24h: number;
    lastError: string | null;
    updatedAt: string;
  } | null;
  label: string;
  hasCapi: boolean;
  hasEnvSnapToken: boolean;
}

export function ProviderConfigCard({ kind, provider, label, hasCapi, hasEnvSnapToken }: ProviderConfigCardProps) {
  const [status, setStatus] = useState<TrackingProviderStatus>(provider?.status ?? 'disabled');
  const [pixelId, setPixelId] = useState(provider?.pixelId ?? '');
  const [testEventCode, setTestEventCode] = useState(provider?.testEventCode ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPixel, setSavingPixel] = useState(false);
  const [savingTestCode, setSavingTestCode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = status === 'enabled';
  const rule = ID_RULES[kind];
  const pixelIdValid = !pixelId || rule.pattern.test(pixelId);

  async function patchProvider(patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/tracking/providers/${kind}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? `Erreur ${res.status}`);
    }
    return res.json();
  }

  async function handleStatusToggle() {
    setSavingStatus(true);
    setError(null);
    try {
      const next = isEnabled ? 'disabled' : 'enabled';
      const data = await patchProvider({ status: next });
      setStatus(data.status);
      setMessage(next === 'enabled' ? 'Provider activé' : 'Provider désactivé');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handlePixelIdSave() {
    if (!pixelIdValid) {
      setError('Format de pixel ID invalide');
      return;
    }
    setSavingPixel(true);
    setError(null);
    try {
      await patchProvider({ pixelId: pixelId || null });
      setMessage('Pixel ID enregistré');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingPixel(false);
    }
  }

  async function handleTestEventCodeSave() {
    setSavingTestCode(true);
    setError(null);
    try {
      await patchProvider({ testEventCode: testEventCode || null });
      setMessage('Code event test enregistré');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingTestCode(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-stone-900">{label}</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {isEnabled ? 'Activé' : 'Désactivé'}
          </span>
          {provider?.errorCount24h ? (
            <span className="text-xs text-red-600">
              {provider.errorCount24h} erreurs/24h
            </span>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={handleStatusToggle}
          disabled={savingStatus}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
            isEnabled ? 'bg-emerald-600' : 'bg-stone-300'
          } ${savingStatus ? 'opacity-50' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {message && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded px-3 py-2">{message}</p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 rounded px-3 py-2">{error}</p>
        )}

        {/* Pixel ID */}
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            {kind === 'google_ga4' ? 'Measurement ID' : kind === 'gtm' ? 'Container ID' : 'Pixel ID'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder={rule.placeholder}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                pixelIdValid ? 'border-stone-300' : 'border-red-400'
              } focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900`}
            />
            <button
              type="button"
              onClick={handlePixelIdSave}
              disabled={savingPixel || !pixelIdValid}
              className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPixel ? '…' : 'Enregistrer'}
            </button>
          </div>
          <p className="mt-1 text-xs text-stone-500">{rule.hint}</p>
        </div>

        {/* CAPI Token */}
        {hasCapi && (
          <CapiTokenField
            kind={kind}
            hasToken={provider?.hasCapiToken ?? false}
            hasEnvToken={hasEnvSnapToken}
          />
        )}

        {!hasCapi && (
          <p className="text-xs text-stone-500 italic">CAPI non applicable pour ce provider.</p>
        )}

        {/* Test Event Code */}
        {hasCapi && (
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Code event test <span className="font-normal text-stone-500">(optionnel)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value)}
                placeholder="SNAP-TEST-001"
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900"
              />
              <button
                type="button"
                onClick={handleTestEventCodeSave}
                disabled={savingTestCode}
                className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTestCode ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* Last event info */}
        {provider?.lastEventAt && (
          <div className="text-xs text-stone-500">
            Dernier event : {new Date(provider.lastEventAt).toLocaleString('fr-FR')}
          </div>
        )}
      </div>
    </div>
  );
}