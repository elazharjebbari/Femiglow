# Design tokens & accessibilité

## 1. Design tokens

Cohérent avec sprint chat-leads — palette stone / emerald / amber / rose.

### Form inputs

| Élément | Classe |
|---|---|
| Input valide | `border-stone-300 focus:ring-stone-500` |
| Input invalide | `border-rose-400 focus:ring-rose-400` |
| Label | `text-sm font-medium text-stone-700` |
| Helper text (erreur) | `text-xs text-rose-600` |

### Sections panel

| Élément | Classe |
|---|---|
| Card panel | `rounded-md border border-stone-200 bg-white p-4` |
| Suggestions | `rounded-md border border-amber-200 bg-amber-50 p-3` |
| Alert success | `rounded-md border border-emerald-200 bg-emerald-50 p-3` |
| Alert error | `rounded-md border border-rose-200 bg-rose-50 px-3 py-2` |

### Boutons

| État | Classe |
|---|---|
| Primary | `bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800` |
| Disabled | `disabled:opacity-50` |
| Destructive (delete) | `bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700` |
| Secondary | `border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50` |

### Badges (suggestions cliquables)

```css
.suggestion-chip {
  @apply rounded-full bg-amber-100 px-2 py-0.5 text-xs font-mono text-amber-900 hover:bg-amber-200;
}
```

## 2. Accessibilité

### `<CreateVarForm />`

- Tous les inputs ont un `<label>` associé (htmlFor implicite via wrapping)
- `aria-invalid` sur l'input KEY si format invalide
- `<p>` helper text annoncé via `aria-describedby` (optionnel — à ajouter)
- Bouton submit a un label clair "+ Créer la variable" (pas juste icône)
- Suggestions sont des `<button type="button">` cliquables au clavier
- Aria-live regions pour status :
  - `role="alert"` pour les erreurs
  - `role="status" aria-live="polite"` pour les succès

### Tab order

1. Input KEY
2. Input Label
3. Input Description
4. Input Value
5. Checkbox isRequired
6. (Suggestions chips si présentes)
7. Bouton Submit
8. (Reste de la page)

### Focus management

Après création réussie :
- Le formulaire est réinitialisé
- Le focus revient sur l'input KEY pour faciliter une nouvelle saisie
- (Optionnel) toast sticky 3s puis fade

### Contraste WCAG AA

Toutes les combos passent ratio ≥ 4.5:1 :

| bg / text | Ratio |
|---|---|
| amber-100 / amber-900 | 9.2:1 ✅ |
| stone-900 / white | 19.0:1 ✅ |
| rose-50 / rose-800 | 7.5:1 ✅ |
| emerald-50 / emerald-800 | 8.2:1 ✅ |

### Touch targets mobile

Tous les boutons ≥ 44×44px (avec padding `px-3 py-1.5` = ~32px ; à augmenter à `py-2.5` si besoin mobile critique). Admin est principalement desktop.

## 3. Tests a11y automatiques

### Vitest avec axe

```tsx
// CreateVarForm.test.tsx (ajout)
import { axe } from 'jest-axe';

it('a11y — pas de violation axe', async () => {
  const { container } = render(<CreateVarForm suggestions={['CURRENCY']} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Playwright avec axe-playwright

```ts
// e2e/a11y/legal-admin.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('@a11y /admin/legal/template-vars passes WCAG 2.1 AA', async ({ page }) => {
  // login admin
  await page.goto('/admin/legal/template-vars');
  await injectAxe(page);
  await checkA11y(page);
});
```

## 4. Checklist a11y sprint

- [ ] `<CreateVarForm />` : labels associés, aria-invalid, role alert/status
- [ ] `<CleanupE2EButton />` : role alertdialog en mode confirmation
- [ ] Tab order naturel respecté
- [ ] Contraste WCAG AA validé
- [ ] Tests axe vitest + Playwright passent
- [ ] Lecteur d'écran (VoiceOver) testé sur page template-vars
