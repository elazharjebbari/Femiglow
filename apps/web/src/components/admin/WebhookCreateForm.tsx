'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const EVENT_OPTIONS = [
  { value: 'lead.created', label: 'Lead créé' },
  { value: 'lead.status_changed', label: 'Statut lead modifié' },
  { value: 'lead.note_added', label: 'Note lead ajoutée' },
  { value: 'order.created', label: 'Commande créée' },
] as const;

type EventValue = (typeof EVENT_OPTIONS)[number]['value'];

export function WebhookCreateForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<EventValue[]>(['lead.created']);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleEvent(v: EventValue) {
    setEvents((prev) => (prev.includes(v) ? prev.filter((e) => e !== v) : [...prev, v]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          events,
          description: description || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { id?: string; secret?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.id || !data.secret) {
        setError(data?.error?.message ?? 'Création impossible');
        return;
      }
      setSecret(data.secret);
      setCreatedId(data.id);
    } finally {
      setSubmitting(false);
    }
  }

  if (secret && createdId) {
    return (
      <div className="space-y-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-900">Endpoint créé.</p>
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-700">
            Secret HMAC (visible une seule fois)
          </p>
          <code className="mt-1 block break-all rounded bg-white px-3 py-2 text-xs">
            {secret}
          </code>
          <p className="mt-2 text-xs text-emerald-800">
            Conservez-le immédiatement. Vous ne pourrez plus le récupérer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.replace('/admin/webhooks')}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          J'ai copié, retour à la liste
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <label className="block">
        <span className="block text-sm font-medium text-stone-700">URL HTTPS</span>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.partner.com/hook"
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-stone-700">Événements</legend>
        <div className="mt-2 space-y-2">
          {EVENT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={events.includes(opt.value)}
                onChange={() => toggleEvent(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="block text-sm font-medium text-stone-700">Description (optionnel)</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={280}
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm shadow-sm"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting || events.length === 0}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {submitting ? 'Création…' : 'Créer l’endpoint'}
      </button>
    </form>
  );
}
