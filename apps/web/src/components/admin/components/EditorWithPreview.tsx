/**
 * EditorWithPreview — wrapper client qui rend côte-à-côte le FieldsPanel
 * et le PreviewFrame, et synchronise les deux via un compteur `changeTick`.
 *
 * - Le FieldsPanel notifie le parent à chaque changement (`onStateChange`).
 * - Le parent incrémente `tick` → PreviewFrame envoie `FIELDS_CHANGED`
 *   debounced à l'iframe → l'iframe `router.refresh()` la preview RSC.
 *
 * Cf. docs/components-cms/frontend/04-live-preview.md (F4).
 */
'use client';

import { useCallback, useState } from 'react';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import { FieldsPanel } from './fields/FieldsPanel';
import { PreviewFrame } from './PreviewFrame';
import type { FieldDirtyState } from './fields/types';
import { IconEye } from '@/components/admin/icons';

interface Props {
  componentKey: string;
  fieldDefs: ComponentFieldDefinition[];
  initialFields: Record<string, FieldDirtyState>;
  locale?: string;
}

export function EditorWithPreview({
  componentKey,
  fieldDefs,
  initialFields,
  locale = 'fr',
}: Props): JSX.Element {
  const [tick, setTick] = useState(0);

  const onStateChange = useCallback(() => {
    // Un tick par changement notable de l'état (FIELD_CHANGED, SAVE_*, RELOAD).
    // Le PreviewFrame se charge du debounce.
    setTick((t) => t + 1);
  }, []);

  return (
    <div className="editor-with-preview grid gap-8 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_1.2fr)]">
      <div className="editor-pane">
        <FieldsPanel
          componentKey={componentKey}
          fieldDefs={fieldDefs}
          initialFields={initialFields}
          locale={locale}
          onStateChange={onStateChange}
        />
      </div>
      <div className="preview-pane lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
          <IconEye className="h-3.5 w-3.5" />
          Aperçu en direct
        </h2>
        <PreviewFrame componentKey={componentKey} changeTick={tick} />
      </div>
    </div>
  );
}
