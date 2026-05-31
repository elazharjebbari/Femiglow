# 50.9 — Accessibilité (WCAG 2.1 AA)

## Checklist par écran

### `/admin/tracking/gtm` (liste)

- [ ] H1 unique : "Versions GTM"
- [ ] Table avec `<th scope="col">`
- [ ] Boutons d'action avec `aria-label` explicite (ex : "Modifier la version v2 — BF 2026")
- [ ] Badge "ACTIVE" annoncé via `aria-label="Version active"`
- [ ] Statut focus visible sur tous les éléments interactifs
- [ ] Ordre de Tab logique : header → filter → table → pagination

### Wizard Create / Edit GTM

- [ ] Indicateur d'étape annoncé : `<nav aria-label="Étapes du wizard">`
- [ ] Chaque step a un `<h2>` avec focus on mount (`tabIndex={-1}`)
- [ ] Inputs avec `<label>` associé via `htmlFor`
- [ ] Erreurs validation associées via `aria-describedby`
- [ ] Bouton "Continuer" disabled = `aria-disabled="true"` + visuellement clair
- [ ] Pas de validation auto-submit (Enter dans un champ ne soumet pas le form)
- [ ] Diff summary lisible : pas que de la couleur (icônes + texte)

### `/admin/tracking/events/categorization`

- [ ] Table accessible (`<table>` + `<th scope>`)
- [ ] Dropdowns natifs HTML (`<select>`) — meilleur a11y que customs
- [ ] Override status indiqué par texte ET icône (pas que couleur)
- [ ] Bouton "Reset" labellisé : `aria-label="Reset override pour stock_notify_subscribe"`
- [ ] Modal de note : focus trap, Escape ferme, focus restore au close

### `/admin/tracking/analytics/providers`

- [ ] KPIs en `<dl>` (definition list) avec `<dt>`/`<dd>`
- [ ] Charts avec `<title>` + `<desc>` SVG pour SR
- [ ] Données aussi en table textuelle (en parallèle du chart)
- [ ] Refresh auto : `aria-live="polite"` pour annoncer "Données mises à jour"
- [ ] Refresh manual : bouton `aria-label="Actualiser les données"`

## Couleur et contraste

| Combinaison | Ratio min | OK ? |
|---|---|---|
| `text-stone-900` on `bg-creme` | 16:1 | ✅ |
| `text-stone-600` on `bg-white` | 5.5:1 | ✅ |
| `text-emerald-700` on `bg-emerald-100` | 7:1 | ✅ |
| `text-amber-700` on `bg-amber-100` | 4.5:1 | ✅ (AA) |
| `text-rose-700` on `bg-rose-100` | 6:1 | ✅ |
| `text-stone-400` on `bg-white` | 3.2:1 | ⚠ (texte non-essentiel seulement) |

## Navigation clavier

### Wizard

- Tab cycle : Step indicator (skip) → Header → Form fields → Action buttons
- Enter dans un champ : ne soumet PAS (sauf si seul champ + bouton primaire focus)
- Escape : annule (avec confirm si modifications non sauvegardées)
- Cmd+Z : undo last field change (V2)

### Table

- ↑/↓ : navigation entre lignes
- Enter : open detail
- Cmd+A : sélection multiple (V2)

### Modal

- Focus trap actif
- Tab navigue dans la modal uniquement
- Escape ferme et restore focus à l'élément qui a ouvert

## Screen reader

### Annonces critiques

```typescript
// Lors d'un changement de catégorie réussi :
<div aria-live="polite" className="sr-only">
  Catégorie de stock_notify_subscribe mise à jour : Lead
</div>

// Lors d'une erreur :
<div aria-live="assertive" className="sr-only">
  Erreur : la modification n'a pas pu être sauvegardée. Réessayez.
</div>
```

### Labels descriptifs

```tsx
// ❌ Mauvais
<button>✏</button>

// ✅ Bon
<button aria-label="Modifier la version v2 — BF 2026">
  <PencilIcon aria-hidden="true" />
</button>
```

## Tests automatiques

### Avec @axe-core/react ou jest-axe

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('a11y: GtmConfigForm has no violations', async () => {
  const { container } = render(<GtmConfigForm ... />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Avec @axe-core/playwright

```typescript
import AxeBuilder from '@axe-core/playwright';

test('a11y: GTM list page', async ({ page }) => {
  await page.goto('/admin/tracking/gtm');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toHaveLength(0);
});
```

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse,
  .animate-spin,
  [class*="animate-in"] {
    animation: none !important;
  }
}
```

Tailwind utilities `motion-safe:` pour conditionnel.

## Mobile

- Targets ≥ 44×44 px (WCAG 2.5.5)
- Pas d'orientation lock
- Pinch zoom autorisé (sauf pendant focus input — fix MobileFocusGuard)
- Touch + click handlers sans double-fire

## Critères de validation

Avant chaque release :
- [ ] Axe-core report : 0 critical / serious
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Test manuel Tab-only : tout est accessible
- [ ] Test VoiceOver (Mac) ou NVDA (Win) sur une page complète
- [ ] Vérification contraste avec WebAIM Contrast Checker
