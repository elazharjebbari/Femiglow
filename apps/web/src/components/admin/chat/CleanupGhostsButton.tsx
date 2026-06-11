'use client';
/**
 * CHA-LEAD-V2 — Bouton cleanup ghosts avec preview + confirmation.
 *
 * Flow :
 *  1. Click "Prévisualiser" → POST dryRun=true → affiche count candidates.
 *  2. Click "Confirmer" → POST dryRun=false → archive les rows.
 *  3. État "done" avec count archived.
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/03-frontend-ui-ux/components.md
 */
import { useState } from 'react';

type Step = 'idle' | 'confirming' | 'done';

interface CleanupResponse {
  candidates: number;
  archived: number;
  dryRun: boolean;
  criteria: {
    olderThanDays: number;
    kinds: string[];
    withoutLead: true;
  };
}

export function CleanupGhostsButton(): JSX.Element {
  const [step, setStep] = useState<Step>('idle');
  const [candidates, setCandidates] = useState<number>(0);
  const [archived, setArchived] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function call(dryRun: boolean): Promise<CleanupResponse> {
    const res = await fetch('/api/admin/chat/cleanup-ghosts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun, olderThanDays: 30 }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? json.error ?? 'Erreur');
    return json as CleanupResponse;
  }

  async function handlePreview(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await call(true);
      setCandidates(result.candidates);
      setStep('confirming');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await call(false);
      setArchived(result.archived);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel(): void {
    setStep('idle');
    setCandidates(0);
    setError(null);
  }

  return (
    <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
      <h3 className="text-sm font-medium text-stone-900">
        Cleanup ghosts orphelins
      </h3>
      <p className="mt-1 text-xs text-stone-600">
        Archive les sessions wizard sans lead lié plus vieilles que 30 jours.
        Action réversible (status=&apos;archived&apos;, pas de DELETE).
      </p>

      {error && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </div>
      )}

      {step === 'idle' && (
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading}
          className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? 'Calcul…' : 'Prévisualiser'}
        </button>
      )}

      {step === 'confirming' && (
        <div
          role="alertdialog"
          aria-labelledby="cleanup-confirm-title"
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3"
        >
          <p id="cleanup-confirm-title" className="text-sm text-amber-900">
            <strong>{candidates}</strong> ghost session{candidates > 1 ? 's' : ''}{' '}
            seront archivées.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Archivage…' : 'Confirmer'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          ✓ {archived} session{archived > 1 ? 's' : ''} archivée{archived > 1 ? 's' : ''}.
          <button
            type="button"
            onClick={() => setStep('idle')}
            className="ml-3 underline-offset-2 hover:underline"
          >
            Relancer
          </button>
        </div>
      )}
    </div>
  );
}
