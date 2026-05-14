# Accessibility checklist

> Cible : WCAG 2.1 AA pour les écrans admin. Audit automatique via
> axe-core en CI + audit manuel par phase.

## Checklist par composant

### Tous les inputs
- [ ] `<label htmlFor>` associé OU `aria-label`
- [ ] Required marqué avec `aria-required="true"` + `*` visuel
- [ ] Erreurs : `aria-invalid="true"` + `aria-describedby` → message d'erreur
- [ ] Focus visible (anneau `outline 2px sage-500 offset 2px`)
- [ ] Touch target ≥ 44×44px (sur mobile)

### Boutons
- [ ] Icon-only : `aria-label`
- [ ] Disabled : `disabled` HTML + `aria-disabled`
- [ ] Loading : `aria-busy="true"`
- [ ] Confirmation modale : `aria-describedby` pointe vers description

### Tableaux
- [ ] `<th scope="col">` pour les headers
- [ ] Tri : `aria-sort="ascending|descending|none"`
- [ ] Selection : `aria-selected` ou `aria-checked` (checkbox)
- [ ] Caption ou title implicite via heading précédent

### Modales / Drawers
- [ ] `role="dialog"` + `aria-modal="true"`
- [ ] `aria-labelledby` → titre
- [ ] `aria-describedby` → description
- [ ] Trap focus (Tab cycle dans la modale)
- [ ] Focus retourne à l'élément qui a ouvert au close
- [ ] Esc ferme

### Toasts
- [ ] `role="status"` (info, success) ou `role="alert"` (error)
- [ ] `aria-live="polite"` ou `assertive` selon urgence
- [ ] Dismissible avec keyboard

### Command palette
- [ ] `role="combobox"`
- [ ] `aria-activedescendant` sur l'item sélectionné
- [ ] `aria-expanded`
- [ ] Annonce des résultats via `aria-live`

### Visualisations / graphiques (sparklines KPI)
- [ ] Description textuelle alternative (`aria-label` avec résumé)
- [ ] Pas d'info uniquement par couleur (toujours doubler avec icon ou texte)

## Couleurs & contraste

| Élément | Contraste minimum |
|---|---|
| Text body sur background | 4.5:1 |
| Text large (≥ 18px ou 14px bold) | 3:1 |
| Bordures focus | 3:1 |
| Badges colorés | check 4.5:1 sur texte intérieur |

Vérifier avec `axe-core` ou Wave.

## Navigation clavier

- [ ] Toute action atteignable au clavier seul
- [ ] Ordre de tab logique (top to bottom, left to right)
- [ ] Skip link en haut de page ("Aller au contenu")
- [ ] Pas de piège (focus qui ne sort jamais d'un widget)

## Reduce motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Tests automatiques (CI)

```typescript
// e2e helper : axe-playwright
import { injectAxe, checkA11y } from 'axe-playwright';

test('audience builder is a11y compliant', async ({ page }) => {
  await page.goto('/admin/emails/audiences/new');
  await injectAxe(page);
  await checkA11y(page, undefined, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
```

Run en CI. Fail si violations critiques (`critical`, `serious`).

## Audit manuel par phase

À la fin de chaque phase :
1. NVDA / VoiceOver — annonce des states ?
2. Tab navigation — focus visible partout ?
3. Lighthouse a11y ≥ 95 ?
4. Cmd+touch tests sur mobile (V2) — tap targets ?

## Documentation a11y dans composants

Chaque composant exporte ses props avec doc JSDoc :

```typescript
/**
 * AudienceRulesBuilder
 * 
 * Accessibility:
 * - Rules tree is navigable via Tab/Shift+Tab
 * - Each rule announces its kind and current value via aria-label
 * - Add/remove buttons have explicit aria-label
 */
```
