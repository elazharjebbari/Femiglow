/**
 * NumberEditor — `<input type="number">` avec `min`/`max`/`step`.
 *
 * On clamp côté UI (commit du blur), mais la valeur autoritaire est celle
 * validée par Zod côté serveur. Quand l'input est vidé, on remonte `null`
 * traité comme "non édité" — c'est au required côté serveur de rejeter.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';

export function NumberEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<number>): JSX.Element {
  const cfg = fieldDef.config ?? {};
  const errorId = error ? `${id}-error` : undefined;
  const display = value === null || value === undefined ? '' : String(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value;
    if (raw === '') {
      // On réémet `NaN` → puis on laisse le serveur trancher. On évite de
      // muter `null` car l'API attend bien un nombre. Pour rester simple
      // côté F1, on émet `0` quand le champ est vidé et que `min` est
      // défini ; sinon on émet 0 par défaut.
      onChange(cfg.min ?? 0);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(parsed);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>): void {
    const v = Number(e.target.value);
    if (Number.isNaN(v)) return;
    let next = v;
    if (cfg.min !== undefined) next = Math.max(cfg.min, next);
    if (cfg.max !== undefined) next = Math.min(cfg.max, next);
    if (next !== v) onChange(next);
  }

  return (
    <div className="field-number">
      <input
        id={id}
        type="number"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step ?? 1}
        placeholder={cfg.placeholder}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
