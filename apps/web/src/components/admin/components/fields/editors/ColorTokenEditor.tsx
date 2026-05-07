/**
 * ColorTokenEditor — grille de swatches (radiogroup).
 *
 * Affiche les tokens couleur de la charte sous forme de boutons. Chaque
 * swatch montre la couleur résolue (var CSS) et est sélectionnable. La clé
 * stockée est le nom du token (ex. `creme`), pas la valeur résolue.
 *
 * Le filtrage par `tokenSet` (background / text / border / all) repose sur le
 * préfixe du nom du token : convention `<set>-<name>` (ex. `bg-creme`,
 * `text-anthracite`). Pour `all` (défaut), on affiche tout le set.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

interface ColorToken {
  key: string;
  label: string;
  cssVar: string;
}

// Tokens issus de tokens.css. La var CSS est le seul moyen d'obtenir le bon
// rendu (la valeur peut changer entre thèmes light/dark). Si `--color-<key>`
// n'est pas défini, on tombe sur le fond clair par défaut via le fallback.
const TOKENS: ColorToken[] = [
  { key: 'creme', label: 'Crème', cssVar: 'var(--color-creme, #faf6ee)' },
  { key: 'creme-warm', label: 'Crème chaud', cssVar: 'var(--color-creme-warm, #f4ead7)' },
  { key: 'sauge', label: 'Sauge', cssVar: 'var(--color-sauge, #a3b18a)' },
  { key: 'sauge-deep', label: 'Sauge profond', cssVar: 'var(--color-sauge-deep, #6b7c5a)' },
  { key: 'champagne', label: 'Champagne', cssVar: 'var(--color-champagne, #e9d8b9)' },
  { key: 'champagne-soft', label: 'Champagne doux', cssVar: 'var(--color-champagne-soft, #f0e6d2)' },
  { key: 'anthracite', label: 'Anthracite', cssVar: 'var(--color-anthracite, #2a2d2c)' },
  { key: 'graphite', label: 'Graphite', cssVar: 'var(--color-graphite, #4a4a48)' },
  { key: 'rose-poudre', label: 'Rose poudré', cssVar: 'var(--color-rose-poudre, #e6c8c4)' },
  { key: 'terracotta', label: 'Terracotta', cssVar: 'var(--color-terracotta, #c87f6a)' },
  { key: 'or-doux', label: 'Or doux', cssVar: 'var(--color-or-doux, #c8a96b)' },
  { key: 'blanc-pur', label: 'Blanc pur', cssVar: 'var(--color-blanc-pur, #ffffff)' },
];

function filterBySet(set: string): ColorToken[] {
  if (set === 'all') return TOKENS;
  // Convention sous-set : on accepte qu'aucun token ne préfixe par `set-`,
  // dans ce cas on retourne tout (back-compat). Pour v2 on aura des
  // alias explicites par set.
  const prefixed = TOKENS.filter((t) => t.key.startsWith(`${set}-`));
  return prefixed.length > 0 ? prefixed : TOKENS;
}

export function ColorTokenEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const set = fieldDef.config?.tokenSet ?? 'all';
  const visible = filterBySet(set);
  const errorId = error ? `${id}-error` : undefined;
  const current = value ?? '';

  return (
    <div className="field-color-token">
      <div
        id={id}
        role="radiogroup"
        aria-label={fieldDef.label}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="swatch-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '0.5rem',
        }}
      >
        {visible.map((t) => {
          const checked = current === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={t.label}
              tabIndex={checked || (!current && t.key === visible[0]?.key) ? 0 : -1}
              disabled={readOnly}
              onClick={() => onChange(t.key)}
              data-state={checked ? 'on' : 'off'}
              style={{
                background: t.cssVar,
                width: '2.5rem',
                height: '2.5rem',
                border: checked ? '2px solid var(--color-anthracite, #000)' : '1px solid #ccc',
                borderRadius: '0.25rem',
                cursor: readOnly ? 'not-allowed' : 'pointer',
              }}
              title={t.label}
            />
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
