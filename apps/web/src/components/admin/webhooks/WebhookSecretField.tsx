'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CopyButton } from '@/components/admin/products/CopyButton';
import { IconCheck, IconEye, IconEyeOff, IconRefresh } from '@/components/admin/icons';

interface WebhookSecretFieldProps {
  endpointId: string;
  initialSecret: string;
}

export function WebhookSecretField({ endpointId, initialSecret }: WebhookSecretFieldProps) {
  const router = useRouter();
  const [secret, setSecret] = useState(initialSecret);
  const [savedSecret, setSavedSecret] = useState(initialSecret);
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = secret !== savedSecret;
  const canSave = dirty && secret.trim().length >= 8 && !saving;

  async function saveSecret() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/webhooks/${endpointId}/secret`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = (await res.json().catch(() => null)) as
        | { secret?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.secret) {
        setError(data?.error?.message ?? 'Mise à jour impossible');
        return;
      }
      setSecret(data.secret);
      setSavedSecret(data.secret);
      setMessage('Secret mis à jour');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function rotateSecret() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/webhooks/${endpointId}/rotate-secret`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => null)) as
        | { secret?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.secret) {
        setError(data?.error?.message ?? 'Rotation impossible');
        return;
      }
      setSecret(data.secret);
      setSavedSecret(data.secret);
      setVisible(true);
      setMessage('Nouveau secret généré');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Secret HMAC</p>
          <p className="mt-0.5 text-xs text-stone-600">
            Utilisé pour signer le corps JSON plat dans <code>X-Webhook-Signature</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton
            text={secret}
            label="Copier"
            className="inline-flex h-8 items-center rounded-md border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            title={visible ? 'Masquer le secret' : 'Afficher le secret'}
            aria-label={visible ? 'Masquer le secret' : 'Afficher le secret'}
          >
            {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <input
          type={visible ? 'text' : 'password'}
          value={secret}
          onChange={(event) => {
            setSecret(event.target.value);
            setMessage(null);
            setError(null);
          }}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveSecret}
            disabled={!canSave}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <IconCheck className="h-3.5 w-3.5" />
            Enregistrer
          </button>
          <button
            type="button"
            onClick={rotateSecret}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <IconRefresh className="h-3.5 w-3.5" />
            Régénérer
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-xs font-medium text-emerald-700">{message}</p> : null}
    </div>
  );
}
