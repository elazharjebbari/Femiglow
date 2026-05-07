'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ConsentBannerSettingsFormProps {
  initialBannerEnabled: boolean;
  initialDefaultGranted: boolean;
}

export function ConsentBannerSettingsForm({
  initialBannerEnabled,
  initialDefaultGranted,
}: ConsentBannerSettingsFormProps): JSX.Element {
  const router = useRouter();
  const [bannerEnabled, setBannerEnabled] = useState(initialBannerEnabled);
  const [defaultGranted, setDefaultGranted] = useState(initialDefaultGranted);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'ok' | 'err' | null>(null);

  async function save(next: {
    consentBannerEnabled?: boolean;
    consentDefaultGranted?: boolean;
  }): Promise<void> {
    setSaving(true);
    setMessage(null);
    setTone(null);
    try {
      const res = await fetch('/api/admin/tracking/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        settings: { consentBannerEnabled: boolean; consentDefaultGranted: boolean };
      };
      setBannerEnabled(data.settings.consentBannerEnabled);
      setDefaultGranted(data.settings.consentDefaultGranted);
      setTone('ok');
      setMessage('Réglages enregistrés.');
      router.refresh();
    } catch (err) {
      setTone('err');
      setMessage(err instanceof Error ? err.message : 'Échec de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-4 rounded-md border border-stone-200 bg-white p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={bannerEnabled}
          disabled={saving}
          onChange={(evt): void => {
            const value = evt.target.checked;
            setBannerEnabled(value);
            void save({ consentBannerEnabled: value });
          }}
          className="mt-0.5 h-4 w-4 rounded border-stone-300"
        />
        <span className="text-sm text-stone-800">
          <span className="font-medium">Afficher le bandeau de consentement</span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Désactiver pour les juridictions sans obligation cookie (Maroc, certains États
            US, etc.). Quand le bandeau est désactivé, l’état de consentement est piloté
            par le réglage ci-dessous.
          </span>
        </span>
      </label>

      <label
        className={`flex items-start gap-3 ${
          bannerEnabled ? 'opacity-50' : ''
        }`}
      >
        <input
          type="checkbox"
          checked={defaultGranted}
          disabled={saving || bannerEnabled}
          onChange={(evt): void => {
            const value = evt.target.checked;
            setDefaultGranted(value);
            void save({ consentDefaultGranted: value });
          }}
          className="mt-0.5 h-4 w-4 rounded border-stone-300"
        />
        <span className="text-sm text-stone-800">
          <span className="font-medium">
            Consentement accordé par défaut (sans bandeau)
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Sans effet quand le bandeau est affiché. Si activé, tous les events partent
            immédiatement (analytics + pub) ; sinon ils restent en denied jusqu’à
            opt-in explicite.
          </span>
        </span>
      </label>

      {message ? (
        <p
          className={`text-xs ${
            tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
