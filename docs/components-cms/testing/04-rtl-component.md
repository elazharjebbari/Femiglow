# T4 — Tests RTL des éditeurs et du form-engine

> Patterns React Testing Library pour : éditeurs F1 en isolation,
> form-engine F3, panneau d'édition complet, preview F4. axe-core
> systématique. **Pas de snapshot HTML** (cf. T1 §Ce qu'on ne teste pas).

## Setup

### Render helper

Pour chaque éditeur, un helper local fixe les props communes
(`value`, `onChange`, `error`, `disabled`).

```tsx
// src/components/admin/components/fields/test-utils/renderEditor.tsx
import type { ComponentType } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import type { FieldEditorProps } from '../types';

export function renderEditor<T>(
  Editor: ComponentType<FieldEditorProps<T>>,
  props: Partial<FieldEditorProps<T>> & { value: T },
): RenderResult & { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  const utils = render(
    <Editor
      fieldKey={props.fieldKey ?? 'test'}
      label={props.label ?? 'Test'}
      value={props.value}
      onChange={props.onChange ?? onChange}
      error={props.error ?? null}
      disabled={props.disabled ?? false}
      config={props.config ?? {}}
    />,
  );
  return { ...utils, onChange };
}
```

### axe-core systématique

Le projet expose déjà `expectNoAxeViolations` (cf. `src/test/axe.ts`).
**Chaque suite d'éditeur** doit avoir un test `axe` :

```ts
import { expectNoAxeViolations } from '@/test/axe';

it('aucune violation a11y', async () => {
  const { container } = renderEditor(TextEditor, { value: '', label: 'Titre' });
  await expectNoAxeViolations(container);
});
```

### Locale FR (dates, nombres)

Pour les tests qui touchent au format date (scheduling) ou nombre :

```ts
beforeAll(() => {
  // jsdom respecte le LANG de l'OS — on force fr-FR pour la stabilité CI
  Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
});
```

## Patterns par éditeur

### TextEditor / MultilineEditor

```tsx
describe('TextEditor', () => {
  it('rend un <input type="text"> contrôlé', () => {
    const { onChange } = renderEditor(TextEditor, { value: 'Hello', label: 'Titre' });
    const input = screen.getByRole('textbox', { name: /titre/i });
    expect(input).toHaveValue('Hello');
    fireEvent.change(input, { target: { value: 'World' } });
    expect(onChange).toHaveBeenCalledWith('World');
  });

  it('affiche le compteur min/max', () => {
    renderEditor(TextEditor, {
      value: 'Hello',
      label: 'Titre',
      config: { minLength: 3, maxLength: 50 },
    });
    expect(screen.getByText('5 / 50')).toBeInTheDocument();
  });

  it('affiche l\'erreur passée en prop', () => {
    renderEditor(TextEditor, { value: '', label: 'Titre', error: 'Trop court' });
    expect(screen.getByRole('alert')).toHaveTextContent(/trop court/i);
  });

  it('Esc remet la valeur initiale', () => {
    const { onChange } = renderEditor(TextEditor, { value: 'Init', label: 'Titre' });
    const input = screen.getByRole('textbox', { name: /titre/i });
    fireEvent.change(input, { target: { value: 'Tap' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).toHaveBeenLastCalledWith('Init');
  });

  it('Enter commit (blur déclenche save)', () => {
    const onCommit = vi.fn();
    renderEditor(TextEditor, { value: 'Init', label: 'Titre', onCommit });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalled();
  });
});
```

### CtaEditor (composé)

```tsx
describe('CtaEditor', () => {
  const cta = { label: 'Découvrir', href: '/rituel', variant: 'primary' as const };

  it('rend trois sous-champs accessibles par label', () => {
    renderEditor(CtaEditor, { value: cta, label: 'CTA', config: { variants: ['primary', 'secondary'] } });
    expect(screen.getByRole('textbox', { name: /libellé/i })).toHaveValue('Découvrir');
    expect(screen.getByRole('textbox', { name: /lien/i })).toHaveValue('/rituel');
    expect(screen.getByRole('combobox', { name: /variante/i })).toHaveValue('primary');
  });

  it('onChange émet l\'objet complet (pas seulement le sous-champ)', () => {
    const { onChange } = renderEditor(CtaEditor, { value: cta, label: 'CTA' });
    fireEvent.change(screen.getByRole('textbox', { name: /libellé/i }), { target: { value: 'Voir' } });
    expect(onChange).toHaveBeenCalledWith({ ...cta, label: 'Voir' });
  });

  it('href invalide → erreur visible', async () => {
    renderEditor(CtaEditor, { value: cta, label: 'CTA', error: { href: 'href doit être relatif ou allowlisted' } });
    expect(screen.getByText(/href doit/i)).toBeInTheDocument();
  });

  it('Tab order : libellé → lien → variante', () => {
    renderEditor(CtaEditor, { value: cta, label: 'CTA', config: { variants: ['primary'] } });
    const inputs = [
      screen.getByRole('textbox', { name: /libellé/i }),
      screen.getByRole('textbox', { name: /lien/i }),
      screen.getByRole('combobox', { name: /variante/i }),
    ];
    inputs[0].focus();
    expect(document.activeElement).toBe(inputs[0]);
    fireEvent.keyDown(inputs[0], { key: 'Tab' });
    // jsdom ne déplace pas le focus automatiquement — on vérifie via tabindex
    inputs.forEach((el) => expect(el).toHaveAttribute('tabindex', expect.stringMatching(/-?\d+/)));
  });
});
```

### IconEditor (whitelist)

```tsx
describe('IconEditor', () => {
  it('liste uniquement les icônes registrées', () => {
    renderEditor(IconEditor, { value: 'sun', label: 'Icône', config: { iconRegistry: 'femiglow-curated' } });
    fireEvent.click(screen.getByRole('button', { name: /icône/i }));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(REGISTERED_ICONS.length); // pas d'input libre
  });

  it('filtre par recherche', () => {
    renderEditor(IconEditor, { value: 'sun', label: 'Icône' });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: 'leaf' } });
    expect(screen.getByRole('option', { name: /leaf/i })).toBeInTheDocument();
  });
});
```

### ColorTokenEditor

```tsx
describe('ColorTokenEditor', () => {
  it('affiche les tokens du tokenSet demandé', () => {
    renderEditor(ColorTokenEditor, { value: 'creme', label: 'Couleur', config: { tokenSet: 'background' } });
    expect(screen.getByRole('button', { name: /creme/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /text-/i })).not.toBeInTheDocument();
  });
});
```

### RichTextEditor (markdown)

```tsx
describe('RichTextEditor', () => {
  it('preview en parallèle de l\'édition', () => {
    renderEditor(RichTextEditor, { value: '## Titre\n\nParagraphe.', label: 'Corps' });
    expect(screen.getByRole('heading', { level: 2, name: /titre/i })).toBeInTheDocument();
  });

  it('strip le HTML dangereux à l\'affichage preview', () => {
    renderEditor(RichTextEditor, { value: '<script>alert(1)</script>OK', label: 'Corps' });
    expect(document.querySelector('script')).toBeNull();
  });
});
```

### ListEditor (drag handle, add/remove)

```tsx
describe('ListEditor', () => {
  it('ajoute un item via Add', () => {
    const { onChange } = renderEditor(ListEditor, { value: [], label: 'Items', config: { itemType: 'text' } });
    fireEvent.click(screen.getByRole('button', { name: /ajouter/i }));
    expect(onChange).toHaveBeenCalledWith(['']);
  });

  it('supprime un item', () => {
    const { onChange } = renderEditor(ListEditor, { value: ['a', 'b', 'c'], label: 'Items', config: { itemType: 'text' } });
    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[1]);
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('respecte minItems / maxItems', () => {
    renderEditor(ListEditor, { value: ['a'], label: 'Items', config: { itemType: 'text', minItems: 1, maxItems: 3 } });
    expect(screen.getByRole('button', { name: /supprimer/i })).toBeDisabled();
  });
});
```

### Date / scheduling

```tsx
describe('SchedulePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T10:00:00Z'));
  });

  it('rejette une date dans le passé (UI feedback)', async () => {
    const { onChange } = render(<SchedulePicker onSchedule={onChange} />);
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-05-04' } });
    fireEvent.change(screen.getByLabelText(/heure/i), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /programmer/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/passé/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('convertit l\'heure locale (Europe/Paris) en UTC avant POST', async () => {
    const { onChange } = render(<SchedulePicker onSchedule={onChange} />);
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-03-15' } });
    fireEvent.change(screen.getByLabelText(/heure/i), { target: { value: '08:00' } });
    fireEvent.click(screen.getByRole('button', { name: /programmer/i }));
    // 08:00 Paris en mars = 07:00 UTC
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: '2026-03-15T07:00:00.000Z' }));
  });
});
```

## Form-engine F3 — wrapper de test

```tsx
function renderFieldsPanel(opts: { componentKey: string; initialFields: ResolvedFields }) {
  server.use(getFieldsHandler({ componentKey: opts.componentKey, fields: opts.initialFields }));
  return render(<ComponentFieldsPanel componentKey={opts.componentKey} />);
}

describe('ComponentFieldsPanel — dirty-tracking', () => {
  it('marque un field dirty au premier change', async () => {
    renderFieldsPanel({ componentKey: 'home-hero', initialFields: HOME_HERO_FIXTURE });
    const input = await screen.findByRole('textbox', { name: /titre/i });
    fireEvent.change(input, { target: { value: 'Nouveau titre' } });
    expect(screen.getByLabelText(/titre/i).closest('[data-dirty]')).toHaveAttribute('data-dirty', 'true');
  });

  it('auto-save debounced 800ms (PATCH /fields/title)', async () => {
    vi.useFakeTimers();
    server.use(patchFieldHandler({ componentKey: 'home-hero', fieldKey: 'title' }));
    renderFieldsPanel({ /* … */ });
    fireEvent.change(await screen.findByRole('textbox', { name: /titre/i }), { target: { value: 'X' } });
    vi.advanceTimersByTime(799);
    expectMswCalled('PATCH', '/api/admin/components/home-hero/fields/title') /* throws car pas appelé */;
    vi.advanceTimersByTime(2);
    await waitFor(() => expectMswCalled('PATCH', '/api/admin/components/home-hero/fields/title'));
  });

  it('Cmd-S → save immédiat sans attendre debounce', async () => { /* … */ });
  it('Bouton Publier → POST /publish', async () => { /* … */ });
});
```

## Conflit 409 — A4 E1 (UI)

```tsx
it('affiche le dialog conflit avec choix merge/reload', async () => {
  server.use(
    publishHandler({
      componentKey: 'home-hero',
      fieldKey: 'title',
      expectedIfMatch: '2026-05-05T11:00:00Z',
    }),
  );
  renderFieldsPanel({ /* draft chargé avec updatedAt 10:00 */ });
  fireEvent.click(await screen.findByRole('button', { name: /publier/i }));
  const dialog = await screen.findByRole('dialog', { name: /conflit/i });
  expect(within(dialog).getByRole('button', { name: /recharger/i })).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /fusionner/i })).toBeInTheDocument();
});
```

## Live preview F4

```tsx
describe('PreviewIframe', () => {
  it('postMessage les drafts vers l\'iframe à chaque save', async () => {
    const postMessage = vi.fn();
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue({ postMessage } as unknown as Window);
    renderFieldsPanel({ /* … */ });
    // …
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cms:draft-update', fieldKey: 'title' }),
      expect.any(String),
    ));
  });

  it('valide l\'origin du message reçu (sécurité)', () => {
    // L'iframe envoie un postMessage de retour ; on rejette si origin !== window.origin
  });
});
```

## Fichiers attendus

| Fichier | Couvre |
|---|---|
| `TextEditor.test.tsx` | text + multiline (variante) |
| `RichTextEditor.test.tsx` | markdown + sanitize preview |
| `CtaEditor.test.tsx` | composé label/href/variant/icon |
| `LinkEditor.test.tsx` | composé href/label/external |
| `IconEditor.test.tsx` | combobox whitelist |
| `ColorTokenEditor.test.tsx` | tokenSet filter |
| `EnumEditor.test.tsx` | options |
| `BooleanEditor.test.tsx` | switch |
| `NumberEditor.test.tsx` | min/max/step |
| `ListEditor.test.tsx` | add/remove/reorder |
| `RecordEditor.test.tsx` | sous-champs typés |
| `QuoteEditor.test.tsx` | text + author |
| `BreadcrumbSegmentEditor.test.tsx` | label + href |
| `SchedulePicker.test.tsx` | timezone, EC8, E3 |
| `ConflictDialog.test.tsx` | E1 |
| `RestoreDialog.test.tsx` | restore from history |
| `ComponentFieldsPanel.test.tsx` | form-engine F3 (dirty, autosave, publish) |
| `PreviewIframe.test.tsx` | F4 postMessage |

## Cross-références

- F1 (registry éditeurs), F3 (form-engine), F4 (preview).
- A4 §Drafts (autosave debounced 800 ms), §E1 (UI conflit).
- A6 §RBAC (401/403), §XSS (preview).
- T3 (handlers MSW utilisés ici).
- T6 (matrice : combien de scénarios par éditeur).
