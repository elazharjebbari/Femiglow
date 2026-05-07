'use client';

import { useMemo } from 'react';

interface ConfigDiffProps {
  before: unknown;
  after: unknown;
}

type DiffLine = { type: 'same' | 'add' | 'remove'; text: string };

function stringifyStable(v: unknown): string {
  return JSON.stringify(v, null, 2) ?? '';
}

/**
 * Diff naïf ligne par ligne (Myers simplifié) : compare les deux sérialisations
 * stables, marque chaque ligne `same` / `add` / `remove`. Suffisant pour les
 * configs courtes (< 200 lignes) — pour des structures plus larges on pourrait
 * passer à une lib dédiée plus tard.
 */
function lineDiff(beforeStr: string, afterStr: string): DiffLine[] {
  const a = beforeStr.split('\n');
  const b = afterStr.split('\n');
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] ?? '' });
      i++;
      j++;
      continue;
    }
    // Look ahead pour matcher
    const idx = a.indexOf(b[j] ?? '', i);
    if (idx > i && idx - i < 8) {
      while (i < idx) {
        out.push({ type: 'remove', text: a[i] ?? '' });
        i++;
      }
      out.push({ type: 'same', text: a[i] ?? '' });
      i++;
      j++;
    } else {
      out.push({ type: 'remove', text: a[i] ?? '' });
      out.push({ type: 'add', text: b[j] ?? '' });
      i++;
      j++;
    }
  }
  while (i < a.length) {
    out.push({ type: 'remove', text: a[i] ?? '' });
    i++;
  }
  while (j < b.length) {
    out.push({ type: 'add', text: b[j] ?? '' });
    j++;
  }
  return out;
}

export function ConfigDiff({ before, after }: ConfigDiffProps) {
  const lines = useMemo(
    () => lineDiff(stringifyStable(before), stringifyStable(after)),
    [before, after],
  );

  return (
    <pre
      aria-label="Différences de configuration"
      className="overflow-x-auto rounded-md border border-stone-200 bg-stone-50 p-3 text-xs"
    >
      {lines.map((line, i) => {
        if (line.type === 'add') {
          return (
            <div key={i} className="bg-emerald-100 text-emerald-900">
              + {line.text}
            </div>
          );
        }
        if (line.type === 'remove') {
          return (
            <div key={i} className="bg-red-100 text-red-900">
              − {line.text}
            </div>
          );
        }
        return (
          <div key={i} className="text-stone-700">
            {'  '}
            {line.text}
          </div>
        );
      })}
    </pre>
  );
}
