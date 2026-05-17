'use client';

import { useState } from 'react';
import type { TrackingProviderKind } from '@/lib/db/types';

interface CapiTokenFieldProps {
  kind: TrackingProviderKind;
  hasToken: boolean;
  hasEnvToken: boolean;
}

export function CapiTokenField({ kind, hasToken, hasEnvToken }: CapiTokenFieldProps) {
  const [newValue, setNewValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [showEnvBanner, setShowEnvBanner] = useState(hasEnvToken);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localHasToken, setLocalHasToken] = useState(hasToken);

  async function handleReveal() {
    if (revealed) {
      setRevealed(false);
      setRevealedValue(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/tracking/providers/${kind}/reveal-token`);
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setRevealedValue(data.capiToken ?? '');
      setRevealed(true);
    } catch {
      setError('Impossible de révéler le token');
    }
  }

  async function handleCopy() {
    if (!revealed || !revealedValue) {
      await handleReveal();
      // After reveal, we'll need to copy. Let's reveal first then copy.
      const res = await fetch(`/api/admin/tracking/providers/${kind}/reveal-token`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.capiToken ?? '');
      setMessage('Token copié');
    } else {
      await navigator.clipboard.writeText(revealedValue);
      setMessage('Token copié');
    }
  }

  async function handleSave() {
    if (!newValue.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tracking/providers/${kind}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capiToken: newValue.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? `Erreur ${res.status}`);
      }
      setLocalHasToken(true);
      setNewValue('');
      setMessage('Token CAPI enregistré');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tracking/providers/${kind}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capiToken: null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? `Erreur ${res.status}`);
      }
      setLocalHasToken(false);
      setRevealed(false);
      setRevealedValue(null);
      setMessage('Token CAPI supprimé');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setClearing(false);
    }
  }

  async function handleUseEnvToken() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tracking/providers/env-reveal?kind=${kind}`);
      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      if (!data.token) {
        setError('Aucun token trouvé dans .env');
        return;
      }
      setNewValue(data.token);
      setShowEnvBanner(false);
    } catch {
      setError('Impossible de récupérer le token .env');
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-stone-700">Token CAPI</label>

      {/* Current token status */}
      {localHasToken && (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-mono">
            {revealed ? (
              <span className="break-all select-all">{revealedValue}</span>
            ) : (
              <span className="text-stone-400">••••••••••••</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleReveal}
            className="rounded-md border border-stone-300 px-2 py-2 text-xs text-stone-700 hover:bg-stone-100"
            title={revealed ? 'Masquer' : 'Révéler'}
          >
            {revealed ? '🙈' : '👁'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-stone-300 px-2 py-2 text-xs text-stone-700 hover:bg-stone-100"
            title="Copier"
          >
            📋
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing}
            className="rounded-md border border-red-300 px-2 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
            title="Supprimer le token"
          >
            {clearing ? '…' : 'Effacer'}
          </button>
        </div>
      )}

      {/* New token input */}
      <div className="flex gap-2">
        <input
          type="password"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={localHasToken ? 'Nouveau token (laisser vide pour conserver)' : 'Coller le token CAPI'}
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !newValue.trim()}
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>

      {/* Env suggestion banner */}
      {showEnvBanner && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <span className="text-amber-600 text-sm">⚡</span>
          <div className="text-sm">
            <p className="text-amber-900">
              Un token CAPI est disponible dans <code className="bg-amber-100 px-1 rounded text-xs">.env</code> (<code className="bg-amber-100 px-1 rounded text-xs">SNAP_CAPI_TOKEN</code>).
            </p>
            <button
              type="button"
              onClick={handleUseEnvToken}
              className="mt-1 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              Utiliser ce token
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}