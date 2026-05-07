# F1 — Registry d'éditeurs par type

## Contrat

> Pour chaque `FieldType` défini dans le registre des composants
> (cf. A2), il existe **exactement un** composant React éditeur.
> Le mapping est centralisé dans une `Map<FieldType, EditorComponent>`
> exposée par `@/components/admin/components/fields/registry`.

L'admin charge un éditeur via lookup, jamais via condition `switch`
au niveau page. Ajouter un nouveau type = ajouter une entrée dans la
map + son composant + ses tests RTL (cf. T4).

## Contrat de props

Tous les éditeurs implémentent la même interface :

```ts
import type { ComponentFieldDefinition, FieldType } from '@/lib/components/registry';

interface EditorProps<T = unknown> {
  /** Valeur courante (peut être null si pas encore édité). */
  value: T | null;
  /** Appelé à chaque changement. Le parent debounce le save (cf. F3). */
  onChange: (next: T) => void;
  /** Erreur de validation Zod (FR), ou null. */
  error: string | null;
  /** Définition du champ (label, config, required, …). */
  fieldDef: ComponentFieldDefinition;
  /** Locale courante. v1 : toujours 'fr'. */
  locale: string;
  /** id HTML pour <label htmlFor>. Géré par le parent. */
  id: string;
  /** Mode lecture seule (preview, restauration en cours). */
  readOnly?: boolean;
}

type EditorComponent<T = unknown> = React.FC<EditorProps<T>>;
```

Aucun éditeur ne lit la DB ni ne fait de `fetch`. Tous sont **purs et
contrôlés**. Le parent (cf. F3) gère le state et la persistance.

## Map d'éditeurs

```ts
// apps/web/src/components/admin/components/fields/registry.ts
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
import type { FieldType } from '@/lib/components/registry';
import type { EditorComponent } from './types';

export const FIELD_EDITOR_REGISTRY: Map<FieldType, EditorComponent> = new Map([
  ['text', TextEditor],
  ['multiline', MultilineEditor],
  ['rich-text', RichTextEditor],
  ['cta', CtaEditor],
  ['link', LinkEditor],
  ['icon', IconEditor],
  ['color-token', ColorTokenEditor],
  ['number', NumberEditor],
  ['boolean', BooleanEditor],
  ['enum', EnumEditor],
  ['list', ListEditor],
  ['record', RecordEditor],
  ['kicker', KickerEditor],
  ['quote', QuoteEditor],
  ['breadcrumb-segment', BreadcrumbSegmentEditor],
]);

export function getFieldEditor(type: FieldType): EditorComponent {
  const Editor = FIELD_EDITOR_REGISTRY.get(type);
  if (!Editor) {
    throw new Error(`No editor registered for field type "${type}"`);
  }
  return Editor;
}
```

## Inventaire des éditeurs

| Type | Composant | UX |
|---|---|---|
| `text` | `TextEditor` | `<input type="text">` ; compteur de caractères ; `maxLength` natif. |
| `multiline` | `MultilineEditor` | `<textarea>` auto-resize (3 → 8 rows) ; compteur. |
| `rich-text` | `RichTextEditor` | toolbar markdown (h2, h3, **gras**, *ital*, lien, liste) + zone `<textarea>` ; preview rendue à droite (split 50/50). |
| `cta` | `CtaEditor` | sous-form : `label` (TextEditor), `href` (LinkEditor), `variant` (segmented control), `icon` (IconEditor optionnel). |
| `link` | `LinkEditor` | `href` + `label` + checkbox `external` ; validation Zod live. |
| `icon` | `IconEditor` | popover `<IconPicker>` avec recherche fuzzy sur le registre d'icônes (`lucide` ou `femiglow-curated`) ; aperçu live. |
| `color-token` | `ColorTokenEditor` | grille de swatches 6 colonnes ; chaque swatch = `<button>` montrant la couleur résolue (var CSS) ; cocher = sélectionner. |
| `number` | `NumberEditor` | `<input type="number">` avec `min`/`max`/`step` ; clamp côté UI. |
| `boolean` | `BooleanEditor` | toggle `<Switch>` (a11y `role="switch"`). |
| `enum` | `EnumEditor` | segmented control si ≤ 4 options, sinon `<select>`. |
| `list` | `ListEditor` | conteneur sortable (drag-handle), bouton `+ Ajouter` (limité par `maxItems`), bouton corbeille par item (limité par `minItems`). Récursif via `getFieldEditor(itemType)`. |
| `record` | `RecordEditor` | rendu en accordéon ; chaque sous-champ = un éditeur du registre (récursif). |
| `kicker` | `KickerEditor` | `TextEditor` + preview avec la classe typographique du kicker (uppercase, letter-spacing, `--color-kicker`). |
| `quote` | `QuoteEditor` | sous-form : `text` (MultilineEditor) + `author` (TextEditor). |
| `breadcrumb-segment` | `BreadcrumbSegmentEditor` | sous-form : `label` + `href`. |

