'use client';

import { useState } from 'react';
import { ValidationDiffViewer } from './ValidationDiffViewer';
import type { PairValidationResult } from '@/lib/tracking/gtm/sentinel-schemas';

type Loaded = { name: string; json: unknown };

export function ValidatePairWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [configFile, setConfigFile] = useState<Loaded | null>(null);
  const [mappingFile, setMappingFile] = useState<Loaded | null>(null);
  const [result, setResult] = useState<PairValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1);
    setConfigFile(null);
    setMappingFile(null);
    setResult(null);
    setError(null);
  };

  const handleConfigFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setConfigFile({ name: file.name, json });
    } catch {
      setError('Le fichier de config n\'est pas un JSON valide.');
    }
  };

  const handleMappingFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setMappingFile({ name: file.name, json });
    } catch {
      setError('Le fichier de mapping n\'est pas un JSON valide.');
    }
  };

  const submit = async () => {
    if (!configFile || !mappingFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tracking/gtm/validate-pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ configJson: configFile.json, mappingJson: mappingFile.json }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as PairValidationResult;
      setResult(json);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="validate-pair-wizard">
      <Stepper current={step} />
      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <StepCard
          stepNumber={1}
          title="Configuration GTM"
          hint="Ce fichier contient les tags, triggers, variables (la structure GTM)."
        >
          <FileDropzone
            id="config-dropzone"
            label="Drop config-vN.json ici"
            accept=".json,application/json"
            loaded={configFile}
            onChange={handleConfigFile}
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!configFile}
              onClick={() => setStep(2)}
              data-testid="btn-next-step"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Suivant : Mapping →
            </button>
          </div>
        </StepCard>
      ) : null}

      {step === 2 ? (
        <StepCard
          stepNumber={2}
          title="Mapping vendors"
          hint="Ce fichier mappe chaque event canonique vers son nom vendor."
        >
          <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✅ Config chargée : <span className="font-mono">{configFile?.name}</span>
          </p>
          <FileDropzone
            id="mapping-dropzone"
            label="Drop mapping-vN.json ici"
            accept=".json,application/json"
            loaded={mappingFile}
            onChange={handleMappingFile}
          />
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
            >
              ← Retour
            </button>
            <button
              type="button"
              disabled={!mappingFile || submitting}
              onClick={() => void submit()}
              data-testid="btn-validate"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {submitting ? 'Validation…' : 'Valider la cohérence →'}
            </button>
          </div>
        </StepCard>
      ) : null}

      {step === 3 && result ? (
        <div className="space-y-4">
          <ValidationDiffViewer result={result} />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
            >
              ← Recommencer
            </button>
            <a
              href="/admin/tracking/gtm/sync-status"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              Aller au Sync Status →
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Config GTM' },
    { n: 2, label: 'Mapping' },
    { n: 3, label: 'Validation' },
  ];
  return (
    <ol className="flex items-center gap-4 text-xs text-stone-500">
      {steps.map((s) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className={`flex items-center gap-2 ${active ? 'font-medium text-stone-900' : ''}`}>
            <span
              aria-hidden="true"
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'
              }`}
            >
              {done ? '✓' : s.n}
            </span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

function StepCard({
  stepNumber,
  title,
  hint,
  children,
}: {
  stepNumber: 1 | 2;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <h3 className="text-base font-semibold text-stone-900">Étape {stepNumber} / 3 — {title}</h3>
      <p className="mt-1 text-xs text-stone-600">{hint}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FileDropzone({
  id,
  label,
  accept,
  loaded,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  loaded: Loaded | null;
  onChange: (f: File | null) => void | Promise<void>;
}) {
  return (
    <label
      htmlFor={id}
      className="block cursor-pointer rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center hover:bg-stone-100"
    >
      <input
        id={id}
        data-testid={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => void onChange(e.target.files?.[0] ?? null)}
      />
      {loaded ? (
        <span className="text-sm text-emerald-700">✅ {loaded.name}</span>
      ) : (
        <>
          <span className="block text-3xl">📦</span>
          <span className="mt-1 block text-sm font-medium text-stone-700">{label}</span>
          <span className="block text-xs text-stone-500">ou clique pour sélectionner</span>
        </>
      )}
    </label>
  );
}
