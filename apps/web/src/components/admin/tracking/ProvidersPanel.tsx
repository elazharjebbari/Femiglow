'use client';

import { useEffect, useState } from 'react';

interface ProviderDto {
  id: string;
  kind: string;
  status: 'enabled' | 'disabled' | 'error';
  pixelId: string | null;
  hasCapiToken: boolean;
  testEventCode: string | null;
  customHead: string | null;
  customBody: string | null;
  config: Record<string, unknown>;
  enabledEvents: string[];
  lastEventAt: string | null;
  errorCount24h: number;
  lastError: string | null;
}

const ALL_KINDS = [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
] as const;

const KIND_LABELS: Record<string, string> = {
  meta: 'Meta (Facebook/Instagram)',
  tiktok: 'TikTok',
  google_ads: 'Google Ads',
  google_ga4: 'Google Analytics 4',
  snap: 'Snapchat',
  pinterest: 'Pinterest',
  gtm: 'Google Tag Manager',
  custom: 'Custom HTML',
};

export function ProvidersPanel() {
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/tracking/providers', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { providers: ProviderDto[] };
      setProviders(j.providers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function toggleProvider(provider: ProviderDto): Promise<void> {
    const next = provider.status === 'enabled' ? 'disabled' : 'enabled';
    const r = await fetch(`/api/admin/tracking/providers/${provider.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (!r.ok) {
      alert('Erreur lors du toggle');
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-stone-500">Chargement…</p>;
  if (error) return <p className="text-sm text-red-700">Erreur : {error}</p>;

  const byKind = new Map(providers.map((p) => [p.kind, p]));

  return (
    <div className="space-y-3">
      {ALL_KINDS.map((kind) => {
        const p = byKind.get(kind);
        return (
          <div
            key={kind}
            className="rounded-md border border-stone-200 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-stone-900">{KIND_LABELS[kind]}</h3>
                <p className="text-xs text-stone-500">
                  {p
                    ? `Pixel : ${p.pixelId ?? '—'} · CAPI : ${p.hasCapiToken ? 'oui' : 'non'} · Events activés : ${p.enabledEvents.length}`
                    : 'Non configuré'}
                </p>
                {p?.lastError ? (
                  <p className="mt-1 text-xs text-rose-700">Dernière erreur : {p.lastError}</p>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  p?.status === 'enabled'
                    ? 'bg-emerald-100 text-emerald-800'
                    : p?.status === 'error'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-stone-100 text-stone-700'
                }`}
              >
                {p?.status ?? 'absent'}
              </span>
              {p ? (
                <button
                  type="button"
                  onClick={() => toggleProvider(p)}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs hover:bg-stone-50"
                >
                  {p.status === 'enabled' ? 'Désactiver' : 'Activer'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setEditing(editing === kind ? null : kind)}
                className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800"
              >
                {editing === kind ? 'Fermer' : p ? 'Modifier' : 'Configurer'}
              </button>
            </div>
            {editing === kind ? (
              <ProviderEditor
                kind={kind}
                provider={p ?? null}
                onSaved={async () => {
                  setEditing(null);
                  await load();
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProviderEditor({
  kind,
  provider,
  onSaved,
}: {
  kind: string;
  provider: ProviderDto | null;
  onSaved: () => Promise<void>;
}) {
  const [pixelId, setPixelId] = useState(provider?.pixelId ?? '');
  const [capiToken, setCapiToken] = useState('');
  const [testEventCode, setTestEventCode] = useState(provider?.testEventCode ?? '');
  const [enabledEvents, setEnabledEvents] = useState((provider?.enabledEvents ?? []).join(', '));
  const [customHead, setCustomHead] = useState(provider?.customHead ?? '');
  const [customBody, setCustomBody] = useState(provider?.customBody ?? '');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    const body: Record<string, unknown> = {
      pixelId: pixelId.trim() || null,
      testEventCode: testEventCode.trim() || null,
      enabledEvents: enabledEvents
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (capiToken.trim()) body.capiToken = capiToken.trim();
    if (kind === 'custom') {
      body.customHead = customHead || null;
      body.customBody = customBody || null;
    }
    try {
      const url = provider
        ? `/api/admin/tracking/providers/${provider.id}`
        : '/api/admin/tracking/providers';
      const method = provider ? 'PATCH' : 'POST';
      if (!provider) body.kind = kind;
      const r = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      await onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 grid gap-3 border-t border-stone-200 pt-4 text-sm">
      {kind !== 'custom' ? (
        <Field label="Pixel / Mesurement ID">
          <input
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-1.5"
            placeholder={kind === 'gtm' ? 'GTM-XXXX' : kind === 'google_ga4' ? 'G-XXXX' : 'pixel_id'}
          />
        </Field>
      ) : null}
      {kind !== 'gtm' && kind !== 'custom' ? (
        <Field
          label="CAPI Token (chiffré côté serveur)"
          hint={provider?.hasCapiToken ? 'Token déjà enregistré. Laisser vide pour ne pas modifier.' : undefined}
        >
          <input
            type="password"
            value={capiToken}
            onChange={(e) => setCapiToken(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono"
            placeholder="••••••••"
          />
        </Field>
      ) : null}
      {kind === 'meta' ? (
        <Field label="Test Event Code (Meta)">
          <input
            value={testEventCode}
            onChange={(e) => setTestEventCode(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-1.5"
            placeholder="TEST12345"
          />
        </Field>
      ) : null}
      <Field label="Events activés (séparés par virgules)" hint="Vide = tous les events supportés">
        <input
          value={enabledEvents}
          onChange={(e) => setEnabledEvents(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-xs"
          placeholder="page_view, purchase, generate_lead"
        />
      </Field>
      {kind === 'custom' ? (
        <>
          <Field label="Custom Head (HTML/JS injecté en <head>)">
            <textarea
              value={customHead}
              onChange={(e) => setCustomHead(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-xs"
            />
          </Field>
          <Field label="Custom Body (HTML/JS injecté en fin de <body>)">
            <textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-xs"
            />
          </Field>
          <p className="text-xs text-amber-700">
            ⚠ Validation : pas d’eval, pas de document.cookie, https only, max 50 ko.
          </p>
        </>
      ) : null}
      {errorMsg ? <p className="text-xs text-rose-700">Erreur : {errorMsg}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}
