'use client';

import { useState, useMemo } from 'react';

interface Props {
  json: string;
}

const MAX_LINES_PREVIEW = 400;

/**
 * Preview pretty-printed du container.json.
 *
 * Implémentation V1 minimaliste : `<pre>` avec line numbers en gutter,
 * affichage tronqué au-delà de 400 lignes (avec un bouton « tout voir »).
 *
 * Le syntax highlighting Shiki SSR est prévu en GTM-EXP-007 mais
 * sort du scope V1 pour éviter de tirer ~ 1 Mo de payload.
 */
export function GtmJsonPreview({ json }: Props) {
  const lines = useMemo(() => json.split('\n'), [json]);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? lines : lines.slice(0, MAX_LINES_PREVIEW);
  const truncated = !showAll && lines.length > MAX_LINES_PREVIEW;

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50">
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2 text-xs">
        <span className="font-mono text-stone-500">
          container.json · {lines.length.toLocaleString('fr-FR')} lignes
        </span>
        {lines.length > MAX_LINES_PREVIEW ? (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="rounded px-2 py-1 text-stone-700 hover:bg-stone-100"
          >
            {showAll ? 'Replier' : `Voir tout (${lines.length})`}
          </button>
        ) : null}
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <pre className="grid grid-cols-[auto_1fr] font-mono text-xs leading-5">
          <div className="select-none border-r border-stone-200 bg-white px-3 py-3 text-right text-stone-400">
            {visible.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
            {truncated ? <div>…</div> : null}
          </div>
          <code className="block whitespace-pre px-3 py-3 text-stone-800">
            {visible.join('\n')}
            {truncated ? `\n\n… ${lines.length - MAX_LINES_PREVIEW} lignes masquées` : ''}
          </code>
        </pre>
      </div>
    </div>
  );
}