## Détail de quelques éditeurs

### TextEditor

```tsx
'use client';

import type { EditorProps } from '../types';

export function TextEditor({
  value,
  onChange,
  error,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const cfg = fieldDef.config ?? {};
  const current = value ?? '';
  const max = cfg.maxLength;
  return (
    <div className="field-text">
      <input
        id={id}
        type="text"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        placeholder={cfg.placeholder}
        maxLength={max}
        readOnly={readOnly}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {max ? (
        <span className="char-counter">
          {current.length} / {max}
        </span>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

### IconEditor (picker recherche)

```tsx
'use client';

import { useState, useMemo } from 'react';
import { ICON_REGISTRY } from '@/lib/icons/registry';
import type { EditorProps } from '../types';

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
  const set = fieldDef.config?.iconRegistry ?? 'femiglow-curated';
  const icons = ICON_REGISTRY[set];
  const filtered = useMemo(
    () =>
      icons.filter((i) =>
        i.key.toLowerCase().includes(query.toLowerCase()) ||
        i.aliases.some((a) => a.includes(query.toLowerCase())),
      ),
    [icons, query],
  );

  return (
    <div className="field-icon">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        disabled={readOnly}
      >
        {value ? <Icon name={value} /> : 'Choisir une icône'}
      </button>
      {open ? (
        <IconPickerDialog
          icons={filtered}
          query={query}
          onQueryChange={setQuery}
          onPick={(key) => {
            onChange(key);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
```

### ColorTokenEditor (grille de swatches)

```tsx
'use client';

import type { EditorProps } from '../types';

const TOKENS = [
  { key: 'creme', cssVar: 'var(--color-creme)' },
  { key: 'creme-warm', cssVar: 'var(--color-creme-warm)' },
  { key: 'sauge', cssVar: 'var(--color-sauge)' },
  { key: 'champagne-soft', cssVar: 'var(--color-champagne-soft)' },
  // … cf. tokens.css
];

export function ColorTokenEditor({
  value,
  onChange,
  fieldDef,
  id,
  readOnly,
}: EditorProps<string>): JSX.Element {
  const set = fieldDef.config?.tokenSet ?? 'all';
  const visible = TOKENS.filter((t) => set === 'all' || t.key.startsWith(set));
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="swatch-grid">
      {visible.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={value === t.key}
          aria-label={t.key}
          onClick={() => onChange(t.key)}
          disabled={readOnly}
          style={{ background: t.cssVar }}
        />
      ))}
    </div>
  );
}
```

### ListEditor (récursif, sortable)

```tsx
'use client';

import { getFieldEditor } from '../registry';
import type { EditorProps } from '../types';

export function ListEditor({
  value,
  onChange,
  fieldDef,
  locale,
  id,
  readOnly,
}: EditorProps<unknown[]>): JSX.Element {
  const items = value ?? [];
  const cfg = fieldDef.config ?? {};
  const ItemEditor = getFieldEditor(cfg.itemType ?? 'text');
  const itemDef = {
    ...fieldDef,
    type: cfg.itemType ?? 'text',
    config: cfg.itemConfig,
  };

  return (
    <div className="field-list">
      <SortableContext items={items.map((_, i) => `${id}-${i}`)}>
        {items.map((item, i) => (
          <SortableItem key={i} id={`${id}-${i}`}>
            <ItemEditor
              value={item}
              onChange={(next) => {
                const out = [...items];
                out[i] = next;
                onChange(out);
              }}
              error={null}
              fieldDef={itemDef}
              locale={locale}
              id={`${id}-${i}`}
              readOnly={readOnly}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, k) => k !== i))}
              disabled={readOnly || (cfg.minItems != null && items.length <= cfg.minItems)}
            >
              Supprimer
            </button>
          </SortableItem>
        ))}
      </SortableContext>
      <button
        type="button"
        onClick={() => onChange([...items, defaultForType(cfg.itemType ?? 'text')])}
        disabled={readOnly || (cfg.maxItems != null && items.length >= cfg.maxItems)}
      >
        + Ajouter
      </button>
    </div>
  );
}
```

### RecordEditor (récursif)

```tsx
'use client';

