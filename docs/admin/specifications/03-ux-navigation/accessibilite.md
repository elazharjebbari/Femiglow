# Accessibilité — admin

> Cible : **WCAG 2.1 niveau AA** sur l'ensemble des pages admin.
> Verification : `jest-axe` automatique + audit manuel checklist.

---

## Checklist par page

Pour chaque page admin (`/admin/login`, `/admin/dashboard`, `/admin/leads`,
`/admin/leads/[id]`, `/admin/webhooks`, `/admin/webhooks/new`,
`/admin/webhooks/[id]`, `/admin/webhooks/[id]/deliveries`) :

### Structure

- [ ] `<html lang="fr">`.
- [ ] Une seule `<h1>` par page.
- [ ] Hiérarchie h1 → h2 → h3 sans saut.
- [ ] `<main>` unique englobe le contenu principal.
- [ ] Liens "Skip to content" (réutilise `SkipLink` existant).
- [ ] Landmarks ARIA : `<header>`, `<nav>`, `<main>`, `<aside>` correctement utilisés.

### Formulaires

- [ ] Chaque `<input>` a un `<label>` associé (réutilise `Field`).
- [ ] Les erreurs sont annoncées via `aria-describedby` pointant vers le
      message d'erreur.
- [ ] Les champs requis ont `required` + indication visuelle.
- [ ] Les groupes de radio ont `<fieldset>` + `<legend>`.
- [ ] Submit button a un libellé explicite (« Se connecter » pas « OK »).
- [ ] Erreurs de validation en `role="alert"` ou `aria-live="polite"`.

### Tableaux

- [ ] `<th scope="col">` pour les en-têtes de colonne.
- [ ] `<caption>` ou `aria-labelledby` pour le titre du tableau.
- [ ] Tri par colonne annoncé via `aria-sort="ascending|descending|none"`.
- [ ] Pagination annoncée : compteur "X-Y sur N" lisible vocalement.

### Couleurs et contraste

- [ ] Texte normal : contraste ≥ 4.5:1 sur le fond.
- [ ] Texte large (≥ 18 px ou ≥ 14 px gras) : contraste ≥ 3:1.
- [ ] Composants UI (bordures, icônes) : contraste ≥ 3:1.
- [ ] Couleur **n'est jamais le seul** vecteur d'information : statut =
      icône + couleur + texte.

### Focus

- [ ] Focus visible sur **tous** les éléments interactifs (pas de
      `outline: none` sans remplacement).
- [ ] Anneau de focus contraste ≥ 3:1 avec le fond.
- [ ] Ordre de tabulation logique (top → bottom, left → right).
- [ ] Aucun élément non-interactif ne reçoit le focus
      (`tabindex="-1"` ou rien).
- [ ] Pas de `tabindex > 0`.
- [ ] Focus trap dans les modales (`<dialog>` natif géré).
- [ ] Au close d'une modale, focus retourné au déclencheur.

### Clavier

- [ ] Toute action accessible à la souris l'est aussi au clavier.
- [ ] Dropdowns : Enter/Space pour ouvrir, ↑/↓ pour naviguer, Esc pour
      fermer, Tab pour sortir.
- [ ] Tabs : ←/→ pour naviguer, Home/End pour premier/dernier.
- [ ] Modales : Esc pour fermer, focus trap dedans.
- [ ] Pas de "souris obligatoire" (drag-and-drop sans alternative
      clavier interdit).

### Lecteurs d'écran

- [ ] Tout contenu pertinent est dans le DOM (pas généré exclusivement
      en CSS `::before/::after`).
- [ ] Icônes décoratives `aria-hidden="true"`.
- [ ] Icônes signifiantes ont `aria-label` explicite.
- [ ] Liens "en savoir plus" évités → libellé contextuel ("Voir les
      livraisons de CRM Hubspot").
- [ ] Notifications de succès/erreur dans `aria-live="polite"` ou
      `role="alert"` selon urgence.

### Mouvement

- [ ] `prefers-reduced-motion: reduce` désactive toutes animations
      > 80 ms.
- [ ] Pas d'animation infinie obligatoire (spinner OK car informatif).
- [ ] Pas de clignotement > 3 fois/seconde.

### Responsive

- [ ] Zoom 200 % : aucun contenu coupé, aucun scroll horizontal forcé.
- [ ] Texte resizable jusqu'à 200 % sans rupture de mise en page.
- [ ] Reflow : pas de scroll horizontal sur viewport ≥ 320 px de large.

## Tests automatiques

```ts
// apps/web/src/test/a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Admin pages a11y', () => {
  it('LoginForm has no a11y violations', async () => {
    const { container } = render(<LoginForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
  // ... un test par composant majeur
});
```

Voir [`../08-tests/accessibilite/jest-axe-checklist.md`](../08-tests/accessibilite/jest-axe-checklist.md)
pour la liste exhaustive.

## Tests manuels obligatoires avant go-live

1. **Navigation 100 % clavier** : se connecter, qualifier 1 lead,
   créer 1 webhook, rejouer 1 livraison — sans souris.
2. **Lecteur d'écran** : test rapide avec VoiceOver (macOS) ou NVDA
   (Windows).
3. **Zoom 200 %** : ouvrir chaque page, vérifier qu'aucune information
   n'est coupée.
4. **Mode dark forcé OS** : vérifier que rien n'est rendu illisible
   (l'admin reste light v1).
5. **Sans CSS** : `Disable styles` dans DevTools → la page reste
   sémantiquement lisible et navigable.
