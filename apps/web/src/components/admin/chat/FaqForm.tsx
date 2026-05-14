/**
 * CHA-303 — Formulaire FAQ (création + édition).
 *
 * Form-encoded → POST `/api/admin/chat/faq` (création) ou
 * POST `/api/admin/chat/faq/[id]` (patch). Pas de fetch côté client —
 * la redirection 303 du serveur ramène sur la liste avec un flash.
 *
 * Le seuil utilise un `<input type="range">` doublé d'un input numérique
 * pour précision. Lors de l'édition d'une FAQ existante on warn si la
 * question canonique change (cela déclenche un ré-embed côté serveur).
 */
'use client';

import { useState } from 'react';

import type { ChatLanguage } from '@/lib/chat/contracts';

export interface FaqFormInitial {
  id?: string;
  key: string;
  language: ChatLanguage;
  questionCanonical: string;
  scriptedReply: string;
  intentHint: string;
  threshold: number;
  audience: 'all' | 'b2c' | 'b2b';
  enabled: boolean;
}

const DEFAULTS: FaqFormInitial = {
  key: '',
  language: 'fr',
  questionCanonical: '',
  scriptedReply: '',
  intentHint: '',
  threshold: 0.55,
  audience: 'all',
  enabled: true,
};

export function FaqForm({ initial }: { initial?: Partial<FaqFormInitial> }) {
  const merged: FaqFormInitial = { ...DEFAULTS, ...(initial ?? {}) };
  const isEdit = Boolean(merged.id);
  const [questionCanonical, setQuestionCanonical] = useState(merged.questionCanonical);
  const [threshold, setThreshold] = useState(merged.threshold);
  const questionChanged = isEdit && questionCanonical !== merged.questionCanonical;

  const action = isEdit
    ? `/api/admin/chat/faq/${merged.id}`
    : '/api/admin/chat/faq';

  return (
    <form
      action={action}
      method="POST"
      className="space-y-5 rounded-md border border-stone-200 bg-white p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Clé (slug)" htmlFor="key">
          <input
            id="key"
            name="key"
            type="text"
            defaultValue={merged.key}
            required
            minLength={2}
            maxLength={120}
            pattern="[a-zA-Z0-9\-:_/.]+"
            placeholder="price-pack-fr"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-stone-500">
            Identifiant stable, ex. <code>price-pack-fr</code>. Unique par langue.
          </p>
        </Field>

        <Field label="Langue" htmlFor="language">
          <select
            id="language"
            name="language"
            defaultValue={merged.language}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            required
          >
            <option value="fr">Français</option>
            <option value="ar">Arabe (MSA)</option>
            <option value="ar-MA">Darija (ar-MA)</option>
          </select>
        </Field>
      </div>

      <Field label="Question canonique" htmlFor="questionCanonical">
        <input
          id="questionCanonical"
          name="questionCanonical"
          type="text"
          required
          minLength={3}
          maxLength={500}
          value={questionCanonical}
          onChange={(e) => setQuestionCanonical(e.target.value)}
          placeholder="Combien coûte le pack ?"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
        {questionChanged ? (
          <p className="mt-1 text-xs text-amber-700">
            ⚠ Modifier cette question déclenche un ré-embed côté serveur.
          </p>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            Phrase pivot utilisée pour le calcul d'embedding (cascade L3).
          </p>
        )}
      </Field>

      <Field label="Réponse scriptée" htmlFor="scriptedReply">
        <textarea
          id="scriptedReply"
          name="scriptedReply"
          required
          minLength={3}
          maxLength={4000}
          rows={6}
          defaultValue={merged.scriptedReply}
          placeholder="Le pack FemiGlow coûte 299 MAD…"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-stone-500">
          Réponse renvoyée tel-quel quand le match est validé. Pas de
          variables — utiliser un template SSR si besoin.
        </p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intent hint (optionnel)" htmlFor="intentHint">
          <input
            id="intentHint"
            name="intentHint"
            type="text"
            maxLength={80}
            defaultValue={merged.intentHint}
            placeholder="pricing"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-stone-500">
            Tag intent dérivé (analytique). Sert au routage et aux KPIs.
          </p>
        </Field>

        <Field label="Audience" htmlFor="audience">
          <select
            id="audience"
            name="audience"
            defaultValue={merged.audience}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="all">all</option>
            <option value="b2c">b2c</option>
            <option value="b2b">b2b</option>
          </select>
        </Field>
      </div>

      <Field
        label={
          <span className="flex items-center justify-between gap-2">
            <span>Seuil de match (cosine similarity)</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs tabular-nums">
              {threshold.toFixed(2)}
            </span>
          </span>
        }
        htmlFor="threshold"
      >
        <div className="flex items-center gap-3">
          <input
            id="threshold"
            name="threshold"
            type="range"
            min={0.3}
            max={0.95}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            value={threshold}
            min={0.3}
            max={0.95}
            step={0.01}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm tabular-nums"
          />
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Calibré pour <code>text-embedding-3-small</code> : ~0.55–0.65 pour
          des paraphrases tolérantes, 0.75+ pour des reformulations strictes.
        </p>
      </Field>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="enabled"
          value="true"
          defaultChecked={merged.enabled}
          className="rounded border-stone-300"
        />
        Activée
      </label>

      <div className="flex items-center gap-3 border-t border-stone-200 pt-4">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {isEdit ? 'Enregistrer les modifications' : 'Créer la FAQ'}
        </button>
        <a
          href="/admin/chat/faq"
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          Annuler
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}
