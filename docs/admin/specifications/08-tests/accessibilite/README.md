# Accessibilité — stratégie de test

WCAG 2.1 niveau AA est l'objectif (cf.
[`../../03-ux-navigation/accessibilite.md`](../../03-ux-navigation/accessibilite.md)).
Cette section décrit **comment vérifier**.

## Limites de l'automation

| Outil | Couvre | Ne couvre PAS |
|---|---|---|
| jest-axe / axe-core | contraste, ARIA invalide, attributs requis, structure de heading | logique d'interaction, navigation au clavier réelle, expérience lecteur d'écran |
| Estimation | ~30 % des problèmes a11y détectables auto | les 70 % restants exigent revue humaine |

D'où la double approche : automation à chaque PR + revue manuelle
trimestrielle.

## Couche 1 — jest-axe (Vitest)

Sur chaque composant non trivial :

```ts
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('LeadFilters has no a11y violations', async () => {
  const { container } = render(<LeadFilters />);
  expect(await axe(container)).toHaveNoViolations();
});
```

### Composants couverts (minimum)

- Tous les composants `src/components/admin/*.tsx`.
- Toutes les pages via leur composant racine wrappé en provider.

### Configuration

```ts
// vitest.setup.ts
import { configureAxe } from 'jest-axe';

export const axeConfig = configureAxe({
  rules: {
    // 'region' désactivé sur composants extraits (pas de landmark requis)
    region: { enabled: false },
  },
});
```

## Couche 2 — @axe-core/playwright (E2E)

Scan complet de chaque page critique en contexte navigateur :

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';

test('admin pages pass axe scan', async ({ page }) => {
  await login(page);
  for (const path of ['/admin/dashboard', '/admin/leads', '/admin/webhooks']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, `Violations on ${path}`).toEqual([]);
  }
});
```

## Couche 3 — checklist manuelle

Exécutée **trimestriellement** par la fondatrice avec assistance dev.
Tracée dans `docs/admin/audits/a11y-YYYY-Qn.md`.

### Checklist clavier

- [ ] Tab cycle dans l'ordre logique sur chaque page
- [ ] Shift+Tab fait l'inverse
- [ ] Enter active le bouton focus
- [ ] Espace coche la case focus
- [ ] Esc ferme modal/drawer
- [ ] Aucun "trap" (focus bloqué dans un sous-arbre involontaire)
- [ ] Focus visible (anneau saillant, contraste 3:1 minimum)
- [ ] Skip-link "Aller au contenu" fonctionne

### Checklist lecteur d'écran

Outils : VoiceOver (macOS), NVDA (Windows).

- [ ] Heading 1 unique par page, hiérarchie correcte
- [ ] Landmarks `<nav>`, `<main>`, `<header>`, `<footer>` annoncés
- [ ] Boutons annoncés avec leur état (`aria-expanded`, `aria-pressed`)
- [ ] Tableaux annoncent en-têtes lors de la navigation cellule par cellule
- [ ] Modal annoncé avec son titre à l'ouverture, focus rendu à l'ouverture
- [ ] Toast/erreur annoncé via `role=alert` ou `aria-live=assertive`

### Checklist visuelle

- [ ] Ratio de contraste texte ≥ 4.5:1 (3:1 pour gros texte)
- [ ] Aucune information transmise uniquement par couleur
- [ ] Texte agrandi 200 % reste lisible et navigable
- [ ] `prefers-reduced-motion: reduce` honoré (pas d'animation pulse,
      pas d'auto-scroll, transitions instantanées)
- [ ] Pas de clignotement > 3 Hz

### Checklist contenus

- [ ] Tous les `<img>` ont un `alt` pertinent (vide pour décoratif)
- [ ] Tous les inputs ont un `<label>`
- [ ] Erreurs reliées via `aria-describedby`
- [ ] Aucun `<a>` avec libellé "cliquez ici" ou "lire la suite"
- [ ] Langue déclarée `<html lang="fr">`

## Cas particuliers du template

### Tableaux

`<table>` avec `<thead>`, `<th scope="col">`, `<caption>` (visuellement masqué via `sr-only` si nécessaire).

```tsx
<table>
  <caption className="sr-only">Liste des leads filtrés</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Nom</th>
      …
    </tr>
  </thead>
  …
</table>
```

### Drawer

```tsx
<aside
  role="dialog"
  aria-labelledby="drawer-title"
  aria-modal="true"
>
  <h2 id="drawer-title">Détail livraison</h2>
  …
</aside>
```

Focus piégé tant qu'ouvert (`focus-trap-react`), restauré à l'élément
déclencheur à la fermeture.

### Toasts

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {toastMessage}
</div>
```

`role="status"` (polite) pour confirmations, `role="alert"` (assertive) pour erreurs.

### Status badge

Le badge ne suffit pas — texte explicite à côté.

```tsx
<Badge>Nouveau</Badge>
{/* lecteur d'écran : "Nouveau" est lu */}
```

Si on veut juste l'aspect visuel sans texte perceptible, ajouter `aria-label`.

## Tests

| Type | Fichier |
|---|---|
| Unit | `*.test.tsx` (avec `expect(await axe(...)).toHaveNoViolations()`) |
| E2E | `e2e/a11y-*.spec.ts` |
| Manuel | trimestriel, doc dans `docs/admin/audits/` |

## Échec

Une violation a11y dans une PR :
- doit être corrigée avant merge,
- ou explicitement justifiée avec `axe.disableRules([...])` + commentaire.

Aucun "TODO a11y" toléré dans le code mergé.
