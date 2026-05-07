/**
 * Registre central des éditeurs (F1).
 *
 * `FIELD_EDITOR_REGISTRY` : Map figée à l'init, **exhaustive** sur tous les
 * `FieldType`. Si un type est ajouté à `FieldType` (cf. `db/types.ts`) sans
 * entrée ici, le `getFieldEditor` jettera côté runtime — couvert par un
 * test (cf. F1 §exhaustivité).
 *
 * Les éditeurs récursifs (`ListEditor`, `RecordEditor`) importent ce module
 * → il n'y a **pas** de dépendance circulaire car ils n'instancient pas la
 * Map au top-level (juste au moment de l'appel).
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
import type { FieldType } from '@/lib/db/types';
import type { EditorComponent } from './types';
import { TextEditor } from './editors/TextEditor';
import { MultilineEditor } from './editors/MultilineEditor';
import { RichTextEditor } from './editors/RichTextEditor';
import { CtaEditor } from './editors/CtaEditor';
import { LinkEditor } from './editors/LinkEditor';
import { IconEditor } from './editors/IconEditor';
import { ColorTokenEditor } from './editors/ColorTokenEditor';
import { NumberEditor } from './editors/NumberEditor';
import { BooleanEditor } from './editors/BooleanEditor';
import { EnumEditor } from './editors/EnumEditor';
import { ListEditor } from './editors/ListEditor';
import { RecordEditor } from './editors/RecordEditor';
import { KickerEditor } from './editors/KickerEditor';
import { QuoteEditor } from './editors/QuoteEditor';
import { BreadcrumbSegmentEditor } from './editors/BreadcrumbSegmentEditor';

export const FIELD_EDITOR_REGISTRY: Map<FieldType, EditorComponent> = new Map<
  FieldType,
  EditorComponent
>([
  ['text', TextEditor as EditorComponent],
  ['multiline', MultilineEditor as EditorComponent],
  ['rich-text', RichTextEditor as EditorComponent],
  ['cta', CtaEditor as EditorComponent],
  ['link', LinkEditor as EditorComponent],
  ['icon', IconEditor as EditorComponent],
  ['color-token', ColorTokenEditor as EditorComponent],
  ['number', NumberEditor as EditorComponent],
  ['boolean', BooleanEditor as EditorComponent],
  ['enum', EnumEditor as EditorComponent],
  ['list', ListEditor as EditorComponent],
  ['record', RecordEditor as EditorComponent],
  ['kicker', KickerEditor as EditorComponent],
  ['quote', QuoteEditor as EditorComponent],
  ['breadcrumb-segment', BreadcrumbSegmentEditor as EditorComponent],
]);

export function getFieldEditor(type: FieldType): EditorComponent {
  const Editor = FIELD_EDITOR_REGISTRY.get(type);
  if (!Editor) {
    throw new Error(`No editor registered for field type "${type}"`);
  }
  return Editor;
}
