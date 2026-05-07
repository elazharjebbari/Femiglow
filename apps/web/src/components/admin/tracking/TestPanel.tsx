'use client';

import { useEffect, useState } from 'react';

interface EventDefinitionDto {
  id: string;
  name: string;
  category: string;
  description: string;
  isConversion: boolean;
}

interface TestOutcome {
  dispatched?: string[];
  results?: Record<
    string,
    { status: string; latencyMs?: number; httpStatus?: number; error?: string; attempts?: number }
  >;
  dryRun?: boolean;
  ctx?: { eventId?: string };
}

export function TestPanel() {
  const [definitions, setDefinitions] = useState<EventDefinitionDto[]>([]);
  const [eventName, setEventName] = useState('purchase');
  const [paramsRaw, setParamsRaw] = useState(
    JSON.stringify(
      {
        transaction_id: 'tx_test_admin',
        currency: 'MAD',
        value: 199,
        items: [{ item_id: 'sku_test', item_name: 'Soin test', quantity: 1, price: 199 }],
      },
      null,
      2,
    ),
  );
  const [identityRaw, setIdentityRaw] = useState(
    JSON.stringify({ email: 'test@femiglow.ma' }, null, 2),
  );
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<TestOutcome | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/tracking/events', { cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as { definitions: EventDefinitionDto[] }) : null))
      .then((j) => {
        if (j) setDefinitions(j.definitions);
      })
      .catch(() => undefined);
  }, []);

  async function send(): Promise<void> {
    setBusy(true);
    setErrorMsg(null);
    setOutcome(null);
    try {
      let params: Record<string, unknown> = {};
      let identity: Record<string, unknown> | undefined;
      try {
        params = paramsRaw.trim() ? (JSON.parse(paramsRaw) as Record<string, unknown>) : {};
      } catch {
        throw new Error('Params : JSON invalide');
      }
      try {
        identity = identityRaw.trim()
          ? (JSON.parse(identityRaw) as Record<string, unknown>)
          : undefined;
      } catch {
        throw new Error('Identity : JSON invalide');
      }
      const r = await fetch('/api/admin/tracking/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventName,
          params,
          identity,
          dryRun,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as TestOutcome;
      setOutcome(j);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
            Event
          </span>
          <select
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          >
            {definitions.length === 0 ? (
              <option value={eventName}>{eventName}</option>
            ) : (
              definitions.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} — {d.category}
                  {d.isConversion ? ' ✦' : ''}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
            Params (JSON)
          </span>
          <textarea
            value={paramsRaw}
            onChange={(e) => setParamsRaw(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-xs"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
            Identity (JSON, optionnel)
          </span>
          <textarea
            value={identityRaw}
            onChange={(e) => setIdentityRaw(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 font-mono text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4"
          />
          Mode dry-run (n’envoie rien aux pixels)
        </label>
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? 'Envoi…' : dryRun ? 'Simuler' : 'Envoyer aux pixels'}
        </button>
        {errorMsg ? <p className="text-sm text-rose-700">Erreur : {errorMsg}</p> : null}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
          Résultat
        </h3>
        {!outcome ? (
          <p className="text-sm text-stone-500">
            Sélectionne un event et clique pour tester le dispatch.
          </p>
        ) : (
          <div className="space-y-3">
            {outcome.dryRun ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Dry-run : aucun appel réseau. eventId = {outcome.ctx?.eventId}
              </p>
            ) : (
              <>
                <p className="text-xs text-stone-600">
                  eventId : <span className="font-mono">{outcome.ctx?.eventId}</span>
                </p>
                <p className="text-xs text-stone-600">
                  Dispatched : {(outcome.dispatched ?? []).join(', ') || '(aucun)'}
                </p>
                <div className="overflow-hidden rounded-md border border-stone-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-2 py-1.5">Provider</th>
                        <th className="px-2 py-1.5">Statut</th>
                        <th className="px-2 py-1.5">HTTP</th>
                        <th className="px-2 py-1.5">Latence</th>
                        <th className="px-2 py-1.5">Erreur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {Object.entries(outcome.results ?? {}).map(([kind, r]) => (
                        <tr key={kind}>
                          <td className="px-2 py-1.5 font-medium">{kind}</td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                r.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'skipped'
                                    ? 'bg-stone-100 text-stone-700'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-mono">{r.httpStatus ?? '—'}</td>
                          <td className="px-2 py-1.5">{r.latencyMs ?? '—'} ms</td>
                          <td className="px-2 py-1.5 text-rose-700">{r.error ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
