'use client';

/**
 * VersionDiff — comparaison ligne-à-ligne d'une version vs l'édition courante
 * (F07 P3.4-j, Lot 6 ; navigation hunk : F07-D). Gouttière +/- ; compteur +N −M ;
 * navigation ◀/▶ entre modifications. Couleurs via tokens (TONE, verrou G10).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { lineDiff, diffStats, diffHunks } from './version-diff';
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
  const hunks = useMemo(() => diffHunks(rows), [rows]);

  const [hunk, setHunk] = useState(0);
  // Changer de version réinitialise le curseur de navigation.
  useEffect(() => setHunk(0), [versionNumber]);
  const active = hunks.length ? Math.min(hunk, hunks.length - 1) : 0;
  const activeRow = hunks.length ? hunks[active]! : -1;

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (activeRow < 0) return;
    const el = rowRefs.current[activeRow];
    // jsdom n'implémente pas scrollIntoView → garde défensive.
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ block: 'center' });
      } catch {
        /* no-op (environnement de test) */
      }
    }
  }, [activeRow]);

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
        <div className="flex items-center gap-1">
          {hunks.length > 0 ? (
            <div className="mr-1 flex items-center gap-1" role="group" aria-label="Navigation des modifications">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Modification précédente"
                disabled={active === 0}
                onClick={() => setHunk(active - 1)}
              >
                ◀
              </Button>
              <span className="select-none font-mono text-[11px] text-stone-500" data-testid="version-diff-hunk">
                {active + 1} / {hunks.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Modification suivante"
                disabled={active === hunks.length - 1}
                onClick={() => setHunk(active + 1)}
              >
                ▶
              </Button>
            </div>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </header>
      <pre className="max-h-72 overflow-auto px-0 py-1 text-[11px] font-mono leading-snug">
        {rows.map((r, i) => (
          <div
            key={i}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            data-diff={r.type}
            data-active-hunk={i === activeRow ? 'true' : undefined}
            className={`px-3 ${
              r.type === 'add'
                ? TONE.success.subtle
                : r.type === 'remove'
                  ? TONE.danger.subtle
                  : 'text-stone-600'
            } ${i === activeRow ? 'ring-1 ring-inset ring-stone-400' : ''}`}
          >
            <span aria-hidden="true" className="mr-2 select-none opacity-60">
              {r.type === 'add' ? '+' : r.type === 'remove' ? '−' : ' '}
            </span>
            {r.text || ' '}
          </div>
        ))}
      </pre>
    </section>
  );
}
