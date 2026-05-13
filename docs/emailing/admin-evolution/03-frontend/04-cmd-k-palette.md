# Cmd-K palette — spec détaillée

## Stack
- Lib : [cmdk](https://cmdk.paco.me/) (Vaul-related, headless)
- Wrap : `@/components/admin/emails/cockpit/CommandPalette.tsx`

## Comportement

### Trigger
- `⌘K` (Mac) / `Ctrl+K` (autres) ouvre depuis n'importe quel écran admin
- `Esc` ferme

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  ⌘K  [input search]                                       ⓘ │
├──────────────────────────────────────────────────────────────┤
│  ▸ Suggestions actuellement filtrées (max 10)               │
│  ───────────────────                                         │
│  ▸ Saved views                                               │
│  ───────────────────                                         │
│  ▸ Actions disponibles                                       │
└──────────────────────────────────────────────────────────────┘
```

### Catégories de suggestions
1. **Filtres** : suggestions auto-complete sur la syntaxe `key:value`
2. **Saved views** : views existantes pour le scope courant
3. **Actions** : actions applicables au state courant
4. **Navigation** : liens directs vers autres sections (V2)

### Syntaxe filtres

Voir [04-ui-ux/01-wizard-spec-master.md §1.3](../04-ui-ux/01-wizard-spec-master.md#syntaxe-de-filtres) pour la grammaire complète.

Le parseur est implémenté dans `lib/mail/transactional/filters-parser.ts` :

```typescript
type ParsedFilter = {
  key: 'status' | 'to' | 'template' | 'source' | 'after' | 'before' | 'attempts' | 'has';
  operator?: '>' | '<' | '>=' | '<=' | '=';
  value: string | string[];
  raw: string;
};

type ParseResult = {
  filters: ParsedFilter[];
  freetext?: string;          // ce qui n'a pas matché la grammaire → fallback recherche email
  errors?: { position: number; message: string }[];
};

export function parseFilters(input: string): ParseResult;
```

#### Algorithme parseur

Tokenization espaces, puis chaque token tenté :
1. Match regex `^(\w+):(.*)$` → keyword filter
2. Sinon : freetext (= recherche fuzzy email)

Validation par keyword :
- `status` : valeur in enum OutboxStatus
- `to` : glob valide
- `template` : glob valide
- `after`/`before` : parse date (ISO, `today`, `yesterday`, `-7d`, etc.)
- `attempts` : `(>|<|>=|<=|=)\d+`

Erreurs : highlight rouge dans la palette, message tooltip.

### Autocomplete

Au cours de la frappe, la palette suggère :
- Si l'input ressemble à `key:` → propose les valeurs (ex `status:` propose `failed, sent, ...`)
- Si l'input est un mot vide → propose les keywords (`status:`, `to:`, ...)
- Si l'input ressemble à un email → propose recherche directe

### Performance

- Debounce 100ms sur la frappe avant re-parse
- Évaluation locale (pas de roundtrip serveur sur le parse)
- Re-fetch table seulement quand l'utilisateur valide (Enter)

### Implémentation React (squelette)

```tsx
'use client';
import { Command, CommandInput, CommandList, CommandItem } from 'cmdk';
import { useEffect, useState } from 'react';

export function CommandPalette({ scope, onApply }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const parsed = parseFilters(input);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={input}
        onValueChange={setInput}
        placeholder="status:failed template:cart-*..."
      />
      <CommandList>
        {/* Suggestions filtres */}
        {parsed.filters.map((f) => (
          <CommandItem
            key={f.raw}
            onSelect={() => { onApply(parsed); setOpen(false); }}
          >
            {f.key}: {f.value}
          </CommandItem>
        ))}
        {/* Saved views */}
        {/* Actions */}
      </CommandList>
    </Command.Dialog>
  );
}
```

## Tests

### Jest / RTL

```
describe('CommandPalette', () => {
  it('opens on Cmd+K', ...);
  it('closes on Esc', ...);
  it('parses status:failed correctly', ...);
  it('suggests status values when typing status:', ...);
  it('shows error indicator on invalid filter', ...);
  it('saves view via "Save view as..."', ...);
  it('calls onAction on action select', ...);
});
```

### Playwright E2E

```
test('Cmd+K opens palette', async ({ page }) => {
  await page.goto('/admin/emails/transactional');
  await page.keyboard.press('Meta+K');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});

test('typing status:failed filters table', async ({ page }) => {
  // ...
});
```

## Accessibility

- `role="dialog"` + `aria-modal`
- Trap focus dans la palette
- Annonce résultats via `aria-live="polite"`
- `aria-activedescendant` pour la suggestion sélectionnée
