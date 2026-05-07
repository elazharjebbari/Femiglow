'use client';

/**
 * CHA-110b — Éditeur de version d'instruction (FR + AR + Darija).
 *
 * Client component pour offrir :
 * - Compteurs de caractères en direct (FR : min 50 / max 20 000)
 * - Marqueur "modifié" + protection contre la perte de saisie
 * - `Cmd/Ctrl + S` pour enregistrer sans quitter la page
 * - Bouton "Activer" séparé (POST _action=activate)
 * - Bouton "Dupliquer" qui crée une nouvelle version basée sur l'édition courante
 *
 * Le formulaire reste form-encoded → le serveur fait toute la validation et
 * la redirection 303 (`?ok=saved`). En cas d'erreur, on relit `?err=...`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { ImportFromFileButton } from './ImportFromFileButton';

type InstructionRow = {
  id: string;
  version: number;
  scope: string;
  body: string;
  bodyAr: string | null;
  bodyArMa: string | null;
  notes: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string; // ISO
};

const FR_MIN = 50;
const FR_MAX = 20_000;
const AR_MAX = 20_000;
const NOTES_MAX = 1_000;

export function InstructionEditor({
  row,
  flash,
}: {
  row: InstructionRow;
  flash: { ok?: string; err?: string };
}) {
  const [body, setBody] = useState(row.body);
  const [bodyAr, setBodyAr] = useState(row.bodyAr ?? '');
  const [bodyArMa, setBodyArMa] = useState(row.bodyArMa ?? '');
  const [notes, setNotes] = useState(row.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(
    () => ({
      body: row.body,
      bodyAr: row.bodyAr ?? '',
      bodyArMa: row.bodyArMa ?? '',
      notes: row.notes ?? '',
    }),
    [row.id, row.body, row.bodyAr, row.bodyArMa, row.notes],
  );

  const dirty =
    body !== initial.body ||
    bodyAr !== initial.bodyAr ||
    bodyArMa !== initial.bodyArMa ||
    notes !== initial.notes;

  const formRef = useRef<HTMLFormElement>(null);

  // Cmd/Ctrl + S → submit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && formRef.current) {
          setSubmitting(true);
          formRef.current.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty]);

  // Beforeunload → empêche de perdre les modifs non sauvegardées
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const bodyValid = body.length >= FR_MIN && body.length <= FR_MAX;

  return (
    <div className="space-y-4">
      {flash.ok && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
        >
          {flashMessage(flash.ok, 'ok')}
        </div>
      )}
      {flash.err && (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800"
        >
          {flashMessage(flash.err, 'err')}
        </div>
      )}

      <form
        ref={formRef}
        method="post"
        action={`/api/admin/chat/instructions/${row.id}`}
        className="space-y-5 rounded-md border border-stone-200 bg-white p-6"
        onSubmit={() => setSubmitting(true)}
      >
        <input type="hidden" name="_action" value="update" />

        <Field
          label={
            <span className="flex items-center gap-2">
              Corps FR
              <Counter value={body.length} min={FR_MIN} max={FR_MAX} />
            </span>
          }
          htmlFor="body"
          hint="Le prompt système principal. 50 à 20 000 caractères."
        >
          <textarea
            id="body"
            name="body"
            required
            minLength={FR_MIN}
            maxLength={FR_MAX}
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-400 ${
              bodyValid ? 'border-stone-300' : 'border-rose-300 bg-rose-50/30'
            }`}
          />
          <div className="mt-2">
            <ImportFromFileButton targetId="body" label="Importer FR depuis un fichier" />
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2">
              Corps AR (RTL)
              <Counter value={bodyAr.length} min={0} max={AR_MAX} optional />
            </span>
          }
          htmlFor="bodyAr"
          hint="Variante en arabe standard moderne. Optionnel."
        >
          <textarea
            id="bodyAr"
            name="bodyAr"
            dir="rtl"
            maxLength={AR_MAX}
            rows={6}
            value={bodyAr}
            onChange={(e) => setBodyAr(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div className="mt-2">
            <ImportFromFileButton targetId="bodyAr" label="Importer AR depuis un fichier" />
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2">
              Corps Darija (latinisé)
              <Counter value={bodyArMa.length} min={0} max={AR_MAX} optional />
            </span>
          }
          htmlFor="bodyArMa"
          hint="Variante en darija marocaine, écrite en alphabet latin. Optionnel."
        >
          <textarea
            id="bodyArMa"
            name="bodyArMa"
            maxLength={AR_MAX}
            rows={6}
            value={bodyArMa}
            onChange={(e) => setBodyArMa(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div className="mt-2">
            <ImportFromFileButton
              targetId="bodyArMa"
              label="Importer Darija depuis un fichier"
            />
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2">
              Notes éditoriales
              <Counter value={notes.length} min={0} max={NOTES_MAX} optional />
            </span>
          }
          htmlFor="notes"
          hint="Mémo interne — ce que vous avez changé, pourquoi."
        >
          <input
            id="notes"
            name="notes"
            type="text"
            maxLength={NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            {dirty ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                Modifications non sauvegardées
              </span>
            ) : (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">
                À jour
              </span>
            )}
            <span className="hidden sm:inline">
              Astuce : <kbd className="rounded border border-stone-300 px-1">⌘/Ctrl</kbd>{' '}
              + <kbd className="rounded border border-stone-300 px-1">S</kbd> pour
              enregistrer.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/chat/instructions"
              className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              Annuler
            </a>
            <button
              type="submit"
              disabled={!dirty || !bodyValid || submitting}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm">
        {!row.enabled && (
          <form
            method="post"
            action={`/api/admin/chat/instructions/${row.id}`}
            className="inline"
          >
            <input type="hidden" name="_action" value="activate" />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Activer cette version
            </button>
          </form>
        )}
        <form
          method="post"
          action={`/api/admin/chat/instructions/${row.id}`}
          className="inline"
        >
          <input type="hidden" name="_action" value="duplicate" />
          {/* On embarque les valeurs courantes pour que le duplicata reflète l'édition non sauvegardée */}
          <input type="hidden" name="body" value={body} />
          <input type="hidden" name="bodyAr" value={bodyAr} />
          <input type="hidden" name="bodyArMa" value={bodyArMa} />
          <input
            type="hidden"
            name="notes"
            value={notes ? `${notes} (basé sur v${row.version})` : `Basé sur v${row.version}`}
          />
          <button
            type="submit"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            title="Crée une nouvelle version (brouillon, non activée) à partir des valeurs ci-dessus."
          >
            Dupliquer comme nouvelle version
          </button>
        </form>
        {row.enabled && (
          <span className="rounded-md bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700">
            Version active
          </span>
        )}
      </div>

      <details className="rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <summary className="cursor-pointer font-medium text-stone-700">
          Métadonnées
        </summary>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          <Meta label="ID" value={row.id} />
          <Meta label="Version" value={`v${row.version}`} />
          <Meta label="Scope" value={row.scope} />
          <Meta label="Créée par" value={row.createdBy} />
          <Meta
            label="Créée le"
            value={new Date(row.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
          />
          <Meta label="Active" value={row.enabled ? 'oui' : 'non'} />
        </dl>
      </details>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function Counter({
  value,
  min,
  max,
  optional,
}: {
  value: number;
  min: number;
  max: number;
  optional?: boolean;
}) {
  const tooShort = !optional && value < min;
  const tooLong = value > max;
  const cls = tooShort || tooLong ? 'text-rose-600' : 'text-stone-500';
  return (
    <span className={`text-[11px] tabular-nums ${cls}`}>
      {value.toLocaleString('fr-FR')} / {max.toLocaleString('fr-FR')}
      {tooShort && ` · min ${min}`}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="font-mono text-stone-700">{value}</dd>
    </>
  );
}

function flashMessage(code: string, kind: 'ok' | 'err'): string {
  if (kind === 'ok') {
    if (code === 'saved') return 'Instruction enregistrée.';
    if (code === 'activated') return 'Version activée.';
    if (code === 'duplicated') return 'Nouvelle version créée à partir de cette version.';
    if (code === 'seeded')
      return 'Nouvelle version par défaut (v2) créée et activée. Tu peux la modifier ci-dessous.';
    if (code === 'seed-activated')
      return 'Version par défaut (v2) déjà présente — réactivée. Tu peux la modifier ci-dessous.';
    return 'Action effectuée.';
  }
  if (code === 'invalid-input') return "Entrée invalide. Vérifie les bornes (FR ≥ 50 caractères).";
  if (code === 'not-found') return 'Version introuvable.';
  if (code === 'activate') return "Échec de l'activation.";
  return `Erreur : ${code}`;
}
