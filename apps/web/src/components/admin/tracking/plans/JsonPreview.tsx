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

export function JsonPreview({
  data,
  filename = 'export.json',
  maxHeight = 480,
}: JsonPreviewProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const content = pretty(data);

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

  return (
    <figure className="overflow-hidden rounded-md border border-stone-200 bg-stone-50">
      <figcaption className="flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
        <span>{filename}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-50"
          >
            {copied ? 'Copié' : 'Copier'}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-50"
          >
            Télécharger
          </button>
        </span>
      </figcaption>
      <pre
        className="overflow-auto p-3 text-xs leading-5 text-stone-800"
        style={{ maxHeight }}
        aria-label="Aperçu JSON"
      >
        <code>{content}</code>
      </pre>
    </figure>
  );
}
