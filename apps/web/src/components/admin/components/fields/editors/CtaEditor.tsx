/**
 * CtaEditor — sous-form pour un Call-To-Action : `{ label, href, variant, icon? }`.
 *
 * - `label` : texte du bouton.
 * - `href` : URL (validation Zod côté serveur via `LinkEditor` simplifié).
 * - `variant` : segmented control (primary / secondary / ghost / link).
 * - `icon` : optionnel, ouvre `IconEditor`.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
'use client';

import type { EditorProps } from '../types';
import { IconEditor } from './IconEditor';

interface CtaValue {
  label: string;
  href: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'link';
  icon?: string;
}

const DEFAULT_VARIANTS: CtaValue['variant'][] = ['primary', 'secondary', 'ghost', 'link'];

export function CtaEditor({
  value,
  onChange,
  error,
  fieldDef,
  locale,
  id,
  readOnly,
}: EditorProps<CtaValue>): JSX.Element {
  const variants = fieldDef.config?.variants ?? DEFAULT_VARIANTS;
  const current: CtaValue = value ?? {
    label: '',
    href: '',
    variant: variants[0] ?? 'primary',
  };
  const errorId = error ? `${id}-error` : undefined;

  function update(patch: Partial<CtaValue>): void {
    onChange({ ...current, ...patch });
  }

  return (
    <fieldset
      className="field-cta"
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
    >
      <legend className="sr-only">CTA</legend>
      <label>
        <span>Libellé</span>
        <input
          id={`${id}-label`}
          type="text"
          value={current.label}
          onChange={(e) => update({ label: e.target.value })}
          readOnly={readOnly}
        />
      </label>
      <label>
        <span>URL</span>
        <input
          id={`${id}-href`}
          type="text"
          value={current.href}
          onChange={(e) => update({ href: e.target.value })}
          readOnly={readOnly}
        />
      </label>
      <div className="cta-variant">
        <span className="field-help">Variante</span>
        <div role="radiogroup" aria-label="Variant" className="segmented">
          {variants.map((v) => {
            const checked = current.variant === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                disabled={readOnly}
                onClick={() => update({ variant: v })}
                data-state={checked ? 'on' : 'off'}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
      <div className="cta-icon-slot">
        <span className="field-help">Icône (optionnel)</span>
        <IconEditor
          value={current.icon ?? null}
          onChange={(next) => update({ icon: next || undefined })}
          error={null}
          fieldDef={{ ...fieldDef, type: 'icon', config: fieldDef.config }}
          locale={locale}
          id={`${id}-icon`}
          readOnly={readOnly}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
