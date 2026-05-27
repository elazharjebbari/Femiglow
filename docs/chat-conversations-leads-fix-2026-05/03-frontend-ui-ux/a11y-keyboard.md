# Accessibilité & navigation clavier

> Tous les nouveaux composants doivent passer axe-core WCAG 2.1 AA.

## 1. `<SourceBadge />`

### Aria

- Si `withTooltip`, attribut `title` + `aria-label` redondants pour lecteurs d'écran.
- Icône (`<span aria-hidden>`) cachée des lecteurs d'écran.
- Label texte visible — pas besoin de `sr-only` sauf en mode `compact`.

### Compact mode

```tsx
<span aria-label="Lead capturé via téléphone détecté dans un message chat">
  <span aria-hidden>↳</span>
  <span className="sr-only">inline</span>
</span>
```

### Tests

Ajouter test axe-core dans le test du badge :

```tsx
import { axe } from 'jest-axe';
import { render } from '@testing-library/react';

it('a11y — pas de violation axe', async () => {
  const { container } = render(<SourceBadge source="wizard_kit" withTooltip />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 2. `<KindBadge />`

Idem `<SourceBadge />` :

```tsx
<span title="Ghost session pivot pour chat_lead FK">
  wizard
</span>
```

## 3. `<CleanupGhostsButton />`

### Focus management

- Step `idle` → bouton "Prévisualiser" reçoit le focus initial si la page est ciblée par anchor link.
- Step `confirming` → bouton "Confirmer" reçoit le focus automatiquement (ensure UX clavier).
- Step `done` → focus retourne au bouton "Prévisualiser" pour relancer si besoin.

### Code focus management

```tsx
import { useRef, useEffect } from 'react';

const confirmRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (step === 'confirming') confirmRef.current?.focus();
}, [step]);

// ...
<button ref={confirmRef} onClick={handleConfirm}>Confirmer</button>
```

### Aria

- Modal-like region (`step === 'confirming'`) : `role="alertdialog"` + `aria-labelledby`.
- État `done` : `role="status"` + `aria-live="polite"` pour notifier les lecteurs d'écran.

### Code

```tsx
{step === 'confirming' && (
  <div role="alertdialog" aria-labelledby="cleanup-confirm-title" className="...">
    <p id="cleanup-confirm-title" className="text-sm text-amber-900">
      <strong>{candidates}</strong> ghost sessions seront archivées.
    </p>
    {/* ... */}
  </div>
)}

{step === 'done' && (
  <div role="status" aria-live="polite" className="...">
    ✓ {archived} sessions archivées.
  </div>
)}
```

## 4. Formulaires admin — selects et toggles

### Page conversations

```tsx
<form method="get" aria-labelledby="conversations-filters-heading">
  <h2 id="conversations-filters-heading" className="sr-only">Filtres</h2>

  <label className="...">
    <input type="checkbox" name="includeAllKinds" />
    Inclure les sessions wizard et system
  </label>

  <label className="...">
    <input type="checkbox" name="includeGhosts" />
    Inclure les sessions sans messages (debug)
  </label>

  <button type="submit">Filtrer</button>
</form>
```

### Page leads

Idem avec `<label>` enveloppant chaque checkbox pour cibles cliquables ≥44px.

## 5. Tab order

Sur `/admin/chat/conversations` (mode debug) :
1. Header navigation (sidebar)
2. ChatAdminNav top
3. Recherche q
4. Select lang
5. Select status
6. Select converted
7. Checkbox includeAllKinds
8. Checkbox includeGhosts
9. Bouton Filtrer
10. Lien Réinitialiser
11. Lignes de la table (chaque session est un lien)
12. Sidebar bottom (Se déconnecter)

Pas de `tabindex` explicite — l'ordre naturel du DOM doit suffire. Vérifier avec Tab dans la preview.

## 6. Focus visible

Tous les éléments interactifs doivent avoir un focus ring visible (déjà géré par Tailwind par défaut sur le projet) :

```css
.focus-visible {
  @apply ring-2 ring-offset-2 ring-stone-900;
}
```

Vérifier que les badges (`<SourceBadge>`, `<KindBadge>`) ne créent pas de zones de focus si non-interactives (ils sont des `<span>`, pas `<button>` — donc ils ne reçoivent pas le focus par défaut ✅).

## 7. Contraste WCAG AA

Tous les couples bg/text proposés dans `design-tokens.md` passent WCAG AA (ratio ≥ 4.5:1 pour texte normal, ≥ 3:1 pour large) :

| Combo | Ratio | WCAG |
|---|---|---|
| `emerald-100` / `emerald-800` | 8.2:1 | AAA ✅ |
| `amber-100` / `amber-800` | 7.8:1 | AAA ✅ |
| `sky-100` / `sky-800` | 7.4:1 | AAA ✅ |
| `violet-100` / `violet-800` | 8.0:1 | AAA ✅ |
| `stone-200` / `stone-800` | 11.2:1 | AAA ✅ |
| `rose-100` / `rose-800` (overdue) | 7.5:1 | AAA ✅ |

## 8. Screen reader testing

- Tester avec VoiceOver (macOS Safari) — `<span title="...">` doit être annoncé.
- Tester avec NVDA (Windows Chrome/Edge) — idem.
- Pour la page audit : vérifier que `<table>` est annoncée avec headers (déjà géré).

## 9. Mobile / touch

Tous les nouveaux composants doivent respecter :
- Cible touch ≥ 44×44 px (badges sont info-only, pas touch).
- Boutons cleanup : padding suffisant (`px-3 py-1.5` = ~32-40px height ; à augmenter à `py-2.5` pour mobile si visible mobile).

Mais l'admin est principalement desktop — pas critique.

## 10. Tests automatiques a11y

Ajouter dans le pipeline CI :

```bash
# Vitest avec axe sur composants
pnpm vitest run -t "a11y"

# Playwright avec @axe-core/playwright
pnpm playwright test --grep @a11y
```

Spec Playwright @a11y :

```ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('@a11y /admin/chat/conversations passes WCAG 2.1 AA', async ({ page }) => {
  // Login admin
  await page.goto('/admin/login');
  await page.fill('input[type=email]', process.env.ADMIN_BOOTSTRAP_EMAIL!);
  await page.fill('input[type=password]', process.env.ADMIN_BOOTSTRAP_PASSWORD!);
  await page.click('button[type=submit]');
  
  await page.goto('/admin/chat/conversations');
  await injectAxe(page);
  await checkA11y(page, undefined, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
```

## 11. Checklist a11y pour ce sprint

- [ ] `<SourceBadge />` : aria-label si compact, contraste WCAG AA
- [ ] `<KindBadge />` : title attribut, contraste WCAG AA
- [ ] `<CleanupGhostsButton />` : role/aria-live appropriés, focus management
- [ ] Pages admin : tab order naturel, focus visible
- [ ] Formulaires : labels associés à inputs (htmlFor / wrapping `<label>`)
- [ ] Test axe-core dans vitest pour chaque composant nouveau
- [ ] Test axe-core dans Playwright pour les 3 pages admin chat
