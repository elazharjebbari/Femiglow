'use client';

import { useEffect, useState } from 'react';

interface HistoryEntry {
  id: string;
  version: number;
  published_at: string;
  published_by: string | null;
  title: string;
  body_md_excerpt: string;
  git_commit_sha: string | null;
}

interface DiffHunk {
  fromStart: number;
  toStart: number;
  lines: Array<{ op: 'equal' | 'add' | 'remove'; text: string }>;
}

interface DiffResponse {
  from: { version: number; publishedAt: string };
  to: { version: number; publishedAt: string };
  added: number;
  removed: number;
  hunks: DiffHunk[];
}

interface Props {
  slug: string;
  currentVersion: number;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export function LegalHistoryDrawer({ slug, currentVersion, open, onClose, onRestored }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedV, setSelectedV] = useState<number | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch(`/api/admin/legal/${slug}/history`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as HistoryEntry[];
      })
      .then(setEntries)
      .catch((err) => setError((err as Error).message));
  }, [open, slug]);

  useEffect(() => {
    if (!selectedV) {
      setDiff(null);
      return;
    }
    setDiffLoading(true);
    fetch(`/api/admin/legal/${slug}/diff/${selectedV}/${currentVersion}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as DiffResponse;
      })
      .then(setDiff)
      .catch((err) => setError((err as Error).message))
      .finally(() => setDiffLoading(false));
  }, [selectedV, slug, currentVersion]);

  async function handleRestore(version: number) {
    if (!confirm(`Restaurer la version v${version} ? La page repassera en draft.`)) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/admin/legal/${slug}/restore/${version}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onRestored();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoring(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-history-title"
      className="fixed inset-0 z-40 flex"
    >
      <div className="grow bg-stone-900/40" onClick={onClose} aria-hidden="true" />
      <aside className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 p-4">
          <h2 id="legal-history-title" className="text-base font-semibold">
            Historique — {slug} (courant : v{currentVersion})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-stone-500 hover:text-stone-800"
            aria-label="Fermer l'historique"
          >
            ✕
          </button>
        </header>

        {error ? (
          <div className="m-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="flex flex-1 overflow-hidden">
          <ul className="w-64 shrink-0 overflow-y-auto border-r border-stone-200">
            {entries === null && !error ? (
              <li className="p-4 text-xs text-stone-500">Chargement…</li>
            ) : null}
            {entries && entries.length === 0 ? (
              <li className="p-4 text-xs text-stone-500">Aucune version historisée.</li>
            ) : null}
            {entries?.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedV(e.version)}
                  className={`block w-full border-b border-stone-100 px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                    selectedV === e.version ? 'bg-stone-100' : ''
                  }`}
                >
                  <div className="font-medium">v{e.version}</div>
                  <div className="text-xs text-stone-500">
                    {new Date(e.published_at).toLocaleString('fr-FR')}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {selectedV === null ? (
              <p className="text-stone-500">
                Sélectionne une version pour voir le diff par rapport à la version courante.
              </p>
            ) : diffLoading ? (
              <p className="text-stone-500">Calcul du diff…</p>
            ) : diff ? (
              <DiffView diff={diff} />
            ) : null}

            {selectedV !== null && selectedV !== currentVersion ? (
              <button
                type="button"
                onClick={() => handleRestore(selectedV)}
                disabled={restoring}
                className="mt-4 bg-stone-900 px-3 py-1.5 text-xs text-white hover:bg-stone-800 disabled:opacity-40"
              >
                {restoring ? 'Restauration…' : `Restaurer v${selectedV}`}
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DiffView({ diff }: { diff: DiffResponse }) {
  return (
    <div>
      <p className="mb-2 text-xs text-stone-500">
        v{diff.from.version} → v{diff.to.version} ·{' '}
        <span className="text-emerald-700">+{diff.added}</span>{' '}
        <span className="text-red-700">−{diff.removed}</span>
      </p>
      {diff.hunks.length === 0 ? (
        <p className="text-xs text-stone-500">Aucun changement.</p>
      ) : (
        diff.hunks.map((h, idx) => (
          <pre
            key={`${h.fromStart}-${h.toStart}-${idx}`}
            className="mb-3 overflow-x-auto bg-stone-50 p-2 font-mono text-xs"
          >
            <div className="text-stone-400">
              @@ -{h.fromStart} +{h.toStart} @@
            </div>
            {h.lines.map((line, i) => (
              <div
                key={i}
                className={
                  line.op === 'add'
                    ? 'bg-emerald-50 text-emerald-900'
                    : line.op === 'remove'
                      ? 'bg-red-50 text-red-900'
                      : 'text-stone-700'
                }
              >
                {line.op === 'add' ? '+ ' : line.op === 'remove' ? '- ' : '  '}
                {line.text || ' '}
              </div>
            ))}
          </pre>
        ))
      )}
    </div>
  );
}
