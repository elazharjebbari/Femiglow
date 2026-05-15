'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface LeadWebhookSettingsFormProps {
  initialStep2WebhookEnabled: boolean;
  initialStep1AbandonEnabled: boolean;
  initialStep1AbandonTimeoutMinutes: number;
  initialConversationEnabled: boolean;
  initialConversationMaxMessages: number;
  initialConversationMaxBytes: number;
}

interface SettingsResponse {
  settings: {
    leadStep2WebhookEnabled: boolean;
    leadStep1AbandonEnabled: boolean;
    leadStep1AbandonTimeoutMinutes: number;
    leadWebhookConversationEnabled: boolean;
    leadWebhookConversationMaxMessages: number;
    leadWebhookConversationMaxBytes: number;
  };
}

export function LeadWebhookSettingsForm(props: LeadWebhookSettingsFormProps): JSX.Element {
  const router = useRouter();
  const [step2Enabled, setStep2Enabled] = useState(props.initialStep2WebhookEnabled);
  const [abandonEnabled, setAbandonEnabled] = useState(props.initialStep1AbandonEnabled);
  const [timeout, setTimeoutMinutes] = useState(props.initialStep1AbandonTimeoutMinutes);
  const [conversationEnabled, setConversationEnabled] = useState(props.initialConversationEnabled);
  const [maxMessages, setMaxMessages] = useState(props.initialConversationMaxMessages);
  const [maxBytes, setMaxBytes] = useState(props.initialConversationMaxBytes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'ok' | 'err' | null>(null);

  async function save(patch: Record<string, boolean | number>): Promise<void> {
    setSaving(true);
    setMessage(null);
    setTone(null);
    try {
      const res = await fetch('/api/admin/tracking/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SettingsResponse;
      setStep2Enabled(data.settings.leadStep2WebhookEnabled);
      setAbandonEnabled(data.settings.leadStep1AbandonEnabled);
      setTimeoutMinutes(data.settings.leadStep1AbandonTimeoutMinutes);
      setConversationEnabled(data.settings.leadWebhookConversationEnabled);
      setMaxMessages(data.settings.leadWebhookConversationMaxMessages);
      setMaxBytes(data.settings.leadWebhookConversationMaxBytes);
      setTone('ok');
      setMessage('Réglages webhook enregistrés.');
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={step2Enabled}
            disabled={saving}
            onChange={(evt): void => {
              const value = evt.target.checked;
              setStep2Enabled(value);
              void save({ leadStep2WebhookEnabled: value });
            }}
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
          />
          <span className="text-sm text-stone-800">
            <span className="font-medium">Envoyer après validation adresse</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Déclenche `lead.step2_completed` sans bloquer le wizard.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={abandonEnabled}
            disabled={saving}
            onChange={(evt): void => {
              const value = evt.target.checked;
              setAbandonEnabled(value);
              void save({ leadStep1AbandonEnabled: value });
            }}
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
          />
          <span className="text-sm text-stone-800">
            <span className="font-medium">Scanner les abandons step 1</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Le cron envoie `lead.step1_abandoned` après le délai configuré.
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm text-stone-800">
          <span className="font-medium">Délai abandon</span>
          <input
            type="number"
            min={1}
            max={60}
            value={timeout}
            disabled={saving}
            onChange={(evt): void => setTimeoutMinutes(Number(evt.target.value))}
            onBlur={(): void => {
              void save({ leadStep1AbandonTimeoutMinutes: timeout });
            }}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-stone-800">
          <span className="font-medium">Messages conversation</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxMessages}
            disabled={saving || !conversationEnabled}
            onChange={(evt): void => setMaxMessages(Number(evt.target.value))}
            onBlur={(): void => {
              void save({ leadWebhookConversationMaxMessages: maxMessages });
            }}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-stone-800">
          <span className="font-medium">Budget conversation bytes</span>
          <input
            type="number"
            min={1000}
            max={50000}
            value={maxBytes}
            disabled={saving || !conversationEnabled}
            onChange={(evt): void => setMaxBytes(Number(evt.target.value))}
            onBlur={(): void => {
              void save({ leadWebhookConversationMaxBytes: maxBytes });
            }}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={conversationEnabled}
          disabled={saving}
          onChange={(evt): void => {
            const value = evt.target.checked;
            setConversationEnabled(value);
            void save({ leadWebhookConversationEnabled: value });
          }}
          className="mt-0.5 h-4 w-4 rounded border-stone-300"
        />
        <span className="text-sm text-stone-800">
          <span className="font-medium">Inclure le transcript chat</span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Snapshot borné, sans messages system/tool, pour les webhooks lead.
          </span>
        </span>
      </label>

      {message ? (
        <p className={tone === 'ok' ? 'text-xs text-emerald-700' : 'text-xs text-rose-700'} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
