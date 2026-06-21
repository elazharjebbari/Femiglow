'use client';

/**
 * TemplateEditor — split view source HTML | preview iframe (M5.7.8).
 *
 * État local : sujet / preheader / source / customVars JSON.
 * Preview : debounced POST à /api/admin/emails/templates/[id]/preview.
 * Versions : liste à droite, click → restaure (sans saver, à confirmer).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EmailTemplateCustomRow, EmailTemplateCustomVersionRow } from '@/lib/db/schema-emails';
import {
  ConfirmDialog,
  UnsavedChangesGuard,
  formatAbsolute,
  formatAge,
} from '@/components/admin/emails/ui';
import { useTemplateDraft, type TemplateDraftState } from './use-template-draft';
import { useTokenInsertion } from '../common/use-token-insertion';
import { TEMPLATE_VARIABLE_GROUPS, variablesOfGroup } from './template-variables';

export type TemplateEditorProps = {
  template: EmailTemplateCustomRow;
  versions: EmailTemplateCustomVersionRow[];
};

const PREVIEW_DEBOUNCE_MS = 600;

export function TemplateEditor({ template, versions: initialVersions }: TemplateEditorProps) {
  const [subject, setSubject] = useState(template.subjectTmpl);
  const [preheader, setPreheader] = useState(template.preheaderTmpl ?? '');
  const [htmlSource, setHtmlSource] = useState(template.htmlSource);
  const [customVars, setCustomVars] = useState<string>(() =>
    JSON.stringify(template.customVars ?? {}, null, 2),
  );
  const [contextEmail, setContextEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [versions, setVersions] = useState(initialVersions);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = useMemo(
    () =>
      subject !== template.subjectTmpl ||
      preheader !== (template.preheaderTmpl ?? '') ||
      htmlSource !== template.htmlSource ||
      customVars !== JSON.stringify(template.customVars ?? {}, null, 2),
    [subject, preheader, htmlSource, customVars, template],
  );

  // ── Brouillon local (F07 P3.4-b, Lot 1) ───────────────────────────────────
  const serverState = useMemo<TemplateDraftState>(
    () => ({
      subject: template.subjectTmpl,
      preheader: template.preheaderTmpl ?? '',
      htmlSource: template.htmlSource,
      customVars: JSON.stringify(template.customVars ?? {}, null, 2),
    }),
    [template],
  );
  const draft = useTemplateDraft({
    templateId: template.id,
    current: serverState,
    serverUpdatedAt: (template.updatedAt instanceof Date
      ? template.updatedAt
      : new Date(template.updatedAt)
    ).toISOString(),
  });
  // Insertion de variable au CURSEUR dans la source (réutilise le socle G11).
  const sourceInsert = useTokenInsertion<HTMLTextAreaElement>(setHtmlSource);

  // Autosave debounced de la frappe. Le hook SUSPEND tant qu'une restauration
  // n'est pas tranchée ; `didMount` évite une écriture au montage (état serveur).
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    draft.schedule({ subject, preheader, htmlSource, customVars });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, preheader, htmlSource, customVars]);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    let parsedVars: Record<string, unknown> = {};
    try {
      parsedVars = customVars.trim() ? JSON.parse(customVars) : {};
    } catch (err) {
      setPreviewError(`customVars JSON invalide : ${err}`);
      setPreviewLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/emails/templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subjectTmpl: subject,
          preheaderTmpl: preheader,
          htmlSource,
          customVars: parsedVars,
          contextEmail: contextEmail || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPreviewError(data?.error ?? `Preview ${res.status}`);
      } else {
        const data = (await res.json()) as { html: string; subject: string };
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject);
      }
    } catch (err) {
      setPreviewError(String(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [template.id, subject, preheader, htmlSource, customVars, contextEmail]);

  // Debounced preview on source/vars changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refreshPreview();
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshPreview]);

  const handleSaveVersion = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      let parsedVars: Record<string, unknown> = {};
      try {
        parsedVars = customVars.trim() ? JSON.parse(customVars) : {};
      } catch (err) {
        throw new Error(`customVars JSON invalide : ${err}`);
      }
      const res = await fetch(`/api/admin/emails/templates/${template.id}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subjectTmpl: subject,
          preheaderTmpl: preheader,
          htmlSource,
          customVars: parsedVars,
          commitMessage: commitMessage || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      // L'API POST /versions retourne la version créée DIRECTEMENT (cf.
      // app/api/admin/emails/templates/[id]/versions/route.ts → NextResponse.json(version)),
      // pas enveloppée dans { version }. On tolère les deux formes par
      // robustesse, et on n'ajoute JAMAIS une entrée `undefined` à la liste
      // (sinon le rendu `v{v.versionNumber}` crashe).
      const raw = (await res.json()) as
        | EmailTemplateCustomVersionRow
        | { version: EmailTemplateCustomVersionRow };
      const created =
        raw && typeof raw === 'object' && 'version' in raw ? raw.version : (raw as EmailTemplateCustomVersionRow);
      if (!created || typeof created.versionNumber !== 'number') {
        throw new Error('Réponse de version invalide');
      }
      setVersions((prev) => [created, ...prev]);
      setCommitMessage('');
      draft.discardDraft(); // version committée → le brouillon local de récup n'a plus lieu d'être
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Garde « modifications non enregistrées » (nav in-app + fermeture onglet). */}
      <UnsavedChangesGuard isDirty={isDirty} />

      {/* Restauration d'un brouillon local plus récent que la version enregistrée. */}
      <ConfirmDialog
        open={draft.pendingRestore !== null}
        title="Restaurer le brouillon non enregistré ?"
        body={
          draft.pendingRestore ? (
            <p>
              Un brouillon local, plus récent que la dernière version enregistrée (modifié le{' '}
              {formatAbsolute(draft.pendingRestore.savedAt)}), a été trouvé sur ce poste. Le
              restaurer remplacera le contenu actuel de l’éditeur.
            </p>
          ) : null
        }
        confirmLabel="Restaurer le brouillon"
        cancelLabel="Ignorer"
        onConfirm={() => {
          const d = draft.pendingRestore;
          if (d) {
            setSubject(d.data.subject);
            setPreheader(d.data.preheader);
            setHtmlSource(d.data.htmlSource);
            setCustomVars(d.data.customVars);
          }
          draft.restoreResolved();
        }}
        onCancel={() => draft.discardDraft()}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_240px]">
      {/* Left : source editor */}
      <section className="space-y-3 rounded border border-stone-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
            Sujet (template Handlebars)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
            Preheader (optionnel)
          </label>
          <input
            type="text"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
            HTML source ({htmlSource.length.toLocaleString()} car.)
          </label>
          <textarea
            ref={sourceInsert.ref}
            value={htmlSource}
            onChange={(e) => setHtmlSource(e.target.value)}
            className="mt-1 h-[480px] w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono leading-snug"
            spellCheck={false}
          />
        </div>
        <details>
          <summary className="cursor-pointer text-xs font-medium text-stone-500">
            Variables custom (JSON)
          </summary>
          <textarea
            value={customVars}
            onChange={(e) => setCustomVars(e.target.value)}
            className="mt-1 h-32 w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono"
            spellCheck={false}
          />
        </details>
      </section>

      {/* Center : preview iframe */}
      <section className="space-y-3 rounded border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Preview avec contexte
          </label>
          <input
            type="email"
            placeholder="lead@example.com (optionnel)"
            value={contextEmail}
            onChange={(e) => setContextEmail(e.target.value)}
            className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => void refreshPreview()}
            className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            ↻
          </button>
        </div>
        {previewError && (
          <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
            {previewError}
          </div>
        )}
        <div>
          <p className="text-xs text-stone-500">Sujet rendu :</p>
          <p className="font-medium text-stone-900">{previewSubject || <i>—</i>}</p>
        </div>
        <div className="relative h-[520px] overflow-hidden rounded border border-stone-200">
          {previewLoading && (
            <div className="absolute right-2 top-2 z-10 rounded bg-stone-900/80 px-2 py-0.5 text-xs text-white">
              ...
            </div>
          )}
          <iframe
            title="Email preview"
            srcDoc={previewHtml || '<p style="font-family: sans-serif; color: #999; padding: 1rem">Preview chargement…</p>'}
            sandbox="allow-same-origin"
            className="h-full w-full bg-white"
          />
        </div>
      </section>

      {/* Right : panel — variables, versions, save */}
      <aside className="space-y-4">
        <section className="rounded border border-stone-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
            Variables disponibles
          </h3>
          <div className="space-y-2">
            {TEMPLATE_VARIABLE_GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  {group}
                </p>
                <div className="flex flex-wrap gap-1">
                  {variablesOfGroup(group).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => sourceInsert.insert(v.token)}
                      title={v.label}
                      className="rounded bg-stone-100 px-2 py-0.5 text-xs font-mono text-stone-700 hover:bg-stone-200"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-stone-500">
            Cliquer pour insérer à la position du curseur.
          </p>
        </section>

        <section className="rounded border border-stone-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
            Enregistrer
          </h3>
          <input
            type="text"
            placeholder="Message de commit (optionnel)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
          />
          {saveError && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">
              {saveError}
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveVersion}
            disabled={saving || !isDirty}
            className="mt-2 w-full rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {saving ? '...' : isDirty ? 'Créer une version' : 'Aucun changement'}
          </button>
          <p data-testid="tpl-draft-status" className="mt-2 text-[10px] text-stone-500">
            {draft.status === 'saved' && draft.savedAt
              ? `✓ Brouillon local enregistré ${formatAge(draft.savedAt)}`
              : '🖫 Sauvegarde locale automatique'}
          </p>
        </section>

        <section className="rounded border border-stone-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
            Versions ({versions.length})
          </h3>
          <ul className="space-y-1 text-xs">
            {versions.length === 0 && <li className="text-stone-400">Aucune version</li>}
            {versions.slice(0, 20).map((v, i) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-stone-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !confirm(
                        `Restaurer la version v${v.versionNumber} ? Vos changements en cours seront remplacés.`,
                      )
                    )
                      return;
                    setSubject(v.subjectTmpl);
                    setPreheader(v.preheaderTmpl ?? '');
                    setHtmlSource(v.htmlSource);
                    setCustomVars(JSON.stringify(v.customVars ?? {}, null, 2));
                  }}
                  className="flex-1 text-left text-stone-700 hover:underline"
                >
                  v{v.versionNumber} {i === 0 && '(actuelle)'}
                </button>
                <span className="text-[10px] text-stone-400">
                  {new Date(v.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
      </div>
    </>
  );
}
