'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { trackingPlanApi, ApiError } from '@/lib/tracking/plan/client';
import type { TrackingPlanInput } from '@/lib/tracking/plan/types';

export interface ExpertEditorProps {
  planId: string;
  initialVersion: number;
  initialDraft: Partial<TrackingPlanInput>;
}

export function ExpertEditor({
  planId,
  initialVersion,
  initialDraft,
}: ExpertEditorProps): JSX.Element {
  const router = useRouter();
  const initialJson = useMemo(() => JSON.stringify(initialDraft, null, 2), [initialDraft]);
  const [raw, setRaw] = useState(initialJson);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSuccess(null);
    let patch: Partial<TrackingPlanInput>;
    try {
      patch = JSON.parse(raw) as Partial<TrackingPlanInput>;
    } catch {
      setError('JSON invalide.');
      return;
    }
    setBusy(true);
    try {
      const updated = await trackingPlanApi.update(planId, patch, initialVersion);
      setSuccess(`Plan mis à jour (v${updated.version}).`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`${e.code} — ${e.message}`);
      } else {
        setError('Erreur inattendue.');
      }
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRaw(initialJson);
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div>
        <label htmlFor="expert-json" className="mb-1 block text-xs font-medium text-stone-500">
          JSON du plan
        </label>
        <textarea
          id="expert-json"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          className="h-[60vh] w-full rounded-md border border-stone-300 bg-stone-50 p-3 font-mono text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Enregistrement…' : 'Enregistrer (If-Match)'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50"
          >
            Reset
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {success}
          </p>
        )}
      </div>

      <aside className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-700">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
          Aide
        </h2>
        <ul className="list-inside list-disc space-y-1 text-xs">
          <li>Champs requis : <code>name</code>, <code>providers</code>, <code>envProfiles</code>, <code>events</code>.</li>
          <li><code>events[].key</code> doit être en snake_case ASCII.</li>
          <li><code>envProfiles</code> doit contenir un profil <code>production</code>.</li>
          <li>L'enregistrement applique If-Match v{initialVersion} ; recharge la page si conflit 409.</li>
          <li>L'activation n'est possible que sur un plan valide (R-001..R-005).</li>
        </ul>
      </aside>
    </div>
  );
}
