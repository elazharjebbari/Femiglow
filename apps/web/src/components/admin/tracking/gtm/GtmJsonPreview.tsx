'use client';

import { useState, useMemo } from 'react';
import { IconExpand } from './GtmIcons';

interface Props {
  json: string;
  /** Si true, le viewer prend toute la hauteur disponible (mode fullscreen). */
  fullHeight?: boolean;
  /** Affiche le bouton « plein écran ». */
  onRequestFullscreen?: () => void;
  /** Limite de lignes affichées par défaut (sera dépliable). */
  maxLines?: number;
}

const DEFAULT_MAX_LINES = 400;

/**
 * Preview pretty-printed du container.json.
 *
 * V1.1 : line numbers en gutter sticky, fade-in séquentiel des lignes,
 * bouton plein écran (déclenche modal côté parent), collapse au-delà
 * de `maxLines`. Pas de syntax highlighting (V1.2 — Shiki SSR).
 */
export function GtmJsonPreview({
  json,
  fullHeight = false,
  onRequestFullscreen,
  maxLines = DEFAULT_MAX_LINES,
}: Props) {
  const lines = useMemo(() => json.split('\n'), [json]);
  const [showAll, setShowAll] = useState(fullHeight);
  const visibleCount = showAll ? lines.length : Math.min(lines.length, maxLines);
  const truncated = !showAll && lines.length > maxLines;

  return (
    <div
      className={`overflow-hidden rounded-md border border-stone-200 bg-stone-50 motion-safe:animate-[fg-fade-in_240ms_ease-out_both] ${
        fullHeight ? 'flex h-full flex-col' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-stone-200 bg-white/60 px-3 py-2 text-xs">
        <span className="font-mono text-stone-500">
          container.json · {lines.length.toLocaleString('fr-FR')} lignes
        </span>
        <div className="flex items-center gap-1">
          {lines.length > maxLines && !fullHeight ? (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="rounded px-2 py-1 text-stone-700 transition-colors duration-150 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            >
              {showAll ? 'Replier' : `Voir tout (${lines.length})`}
            </button>
          ) : null}
          {onRequestFullscreen && !fullHeight ? (
            <button
              type="button"
              onClick={onRequestFullscreen}
              title="Ouvrir en plein écran"
              aria-label="Ouvrir en plein écran"
              className="inline-flex items-center gap-1.5 rounded border border-stone-200 bg-white px-2 py-1 text-stone-700 transition-colors duration-150 hover:border-stone-300 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            >
              <IconExpand className="h-3.5 w-3.5" />
              Plein écran
            </button>
          ) : null}
        </div>
      </div>
      <div className={fullHeight ? 'flex-1 overflow-auto' : 'max-h-[60vh] overflow-auto'}>
        <pre className="grid grid-cols-[auto_1fr] font-mono text-xs leading-5">
          <div className="sticky left-0 select-none border-r border-stone-200 bg-white/95 px-3 py-3 text-right text-stone-400 backdrop-blur">
            {Array.from({ length: visibleCount }, (_, i) => (
              <div key={i} className="tabular-nums">
                {i + 1}
              </div>
            ))}
            {truncated ? <div aria-hidden="true">…</div> : null}
          </div>
          <code className="block whitespace-pre px-3 py-3 text-stone-800">
            {showAll
              ? json
              : lines.slice(0, visibleCount).join('\n') +
                (truncated ? `\n\n… ${lines.length - visibleCount} lignes masquées` : '')}
          </code>
        </pre>
      </div>
    </div>
  );
}
