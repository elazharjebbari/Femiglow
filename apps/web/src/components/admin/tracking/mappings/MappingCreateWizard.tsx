'use client';

import { useState } from 'react';
import { mappingsClient, MappingApiError } from '@/lib/admin/mappings-client';
import type { Mappings, MappingVersionListItem } from '@/lib/tracking/mappings/types';

/**
 * Wizard 3 étapes pour créer une nouvelle version.
 * cf. docs/event-mappings/40-frontend/component-wizard.json
 *     docs/event-mappings/50-ui-ux-design/wireframes/editor-version.txt
 */
type Step = 1 | 2 | 3;
type Source = { kind: 'default' } | { kind: 'clone'; sourceId: string } | { kind: 'import'; mappings: Mappings };

export function MappingCreateWizard(props: {
  existingVersions: MappingVersionListItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<Source | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cloneCandidates = props.existingVersions.filter((v) => v.status !== 'deleted');

  const canNextStep1 = !!source && (source.kind !== 'clone' || !!source.sourceId);
  const canNextStep2 = name.trim().length > 0;

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const mappings = parsed.mappings ?? parsed; // tolère soit { mappings: {...} } soit la matrice directe
      setSource({ kind: 'import', mappings: mappings as Mappings });
    } catch (e) {
      setError("Fichier JSON invalide");
    }
  }

  async function handleSubmit() {
    if (!source) return;
    setSubmitting(true);
    setError(null);
    try {
      await mappingsClient.create({ name: name.trim(), notes: notes.trim() || null, source });
      props.onCreated();
    } catch (err) {
      if (err instanceof MappingApiError) setError(err.message);
      else setError('Erreur création');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-start justify-between">
          <h2 id="wizard-title" className="text-lg font-semibold">Créer une nouvelle version — étape {step}/3</h2>
          <button onClick={props.onClose} aria-label="Fermer" className="text-stone-400 hover:text-stone-900">×</button>
        </header>

        {error ? <div role="alert" className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

        {step === 1 ? (
          <section className="space-y-3" data-testid="wizard-step-1">
            <p className="text-sm text-stone-600">D'où démarrer la nouvelle version ?</p>
            <label className="flex items-start gap-2 rounded border border-stone-200 p-3 hover:bg-stone-50">
              <input type="radio" name="source" checked={source?.kind === 'default'} onChange={() => setSource({ kind: 'default' })} />
              <div>
                <div className="text-sm font-medium">Depuis le mapping FemiGlow par défaut</div>
                <div className="text-xs text-stone-500">Repart de zéro avec le factory.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 rounded border border-stone-200 p-3 hover:bg-stone-50">
              <input
                type="radio"
                name="source"
                checked={source?.kind === 'clone'}
                onChange={() => setSource({ kind: 'clone', sourceId: '' })}
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Cloner une version existante</div>
                <div className="text-xs text-stone-500">Démarre avec les valeurs d'une autre version.</div>
                {source?.kind === 'clone' ? (
                  <select
                    className="mt-2 block w-full rounded border border-stone-300 px-2 py-1 text-xs"
                    value={source.sourceId}
                    onChange={(e) => setSource({ kind: 'clone', sourceId: e.target.value })}
                  >
                    <option value="">— Choisir une source —</option>
                    {cloneCandidates.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.status})</option>
                    ))}
                  </select>
                ) : null}
              </div>
            </label>
            <label className="flex items-start gap-2 rounded border border-stone-200 p-3 hover:bg-stone-50">
              <input
                type="radio"
                name="source"
                checked={source?.kind === 'import'}
                onChange={() => setSource({ kind: 'import', mappings: {} })}
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Importer depuis un fichier JSON</div>
                {source?.kind === 'import' ? (
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="mt-2 block text-xs"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }}
                  />
                ) : null}
              </div>
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3" data-testid="wizard-step-2">
            <label className="block">
              <span className="block text-xs font-medium text-stone-700">Nom de la version *</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="v4 — campagne Q2 2026"
                maxLength={120}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-stone-700">Notes (optionnel)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-2 text-sm" data-testid="wizard-step-3">
            <div><span className="font-medium">Source :</span> {source?.kind}</div>
            <div><span className="font-medium">Nom :</span> {name}</div>
            {notes ? <div><span className="font-medium">Notes :</span> {notes}</div> : null}
            <p className="rounded bg-stone-50 px-3 py-2 text-xs text-stone-600">
              La version sera créée en mode <strong>draft</strong>. Active-la depuis la liste pour la mettre en production.
            </p>
          </section>
        ) : null}

        <footer className="mt-6 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1) as Step)} className="text-sm text-stone-600 hover:text-stone-900">
                ← Retour
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={props.onClose} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Annuler</button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(3, s + 1) as Step)}
                disabled={step === 1 ? !canNextStep1 : !canNextStep2}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Continuer →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="wizard-submit"
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {submitting ? 'Création…' : '✓ Créer la version'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
