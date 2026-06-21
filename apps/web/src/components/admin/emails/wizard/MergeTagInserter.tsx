'use client';

/**
 * MergeTagInserter — menu d'insertion de merge-tags de campagne (F05 P3.2-c3,
 * assistance G11).
 *
 * Bouton + menu (aria-haspopup=menu) listant les champs de personnalisation
 * Listmonk. Les tags TOUJOURS résolus sont mis en avant ; ceux dépendant des
 * données contact (souvent vides pour les audiences) sont regroupés sous un
 * avertissement honnête. Sélection → `onInsert(token)` (le parent insère au
 * curseur). Fermeture au clic extérieur / Échap / sélection.
 *
 * Couleurs via tokens (verrou G10) ; anneau de focus unique (FOCUS).
 */
import { useEffect, useRef, useState } from 'react';
import {
  ALWAYS_MERGE_TAGS,
  CONDITIONAL_MERGE_TAGS,
  type MergeTag,
} from '@/lib/mail/campaigns/merge-tags';
import { BUTTON, FOCUS, INK, RADIUS, TYPO } from '../ui/tokens';

function TagItem({ tag, onPick }: { tag: MergeTag; onPick: (token: string) => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onPick(tag.token)}
      className={`block w-full ${RADIUS.control} px-2 py-1.5 text-left hover:bg-stone-50 ${FOCUS}`}
    >
      <span className="block text-xs font-medium text-stone-800">{tag.label}</span>
      <code className={`block ${TYPO.mono}`}>{tag.token}</code>
      <span className={`block ${TYPO.meta}`}>{tag.description}</span>
    </button>
  );
}

export function MergeTagInserter({
  onInsert,
  label = 'Insérer un champ',
}: {
  onInsert: (token: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (token: string) => {
    onInsert(token);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 ${RADIUS.control} ${BUTTON.secondary} px-2 py-1 text-xs font-medium ${FOCUS}`}
      >
        <span aria-hidden="true" className="font-mono">{'{ }'}</span> {label}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Champs de personnalisation"
          className={`absolute right-0 z-20 mt-1 w-72 ${RADIUS.card} border border-stone-200 bg-white p-1 shadow-lg`}
        >
          {ALWAYS_MERGE_TAGS.map((t) => (
            <TagItem key={t.token} tag={t} onPick={pick} />
          ))}
          {CONDITIONAL_MERGE_TAGS.length ? (
            <>
              <p className={`mt-1 border-t border-stone-100 px-2 pt-2 text-xs font-medium ${INK.warning}`}>
                Selon les données contact (souvent vide pour les audiences)
              </p>
              {CONDITIONAL_MERGE_TAGS.map((t) => (
                <TagItem key={t.token} tag={t} onPick={pick} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
