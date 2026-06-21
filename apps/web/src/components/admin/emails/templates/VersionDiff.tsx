'use client';

/**
 * VersionDiff — comparaison ligne-à-ligne d'une version vs l'édition courante
 * (F07 P3.4-j, Lot 6). Gouttière +/- ; couleurs via tokens (TONE, verrou G10).
 */
import { useMemo } from 'react';
import { lineDiff, diffStats } from './version-diff';
import { TONE } from '../ui/tokens';
import { Button } from '../ui';

export function VersionDiff({
  versionNumber,
  oldSource,
  newSource,
  onClose,
}: {
  versionNumber: number;
  oldSource: string;
  newSource: string;
  onClose: () => void;
}) {
  const rows = useMemo(() => lineDiff(oldSource, newSource), [oldSource, newSource]);
  const stats = useMemo(() => diffStats(rows), [rows]);

  return (
    <section
      data-testid="version-diff"
      className="mb-4 rounded-lg border border-stone-200 bg-white"
    >
      <header className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2">
        <span className="text-xs font-medium text-stone-700">
          Diff v{versionNumber} → édition actuelle{' '}
          <span className="ml-1 font-mono text-stone-500" data-testid="version-diff-stats">
            +{stats.added} −{stats.removed}
          </span>
        </span>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </header>
      <pre className="max-h-72 overflow-auto px-0 py-1 text-[11px] font-mono leading-snug">
        {rows.map((r, i) => (
          <div
            key={i}
            data-diff={r.type}
            className={`px-3 ${
              r.type === 'add'
                ? TONE.success.subtle
                : r.type === 'remove'
                  ? TONE.danger.subtle
                  : 'text-stone-600'
            }`}
          >
            <span aria-hidden="true" className="mr-2 select-none opacity-60">
              {r.type === 'add' ? '+' : r.type === 'remove' ? '−' : ' '}
            </span>
            {r.text || ' '}
          </div>
        ))}
      </pre>
    </section>
  );
}
