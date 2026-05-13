/**
 * CHA-300 — Formulaire SuggestionPill / canned-pair (création + édition).
 *
 * Pas de re-embed : la cascade L2 matche par `key` exacte, donc modifier
 * un label ou une réponse n'impacte aucun index vectoriel.
 *
 * 3 langues obligatoires (FR / AR / AR-MA) car la SuggestionPill s'affiche
 * dans la langue de session — une traduction manquante = pill vide.
 */
'use client';

import { useState } from 'react';

type Audience = 'all' | 'b2c' | 'b2b';
type Status = 'draft' | 'review' | 'published' | 'archived';

export interface SuggestionFormInitial {
  id?: string;
  key: string;
  pagePattern: string;
  audience: Audience;
  order: number;
  enabled: boolean;
  labelFr: string;
  labelAr: string;
  labelArMa: string;
  scriptedReplyFr: string;
  scriptedReplyAr: string;
  scriptedReplyArMa: string;
  ctaLabel: string;
  ctaUrl: string;
  allowFollowupLlm: boolean;
  status: Status;
}

const DEFAULTS: SuggestionFormInitial = {
  key: '',
  pagePattern: '*',
  audience: 'all',
  order: 100,
  enabled: true,
  labelFr: '',
  labelAr: '',
  labelArMa: '',
  scriptedReplyFr: '',
  scriptedReplyAr: '',
  scriptedReplyArMa: '',
  ctaLabel: '',
  ctaUrl: '',
  allowFollowupLlm: false,
  status: 'draft',
};

export function SuggestionForm({
  initial,
}: {
  initial?: Partial<SuggestionFormInitial>;
}) {
  const merged: SuggestionFormInitial = { ...DEFAULTS, ...(initial ?? {}) };
  const isEdit = Boolean(merged.id);
  const [activeLang, setActiveLang] = useState<'fr' | 'ar' | 'ar-MA'>('fr');

  const action = isEdit
    ? `/api/admin/chat/suggestions/${merged.id}`
    : '/api/admin/chat/suggestions';

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
            maxLength={80}
            pattern="[a-zA-Z0-9\-:_/.]+"
            placeholder="pricing-pack"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-stone-500">
            Identifiant stable utilisé par <code>POST /api/chat/canned-pair/{'{key}'}</code>.
          </p>
        </Field>

        <Field label="Page pattern" htmlFor="pagePattern">
          <input
            id="pagePattern"
            name="pagePattern"
            type="text"
            defaultValue={merged.pagePattern}
            required
            maxLength={120}
            placeholder="/kit/*"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-stone-500">
            <code>*</code> = toutes pages, <code>/kit</code> = exact,
            <code> /kit/*</code> = kit + descendants.
          </p>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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

        <Field label="Ordre" htmlFor="order">
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            max={9999}
            step={1}
            defaultValue={merged.order}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm tabular-nums"
          />
          <p className="mt-1 text-xs text-stone-500">Tri asc. (plus petit = en haut).</p>
        </Field>

        <Field label="Statut" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={merged.status}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="draft">draft</option>
            <option value="review">review</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </Field>
      </div>

      {/* Tabs langue --------------------------------------------------------- */}
      <div>
        <div className="flex gap-1 border-b border-stone-200">
          {(['fr', 'ar', 'ar-MA'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveLang(lang)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                activeLang === lang
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {lang === 'fr' ? 'Français' : lang === 'ar' ? 'العربية' : 'الدارجة'}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          <LangPane
            lang="fr"
            active={activeLang === 'fr'}
            labelInitial={merged.labelFr}
            replyInitial={merged.scriptedReplyFr}
          />
          <LangPane
            lang="ar"
            active={activeLang === 'ar'}
            labelInitial={merged.labelAr}
            replyInitial={merged.scriptedReplyAr}
          />
          <LangPane
            lang="ar-MA"
            active={activeLang === 'ar-MA'}
            labelInitial={merged.labelArMa}
            replyInitial={merged.scriptedReplyArMa}
          />
        </div>
      </div>

      {/* CTA optionnel ------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 border-t border-stone-200 pt-5">
        <Field label="CTA label (optionnel)" htmlFor="ctaLabel">
          <input
            id="ctaLabel"
            name="ctaLabel"
            type="text"
            maxLength={60}
            defaultValue={merged.ctaLabel}
            placeholder="Voir le pack"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="CTA URL (optionnel)" htmlFor="ctaUrl">
          <input
            id="ctaUrl"
            name="ctaUrl"
            type="text"
            maxLength={2048}
            defaultValue={merged.ctaUrl}
            placeholder="/kit"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:gap-6">
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
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="allowFollowupLlm"
            value="true"
            defaultChecked={merged.allowFollowupLlm}
            className="rounded border-stone-300"
          />
          Autoriser un follow-up LLM
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-stone-200 pt-4">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {isEdit ? 'Enregistrer les modifications' : 'Créer la suggestion'}
        </button>
        <a
          href="/admin/chat/suggestions"
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          Annuler
        </a>
      </div>
    </form>
  );
}

function LangPane({
  lang,
  active,
  labelInitial,
  replyInitial,
}: {
  lang: 'fr' | 'ar' | 'ar-MA';
  active: boolean;
  labelInitial: string;
  replyInitial: string;
}) {
  const labelName =
    lang === 'fr' ? 'labelFr' : lang === 'ar' ? 'labelAr' : 'labelArMa';
  const replyName =
    lang === 'fr'
      ? 'scriptedReplyFr'
      : lang === 'ar'
        ? 'scriptedReplyAr'
        : 'scriptedReplyArMa';
  const dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
  return (
    <div className={active ? 'space-y-3' : 'hidden'} dir={dir}>
      <Field label={`Label (pill) — ${lang}`} htmlFor={labelName}>
        <input
          id={labelName}
          name={labelName}
          type="text"
          required
          minLength={1}
          maxLength={120}
          defaultValue={labelInitial}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </Field>
      <Field label={`Réponse scriptée — ${lang}`} htmlFor={replyName}>
        <textarea
          id={replyName}
          name={replyName}
          required
          minLength={3}
          maxLength={4000}
          rows={5}
          defaultValue={replyInitial}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </Field>
    </div>
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
