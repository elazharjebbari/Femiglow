# 50.10 — Accessibility checklist (WCAG 2.1 AA)

## Niveau visé

- **AA** minimum sur tout le système (pages publiques + admin)
- **AAA** pour le body des pages légales publiques (texte critique)

## Checklist par perceptibilité

### 1.1 Alternatives textuelles

- [ ] Toutes les images informatives ont un `alt` significatif
- [ ] Images décoratives : `alt=""` ou `role="presentation"`
- [ ] Icônes interactives : `aria-label` descriptif
- [ ] Pas de texte présenté en image (sauf logo)

### 1.3 Adaptabilité

- [ ] Sémantique HTML correcte (`<main>`, `<nav>`, `<article>`, `<section>`)
- [ ] Headings hiérarchiques (H1 → H2 → H3, pas de saut)
- [ ] Tableaux : `<thead>`, `<tbody>`, `<th scope="col">`
- [ ] Listes : `<ul>`, `<ol>`, `<dl>` au lieu de `<div>`
- [ ] Forms : `<label for="...">` sur chaque input
- [ ] Order DOM = order visuel

### 1.4 Distinguabilité

- [ ] Contraste body : ≥ 7:1 (AAA)
- [ ] Contraste UI : ≥ 4.5:1 (AA)
- [ ] Texte resize 200% sans perte (CSS rem/em)
- [ ] Pas d'info passée uniquement par couleur (associé à icône / texte)
- [ ] Line-height ≥ 1.5, paragraphe spacing ≥ 2x font-size
- [ ] Largeur ≤ 80ch
- [ ] Pas de justify (lisibilité)

### 2.1 Accessibilité clavier

- [ ] Toutes les fonctions accessibles au clavier
- [ ] Pas de keyboard trap (Esc ferme modales)
- [ ] Tab order logique
- [ ] Raccourcis : doc + ne pas conflitter avec screen readers

### 2.4 Navigation

- [ ] Skip link "Aller au contenu principal"
- [ ] Titre de page unique (`<title>`)
- [ ] Liens : texte descriptif (pas "cliquez ici")
- [ ] Headings visibles permettent navigation lecteur d'écran
- [ ] Multiple ways pour naviguer (footer, menu, search)
- [ ] Focus visible (outline 2-3px)

### 2.5 Modalités de saisie

- [ ] Touch targets ≥ 44×44px sur mobile
- [ ] Pas de pinch-zoom requis (mais pas désactivé)
- [ ] Pas de motion-only actions (drag-and-drop alternative)
- [ ] Click annulable avant relâchement (mousedown != click)

### 3.1 Lisibilité

- [ ] `<html lang="fr">` (et `lang="ar"` en V2)
- [ ] Termes inhabituels : tooltip ou définition au premier usage
- [ ] Abréviations : `<abbr title="...">`
- [ ] Sigles : 1ère occurrence en clair

### 3.2 Prévisibilité

- [ ] Focus ne change pas le context (pas de form submit auto)
- [ ] Inputs ne soumettent pas le form au changement
- [ ] Nav cohérente entre les pages
- [ ] Composants identiques = comportement identique

### 3.3 Assistance à la saisie

- [ ] Labels associés explicitement
- [ ] Erreurs identifiées par texte + couleur + icône
- [ ] Suggestions d'erreur claires (`"Email doit contenir @"`)
- [ ] Prévention erreurs critiques : confirmation
- [ ] Help text disponible

### 4.1 Compatibilité

- [ ] Markup valide W3C
- [ ] ARIA utilisé correctement (pas d'over-usage)
- [ ] `aria-live` pour notifications dynamiques (toasts)
- [ ] `aria-busy` pendant chargement
- [ ] Composants custom : role + states + properties

## Tests automatisés

### axe-core (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('legal page is accessible', async ({ page }) => {
  await page.goto('/legal/cgv');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('admin editor is accessible', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/legal/cgv/edit');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### Lighthouse

```bash
pnpm lighthouse https://femiglow.ma/legal/cgv --only-categories=accessibility
```

Score cible : **≥ 95**.

## Tests manuels

### Keyboard

- [ ] Tab → focus sur premier lien
- [ ] Tab → progression logique sans skip
- [ ] Shift+Tab → retour fonctionnel
- [ ] Enter sur lien → navigation
- [ ] Esc → ferme modale ouverte

### Screen reader (NVDA / VoiceOver)

- [ ] Page title lu d'emblée
- [ ] Skip link annoncé en premier
- [ ] H1, H2 navigables par H key
- [ ] Liens lus comme tels
- [ ] Status badges (`✓ published`) lus correctement
- [ ] Tableaux : colonnes lues comme contexte

### Zoom 200%

- [ ] Pas de scroll horizontal
- [ ] Pas de texte coupé
- [ ] Pas de chevauchement
- [ ] Boutons clickables

### Daltonisme

- [ ] Status badges : icône + couleur (pas couleur seule)
- [ ] Liens : underline systématique
- [ ] Erreurs : icône ⚠ + texte

### Réduction de mouvement

- [ ] `prefers-reduced-motion: reduce` respecté
- [ ] Animations désactivables
- [ ] Pas d'auto-play

## A11y pour l'admin

L'admin n'est pas public mais doit être utilisable par :
- Admin malvoyant
- Admin avec handicap moteur (clavier only)
- Admin sur écran tactile

→ Mêmes règles que le public, avec attention particulière aux :
- Drag-and-drop : alternative clavier (flèches haut/bas + Enter)
- Markdown editor : compatibilité screen reader
- Color picker : valeurs hex saisissables

## Documentation

Document `a11y-guide.md` interne pour les développeurs avec :
- Composants prêts-à-l'emploi (LinkA11y, ButtonA11y, IconA11y)
- Lint rules eslint-plugin-jsx-a11y
- Pré-commit hook axe sur stories Storybook