import { getFieldEditor } from '../registry';
import type { EditorProps } from '../types';

export function RecordEditor({
  value,
  onChange,
  fieldDef,
  locale,
  id,
  readOnly,
}: EditorProps<Record<string, unknown>>): JSX.Element {
  const shape = fieldDef.config?.shape ?? {};
  const current = value ?? {};
  return (
    <fieldset className="field-record">
      <legend>{fieldDef.label}</legend>
      {Object.entries(shape).map(([key, sub]) => {
        const SubEditor = getFieldEditor(sub.type);
        const subDef = {
          key,
          label: key,
          type: sub.type,
          required: sub.required ?? false,
          config: sub.config,
        };
        return (
          <SubEditor
            key={key}
            value={current[key] ?? null}
            onChange={(v) => onChange({ ...current, [key]: v })}
            error={null}
            fieldDef={subDef}
            locale={locale}
            id={`${id}-${key}`}
            readOnly={readOnly}
          />
        );
      })}
    </fieldset>
  );
}
```

## Lookup et rendu

Le composant parent `FieldRow` fait le pont :

```tsx
// apps/web/src/components/admin/components/fields/FieldRow.tsx
'use client';

import { getFieldEditor } from './registry';
import type { ComponentFieldDefinition } from '@/lib/components/registry';
import type { FieldDirtyState } from './types';

interface Props {
  fieldDef: ComponentFieldDefinition;
  state: FieldDirtyState;
  onChange: (next: unknown) => void;
  locale: string;
}

export function FieldRow({ fieldDef, state, onChange, locale }: Props): JSX.Element {
  const Editor = getFieldEditor(fieldDef.type);
  const id = `field-${fieldDef.key}`;
  return (
    <div className="field-row" data-dirty={state.current !== state.initial}>
      <label htmlFor={id}>
        {fieldDef.label}
        {fieldDef.required ? <span aria-label="requis"> *</span> : null}
      </label>
      {fieldDef.description ? (
        <p className="field-help">{fieldDef.description}</p>
      ) : null}
      <Editor
        value={state.current}
        onChange={onChange}
        error={state.error}
        fieldDef={fieldDef}
        locale={locale}
        id={id}
      />
      <FieldStatusBadge state={state} />
    </div>
  );
}
```

## Erreurs et validation

- Aucun éditeur ne valide lui-même. La validation Zod est faite côté
  serveur (cf. B2) ; le parent reçoit l'erreur en cas de `400`/`422`
  et la passe en props `error`.
- Une **validation locale légère** (uniquement `maxLength`/`minLength`
  natifs HTML) est OK pour le feedback immédiat ; tout le reste va au
  serveur.

## Accessibilité

| Règle | Implémentation |
|---|---|
| `<label htmlFor>` | obligatoire dans `FieldRow`. |
| `aria-invalid` | sur l'input quand `error != null`. |
| `aria-describedby` | sur l'input quand `error != null`, pointe sur l'élément d'erreur. |
| `role="alert"` | sur le message d'erreur. |
| Clavier | tous les boutons sont `<button type="button">` ; les pickers ouverts piègent le focus (`focus-trap-react` ou helper natif). |
| Couleur seule | jamais. Texte d'erreur en plus du `aria-invalid`. |

Cf. T4 (tests RTL) pour la matrice détaillée.

## Croisements

- A2 : `FieldType` et `FieldTypeConfig`.
- F2 : exemple d'usage RSC du résultat publié.
- F3 : comment le parent gère `state` et `onChange`.
- B2 : Zod schémas et messages d'erreur.
- T4 : tests RTL par éditeur.
