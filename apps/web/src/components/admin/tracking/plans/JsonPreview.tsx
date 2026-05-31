/**
 * Aperçu JSON read-only avec bouton « Copier » et « Télécharger ».
 *
 * Utilisé pour le container GTM exporté ainsi que pour le payload diff.
 */
'use client';

import { useState } from 'react';

export interface JsonPreviewProps {
  data: unknown;
  filename?: string;
  maxHeight?: number;
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ko`;
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

export function JsonPreview({
  data,
  filename = 'export.json',
  maxHeight = 480,
}: JsonPreviewProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const content = pretty(data);
  const sizeBytes = new Blob([content]).size;
  const lineCount = content.split('\n').length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function download() {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // `min-w-0` est crucial : sans ça, dans un parent flex/grid, le contenu
  // monospace très large pousse la figure au-delà du conteneur (la
  // valeur par défaut `min-width: auto` empêche le rétrécissement).
  return (
    <figure className="min-w-0 w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-50 shadow-sm">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2.5 text-xs text-stone-600">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-5 items-center rounded bg-stone-100 px-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-stone-600">
            JSON
          </span>
          <span className="truncate font-mono text-stone-700">{filename}</span>
          <span className="hidden text-stone-400 sm:inline">·</span>
          <span className="hidden text-stone-500 sm:inline">
            {formatBytes(sizeBytes)} · {lineCount} lignes
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            {copied ? '✓ Copié' : 'Copier'}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded border border-stone-300 bg-stone-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-stone-800"
          >
            Télécharger
          </button>
        </div>
      </figcaption>
      <pre
        className="overflow-auto p-4 font-mono text-[12px] leading-relaxed text-stone-800"
        style={{ maxHeight, tabSize: 2 }}
        aria-label="Aperçu JSON"
      >
        <code className="whitespace-pre">{content}</code>
      </pre>
    </figure>
  );
}
