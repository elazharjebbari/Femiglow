'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LegalHistoryDrawer } from './LegalHistoryDrawer';

interface TemplateVar {
  key: string;
  value: string | null;
  isRequired: boolean;
}

interface Placement {
  zoneKey: string;
  isVisible: boolean;
  displayOrder: number;
  labelOverride: string | null;
}

interface LegalEditorProps {
  slug: string;
  initialTitle: string;
  initialDescription: string;
  initialBodyMd: string;
  initialIncludeInSearch: boolean;
  status: string;
  version: number;
  /**
   * Timestamp (ms epoch) au moment du chargement, sert d'ETag pour
   * l'optimistic locking. Envoyé dans `If-Match` sur PATCH ; en cas de
   * 409, on affiche un modal "page modifiée par un autre admin".
   */
  initialUpdatedAtMs: number;
  templateVars: TemplateVar[];
  placements: Placement[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const VAR_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const PRESET_KEYS = new Set(['LAST_UPDATED', 'CURRENT_YEAR', 'SITE_URL']);

function substituteForPreview(md: string, vars: TemplateVar[]): string {
  const map = new Map<string, string>();
  for (const v of vars) if (v.value) map.set(v.key, v.value);
  map.set('LAST_UPDATED', new Date().toLocaleDateString('fr-FR'));
  map.set('CURRENT_YEAR', String(new Date().getFullYear()));
  map.set('SITE_URL', '');
  return md.replace(VAR_PATTERN, (_full, k: string) => {
    const v = map.get(k);
    if (v) return v;
    return `[${k}]`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function simpleMdToHtml(md: string): string {
  // Minimal client-side preview renderer (no remote call).
  // The authoritative renderer (sanitized, GFM) runs server-side at publish.
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function LegalEditor(props: LegalEditorProps) {
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const [bodyMd, setBodyMd] = useState(props.initialBodyMd);
  const [includeInSearch, setIncludeInSearch] = useState(props.initialIncludeInSearch);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [version, setVersion] = useState(props.version);
  const [status, setStatus] = useState(props.status);
  const [updatedAtMs, setUpdatedAtMs] = useState(props.initialUpdatedAtMs);
  const [conflict, setConflict] = useState<{ currentUpdatedAt?: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshot = useRef({
    title: props.initialTitle,
    description: props.initialDescription,
    bodyMd: props.initialBodyMd,
    includeInSearch: props.initialIncludeInSearch,
  });

  const missingVars = useMemo(() => {
    const used = [...bodyMd.matchAll(VAR_PATTERN)].map((m) => m[1]!);
    const byKey = new Map(props.templateVars.map((v) => [v.key, v]));
    const missing: string[] = [];
    for (const key of new Set(used)) {
      if (PRESET_KEYS.has(key)) continue;
      const v = byKey.get(key);
      if (!v) { missing.push(key); continue; }
      if (v.isRequired && (!v.value || v.value.trim() === '')) missing.push(key);
    }
    return missing;
  }, [bodyMd, props.templateVars]);

  const previewHtml = useMemo(() => {
    return simpleMdToHtml(substituteForPreview(bodyMd, props.templateVars));
  }, [bodyMd, props.templateVars]);

  const isDirty = useMemo(() => {
    const s = initialSnapshot.current;
    return (
      title !== s.title ||
      description !== s.description ||
      bodyMd !== s.bodyMd ||
      includeInSearch !== s.includeInSearch
    );
  }, [title, description, bodyMd, includeInSearch]);

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/admin/legal/${props.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': `W/"${updatedAtMs}"`,
        },
        body: JSON.stringify({
          title,
          description: description || null,
          body_md: bodyMd,
          include_in_search: includeInSearch,
        }),
      });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { currentUpdatedAt?: string };
        };
        const ts = data.error?.currentUpdatedAt
          ? new Date(data.error.currentUpdatedAt).getTime()
          : undefined;
        setConflict({ currentUpdatedAt: ts });
        setSaveState('error');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { version: number; updated_at: string };
      const newMs = new Date(data.updated_at).getTime();
      initialSnapshot.current = { title, description, bodyMd, includeInSearch };
      setVersion(data.version);
      setUpdatedAtMs(newMs);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('legal-editor save', err);
      setSaveState('error');
    }
  }, [props.slug, title, description, bodyMd, includeInSearch, updatedAtMs]);

  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void save();
    }, 30_000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, save]);

  async function publish() {
    setPublishError(null);
    try {
      const res = await fetch(`/api/admin/legal/${props.slug}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: publishConfirm }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
          missing?: string[];
        };
        if (data.missing) {
          setPublishError(`Variables manquantes : ${data.missing.join(', ')}`);
        } else {
          setPublishError(data.error?.message ?? `HTTP ${res.status}`);
        }
        return;
      }
      const data = (await res.json()) as { version: number };
      setVersion(data.version);
      setStatus('published');
      setShowPublishModal(false);
      setPublishConfirm('');
    } catch (err) {
      setPublishError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-stone-600">Titre</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full border border-stone-300 px-3 py-2 text-sm"
          />
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
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={includeInSearch}
          onChange={(e) => setIncludeInSearch(e.target.checked)}
        />
        Inclure dans le sitemap / autoriser l&apos;indexation Google
      </label>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
            <span className="uppercase tracking-wider">Markdown</span>
            <span>
              {saveState === 'saving' ? 'Enregistrement…' : null}
              {saveState === 'saved' ? '✓ Enregistré' : null}
              {saveState === 'error' ? '⚠ Erreur de sauvegarde' : null}
            </span>
          </div>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            spellCheck={false}
            className="h-[60vh] w-full resize-y border border-stone-300 bg-white p-3 font-mono text-sm leading-relaxed"
          />
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-stone-500">
            Aperçu (preview client simplifiée)
          </div>
          <div
            className="h-[60vh] overflow-y-auto border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || saveState === 'saving'}
          className="bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-40"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={() => setShowPublishModal(true)}
          disabled={status === 'published' && !isDirty}
          className="border border-emerald-700 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
        >
          Publier
        </button>
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
        >
          Historique
        </button>
        <span className="ml-auto text-xs text-stone-500">
          v{version} · {status}
        </span>
      </div>

      <LegalHistoryDrawer
        slug={props.slug}
        currentVersion={version}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestored={() => {
          // Recharge la page : restore réécrit body_md + status='draft'
          // côté serveur, on reflète en rechargeant.
          window.location.reload();
        }}
      />

      <details className="mt-6 border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer text-stone-700">
          Placements ({props.placements.length})
        </summary>
        <ul className="mt-3 space-y-1 text-xs text-stone-600">
          {props.placements.map((p) => (
            <li key={p.zoneKey}>
              <code>{p.zoneKey}</code> · ordre {p.displayOrder}{' '}
              {p.isVisible ? '· visible' : '· caché'}
              {p.labelOverride ? ` · label: ${p.labelOverride}` : ''}
            </li>
          ))}
        </ul>
      </details>

      {conflict ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-conflict-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
        >
          <div className="w-full max-w-md bg-white p-6">
            <h2 id="legal-conflict-title" className="text-lg font-semibold text-stone-900">
              Conflit de version
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Cette page a été modifiée par un autre admin pendant que tu
              éditais. Tes changements locaux sont conservés, mais tu dois
              recharger pour récupérer la dernière version, puis re-saisir.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflict(null)}
                className="border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
              >
                Ignorer
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800"
              >
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPublishModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
        >
          <div className="w-full max-w-md bg-white p-6">
            <h2 className="text-lg font-semibold text-stone-900">Publier {props.slug} ?</h2>
            <p className="mt-2 text-sm text-stone-600">
              Cette action crée un snapshot immuable dans l&apos;historique et passe la page en{' '}
              <strong>published</strong> (v{version + 1}).
            </p>
            {missingVars.length > 0 ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                ⚠ {missingVars.length} variable(s) manquante(s) : {missingVars.join(', ')}
              </div>
            ) : null}
            <label className="mt-3 block text-sm text-stone-700">
              Tape <strong>PUBLIER</strong> pour confirmer :
              <input
                type="text"
                value={publishConfirm}
                onChange={(e) => setPublishConfirm(e.target.value)}
                className="mt-1 w-full border border-stone-300 px-2 py-1 text-sm"
              />
            </label>
            {publishError ? (
              <div className="mt-2 text-xs text-red-700">{publishError}</div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPublishModal(false);
                  setPublishConfirm('');
                  setPublishError(null);
                }}
                className="border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={publishConfirm !== 'PUBLIER'}
                className="bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                Publier maintenant
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
