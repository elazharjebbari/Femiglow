'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Zone {
  key: string;
  label: string;
  isRequired: boolean;
}

interface TemplateVar {
  key: string;
  value: string | null;
  isRequired: boolean;
}

interface WizardProps {
  zones: Zone[];
  templateVars: TemplateVar[];
}

type Step = 1 | 2 | 3 | 4 | 5;

const VAR_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const PRESET_KEYS = new Set(['LAST_UPDATED', 'CURRENT_YEAR', 'SITE_URL']);

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: 'Identité' },
  { id: 2, label: 'Contenu' },
  { id: 3, label: 'Placements' },
  { id: 4, label: 'Variables' },
  { id: 5, label: 'Aperçu & soumission' },
];

export function LegalWizard({ zones, templateVars }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bodyMd, setBodyMd] = useState('# Titre\n\nContenu de la page.');
  const [includeInSearch, setIncludeInSearch] = useState(false);
  const [zoneSelections, setZoneSelections] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugError = useMemo(() => {
    if (!slug) return 'Slug requis';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Caractères autorisés : a-z, 0-9, -';
    if (slug.length < 2 || slug.length > 80) return 'Entre 2 et 80 caractères';
    return null;
  }, [slug]);

  const titleError = useMemo(() => {
    if (!title) return 'Titre requis';
    if (title.length < 3) return 'Au moins 3 caractères';
    return null;
  }, [title]);

  const descriptionError = useMemo(() => {
    if (description.length > 200) return 'Max 200 caractères';
    return null;
  }, [description]);

  const missingVars = useMemo(() => {
    const used = new Set<string>();
    for (const m of bodyMd.matchAll(VAR_PATTERN)) used.add(m[1]!);
    const byKey = new Map(templateVars.map((v) => [v.key, v]));
    const missing: string[] = [];
    for (const key of used) {
      if (PRESET_KEYS.has(key)) continue;
      const v = byKey.get(key);
      if (!v) missing.push(key);
      else if (v.isRequired && (!v.value || v.value.trim() === '')) missing.push(key);
    }
    return missing;
  }, [bodyMd, templateVars]);

  const step1Valid = !slugError && !titleError && !descriptionError;
  const step2Valid = bodyMd.length >= 10;
  const requiredZones = zones.filter((z) => z.isRequired);
  const step3Valid = requiredZones.every((z) => zoneSelections[z.key]);

  function canAdvance(s: Step): boolean {
    if (s === 1) return step1Valid;
    if (s === 2) return step2Valid;
    if (s === 3) return step3Valid;
    if (s === 4) return missingVars.length === 0;
    return true;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title,
          description: description || null,
          bodyMd,
          includeInSearch,
        }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          setError('Ce slug est déjà utilisé.');
          setStep(1);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      }
      // Étape suivante : crée les placements en série
      const selectedZones = Object.entries(zoneSelections)
        .filter(([_, v]) => v)
        .map(([k]) => k);
      for (const zoneKey of selectedZones) {
        await fetch('/api/admin/legal/placements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageSlug: slug, zoneKey, isVisible: true }),
        });
      }
      router.push(`/admin/legal/${slug}/edit`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <ol className="mb-6 flex gap-2 text-xs" aria-label="Étapes du wizard">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={`flex-1 border-b-2 pb-1 ${
              step === s.id
                ? 'border-stone-900 font-semibold text-stone-900'
                : step > s.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-stone-200 text-stone-400'
            }`}
            aria-current={step === s.id ? 'step' : undefined}
          >
            {s.id}. {s.label}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-stone-600">Slug</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mentions-legales"
              className="mt-1 w-full border border-stone-300 px-3 py-2 text-sm"
            />
            {slugError ? <span className="text-xs text-red-700">{slugError}</span> : null}
            <span className="block text-xs text-stone-500">
              URL : /legal/{slug || '<slug>'}
            </span>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-stone-600">Titre</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border border-stone-300 px-3 py-2 text-sm"
            />
            {titleError ? <span className="text-xs text-red-700">{titleError}</span> : null}
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-stone-600">
              Description (max 200)
            </span>
            <input
              type="text"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border border-stone-300 px-3 py-2 text-sm"
            />
            {descriptionError ? (
              <span className="text-xs text-red-700">{descriptionError}</span>
            ) : null}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInSearch}
              onChange={(e) => setIncludeInSearch(e.target.checked)}
            />
            Autoriser l&apos;indexation Google (par défaut : non)
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="mb-2 text-xs text-stone-500">
            Markdown supporté : titres, listes, liens. Utilise{' '}
            <code className="bg-stone-100 px-1">{`{{COMPANY_NAME}}`}</code> pour
            insérer une variable.
          </p>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            spellCheck={false}
            className="h-[50vh] w-full resize-y border border-stone-300 p-3 font-mono text-sm"
          />
          {bodyMd.length < 10 ? (
            <p className="mt-1 text-xs text-red-700">Au moins 10 caractères requis.</p>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2">
          <p className="text-xs text-stone-500">
            Coche les zones où cette page doit apparaître. Les zones marquées (★)
            sont obligatoires.
          </p>
          {zones.map((z) => (
            <label key={z.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={zoneSelections[z.key] ?? false}
                onChange={(e) =>
                  setZoneSelections((prev) => ({ ...prev, [z.key]: e.target.checked }))
                }
              />
              <span>
                {z.label} {z.isRequired ? <span className="text-red-600">★</span> : null}
                <span className="ml-1 font-mono text-xs text-stone-500">{z.key}</span>
              </span>
            </label>
          ))}
          {!step3Valid ? (
            <p className="mt-1 text-xs text-amber-700">
              Au moins une zone obligatoire n&apos;est pas cochée.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div>
          {missingVars.length === 0 ? (
            <p className="text-sm text-emerald-700">
              ✓ Toutes les variables référencées dans le contenu sont remplies.
            </p>
          ) : (
            <div>
              <p className="text-sm text-amber-800">
                Variables référencées dans le contenu mais non remplies :
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs text-stone-700">
                {missingVars.map((k) => (
                  <li key={k}>
                    <code>{k}</code>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-stone-500">
                Tu peux soit retirer les références dans le contenu (étape 2),
                soit remplir les variables dans{' '}
                <a href="/admin/legal/template-vars" className="underline">
                  Variables de template
                </a>{' '}
                puis recharger ce wizard.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {step === 5 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Récapitulatif</h3>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Slug :</dt> <dd className="inline">/legal/{slug}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Titre :</dt> <dd className="inline">{title}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Indexable :</dt>{' '}
              <dd className="inline">{includeInSearch ? 'oui' : 'non (noindex)'}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Zones :</dt>{' '}
              <dd className="inline">
                {Object.entries(zoneSelections)
                  .filter(([_, v]) => v)
                  .map(([k]) => k)
                  .join(', ') || '(aucune)'}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Variables manquantes :</dt>{' '}
              <dd className="inline">
                {missingVars.length === 0 ? 'aucune' : missingVars.join(', ')}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-stone-500">
            La page sera créée en <strong>draft</strong>. Tu pourras éditer le contenu, vérifier la preview,
            puis publier depuis l&apos;éditeur.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || submitting}
          className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-40"
        >
          ← Précédent
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            disabled={!canAdvance(step)}
            className="bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-40"
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {submitting ? 'Création…' : 'Créer la page (draft)'}
          </button>
        )}
      </div>
    </div>
  );
}
