/**
 * IconEditor — picker d'icônes avec recherche fuzzy.
 *
 * Affiche un bouton "Choisir une icône" qui ouvre un dialog modal listant
 * les icônes du registre. La recherche filtre par clé / label / aliases.
 *
 * On évite une dépendance type `<dialog>` polyfill : on rend une `<div>` avec
 * `role="dialog"` et `aria-modal="true"` et on referme à l'`Escape` ou au
 * clic sur le bouton fermeture.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md §IconEditor
 */
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { EditorProps } from '../types';
import {
  searchIcons,
  type IconRegistryEntry,
  type IconSetId,
} from '@/lib/icons/registry';

function isValidIconSet(v: unknown): v is IconSetId {
  return v === 'femiglow-curated' || v === 'lucide';
}

export function IconEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const setRaw = fieldDef.config?.iconRegistry;
  const set: IconSetId = isValidIconSet(setRaw) ? setRaw : 'femiglow-curated';
  const filtered = useMemo<IconRegistryEntry[]>(
    () => searchIcons(set, query),
    [set, query],
  );

  const errorId = error ? `${id}-error` : undefined;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Focus trap léger : focuser le champ recherche à l'ouverture.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }, 0);
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="field-icon">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        aria-label={value ? `${fieldDef.label} : ${value}` : `${fieldDef.label} — choisir une icône`}
        disabled={readOnly}
        className="icon-trigger"
      >
        {value ? (
          <span className="icon-preview" aria-hidden="true">
            {value}
          </span>
        ) : null}
        <span aria-hidden="true">{value ? value : 'Choisir une icône'}</span>
      </button>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-dialog-title`}
          className="icon-picker-dialog"
        >
          <div className="icon-picker-card">
            <header>
              <h3 id={`${id}-dialog-title`}>Choisir une icône</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer">
                ×
              </button>
            </header>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher une icône"
            />
            <ul role="listbox" aria-label="Icônes" className="icon-grid">
              {filtered.length === 0 ? (
                <li role="presentation" className="empty">
                  Aucune icône trouvée
                </li>
              ) : (
                filtered.map((i) => {
                  const selected = value === i.key;
                  return (
                    <li key={i.key} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onChange(i.key);
                          setOpen(false);
                        }}
                        title={i.label}
                      >
                        <span aria-hidden="true">{i.key}</span>
                        <span className="sr-only">{i.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="clear-btn"
              >
                Retirer l'icône
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
