# 09 — Ergonomie & accessibilité

> *L'ergonomie est très importante. Un site luxueux qui exclut est un site raté.*

---

## 1. Principes ergonomiques fondateurs

L'ergonomie chez FemiGlow repose sur cinq lois lisibles à toutes les étapes de design :

| Loi | Énoncé | Application |
|---|---|---|
| **Loi de Fitts** | Le temps d'atteinte d'une cible dépend de sa taille et distance | CTA pivot ≥ 56 px de haut, à portée de pouce sur mobile |
| **Loi de Hick** | Plus de choix = plus de temps de décision | Header limité à 4 entrées, page produit à 1 produit |
| **Loi de Miller** | 7±2 unités tenues en mémoire de travail | Sections groupées en 3-5 items, pas de listes > 7 éléments |
| **Loi de Jakob** | L'utilisateur s'attend à des conventions | Panier en haut à droite, footer en bas, breadcrumb sous header |
| **Loi de Tesler** | La complexité est conservée — soit côté système, soit côté utilisateur | Le système absorbe (validation Zod live, format auto téléphone) |

> **Règle d'or ergonomique** — un visiteur sait ce qu'il a à faire dans les **5 premières secondes** sur n'importe quelle page sans bouger la souris.

## 2. Conformité visée

| Niveau | Couverture |
|---|---|
| **WCAG 2.2 AA** | Conformité totale, validée par axe + revue manuelle |
| **WCAG 2.2 AAA** | Tendances cibles : contrastes (sauf pour les éléments de marque tolérés), focus visibles 3 px |
| **EN 301 549** | Préparation pour le marché européen Phase 2 |
| **RGAA 4.1** | Référentiel français appliqué là où il complémente WCAG |
| **Section 508** | Compatibilité screen readers (NVDA, VoiceOver, JAWS, TalkBack) |

## 3. Hiérarchie sémantique HTML

Chaque page expose une structure de *landmarks* lisible par lecteur d'écran :

```html
<body>
  <a class="skip-link" href="#main">Aller au contenu</a>
  <header role="banner">
    <nav aria-label="Navigation principale">...</nav>
  </header>
  <main id="main" tabindex="-1">
    <h1>Titre de la page</h1>
    <section aria-labelledby="manifeste-title">
      <h2 id="manifeste-title">Le manifeste</h2>
      ...
    </section>
  </main>
  <footer role="contentinfo">...</footer>
</body>
```

**Règles strictes** :

- **Un seul `<h1>` par page** (le titre éditorial)
- **Hiérarchie h1 → h2 → h3 sans saut** (pas de h2 → h4)
- **`<main>`** unique, focusable via skip-link
- **`<nav>`** étiquetés (`aria-label="Navigation principale"`, `"Fil d'Ariane"`, `"Pied de page"`)
- **`<section>`** étiquetée par `aria-labelledby` pointant le heading interne
- **`<button>`** vs **`<a>`** : une action = bouton, une navigation = lien (jamais l'inverse, jamais de `<div onclick>`)

## 4. Skip links & navigation clavier

### 4.1 Skip link

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-encre);
  color: var(--color-creme);
  padding: 12px 16px;
  z-index: 1000;
  transition: top 200ms var(--ease-out-soft);
}
.skip-link:focus {
  top: 0;
}
```

Toujours **première mise au point** de la page après chargement. Texte : « Aller au contenu ».

### 4.2 Tab order

L'ordre de tabulation suit l'ordre visuel : header → main → footer. Aucun `tabindex` positif autre que `-1` (pour focus programmatique) ou `0` (élément non-natif rendu focusable).

**Test obligatoire** : naviguer chaque page entièrement au clavier sans souris. Tous les liens, boutons, champs doivent être atteignables et utilisables.

### 4.3 Raccourcis clavier

| Touche | Action |
|---|---|
| `Tab` / `Shift+Tab` | Navigation avant / arrière |
| `Enter` | Activer lien ou bouton |
| `Espace` | Activer bouton, cocher checkbox, scroller page |
| `Esc` | Fermer drawer / modal / dropdown |
| `Flèches ↑↓` | Navigation accordéon FAQ, options select custom |
| `/` (Phase 2) | Focus sur recherche journal |

Pas de raccourcis surchargés (pas de `Ctrl+K` palette).

### 4.4 Focus visible

```css
:focus-visible {
  outline: 2px solid var(--color-sauge);
  outline-offset: 3px;
  border-radius: 0;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-encre);
  outline-offset: 3px;
}
```

**Jamais `outline: none`** sans remplacement visible. Le focus est l'identité du parcours clavier.

## 5. Focus management dans les overlays

### 5.1 Cart drawer

```tsx
'use client';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

export function CartDrawer({ isOpen, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement;
    return () => previouslyFocused?.focus();
  }, [isOpen]);

  // ... ESC key listener, backdrop click
}
```

**Règles** :

- À l'ouverture : focus déplacé sur le bouton Close (premier élément focusable)
- Pendant ouverture : Tab ne sort pas du drawer
- À la fermeture : focus revient sur l'élément déclencheur
- ESC ferme l'overlay
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby` sur le titre
- `inert` sur les autres landmarks (Phase 2 quand support stable)

### 5.2 Mobile menu

Mêmes règles que cart drawer. Hamburger reste focusable même quand panel ouvert pour permettre fermeture clavier.

## 6. Contrastes (validés)

Rappel doc 02 — contrastes vérifiés WCAG AA :

| Combinaison | Ratio | Statut |
|---|---|---|
| Encre `#2C2A28` sur Crème `#FBF8F1` | 13.2:1 | ✅ AAA |
| Encre `#2C2A28` sur Sauge `#C5DBC4` | 8.4:1 | ✅ AAA |
| Encre `#2C2A28` sur Pétale `#F2CECC` | 8.7:1 | ✅ AAA |
| Encre `#2C2A28` sur Champagne `#C8A876` | 5.1:1 | ✅ AA texte normal |
| Crème `#FBF8F1` sur Encre `#2C2A28` | 13.2:1 | ✅ AAA |
| Sauge dark `#9CB89B` sur Crème | 3.5:1 | ✅ AA large text uniquement (≥18pt) |
| Encre/60 sur Crème (texte secondaire) | 6.8:1 | ✅ AA |
| Encre/40 sur Crème (texte placeholder) | 3.8:1 | ⚠️ AA seulement large — réservé placeholder, pas texte critique |

**Outils de vérification** : axe DevTools, WebAIM Contrast Checker, Stark plugin Figma. CI vérifie via `eslint-plugin-jsx-a11y` + `jest-axe`.

## 7. Tap targets (mobile)

| Élément | Taille minimale | Espacement |
|---|---|---|
| Bouton primaire | 56 × 200 px (CTA), 48 × 120 px (secondary) | 16 px entre boutons adjacents |
| Bouton secondaire | 44 × min 88 px | 12 px |
| Lien inline | hit area étendue à 44 px via padding | n/a |
| Checkbox / Radio | 24 × 24 px visuel, 44 × 44 px hit area | 8 px |
| Icone interactive (close, panier) | 44 × 44 px | 8 px |
| Item liste (FAQ) | 48 px hauteur min | 0 |

**Implementation** : utiliser `padding` invisible plutôt que reduce visual size. Exemple :

```css
.icon-button {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-button svg {
  width: 20px;
  height: 20px;
}
```

## 8. Formulaires : ergonomie clinique

### 8.1 Anatomie d'un champ

```tsx
<div className="field">
  <label htmlFor="email" className="field-label">
    Adresse email
    <span aria-hidden="true">*</span>
  </label>
  <input
    id="email"
    name="email"
    type="email"
    required
    aria-required="true"
    aria-invalid={errors.email ? 'true' : 'false'}
    aria-describedby={errors.email ? 'email-error email-help' : 'email-help'}
    autoComplete="email"
    inputMode="email"
  />
  <p id="email-help" className="field-help">
    Pour la confirmation de commande uniquement.
  </p>
  {errors.email && (
    <p id="email-error" role="alert" className="field-error">
      {errors.email.message}
    </p>
  )}
</div>
```

### 8.2 `autoComplete` attributes (obligatoires)

| Champ | Valeur |
|---|---|
| Prénom | `given-name` |
| Nom | `family-name` |
| Email | `email` |
| Téléphone | `tel` |
| Adresse ligne 1 | `address-line1` |
| Adresse ligne 2 | `address-line2` |
| Ville | `address-level2` |
| Code postal | `postal-code` |
| Pays | `country-name` |
| Carte numéro | `cc-number` |
| Carte expiration | `cc-exp` |
| Carte CVC | `cc-csc` |

### 8.3 `inputMode` (clavier mobile)

| Champ | Valeur |
|---|---|
| Téléphone | `tel` |
| Code postal | `numeric` |
| Carte | `numeric` |
| Email | `email` |

### 8.4 Messages d'erreur

| Règle | Application |
|---|---|
| **Spécifique** | « Le numéro doit commencer par +212 ou 0 » (pas « Numéro invalide ») |
| **Constructif** | Indique comment corriger |
| **Inline** | Sous le champ, jamais en haut de page |
| **`role="alert"`** | Annonce immédiate aux lecteurs d'écran |
| **Coloré** | Pétale dark `#C76C68` (validé contraste) |
| **Jamais en majuscules** | « Email requis » pas « EMAIL REQUIS » |
| **Sans point d'exclamation** | « Champ obligatoire » pas « Obligatoire ! » |

### 8.5 Validation timing

| Phase | Comportement |
|---|---|
| Saisie active (`onChange`) | Aucune erreur affichée — bordure neutre |
| Sortie de champ (`onBlur`) | Validation Zod déclenchée, erreur si invalide |
| Soumission (`onSubmit`) | Tous les champs validés, focus sur le premier en erreur |
| Champ corrigé après erreur | Erreur effacée immédiatement (bordure passe à success) |

## 9. Lecteurs d'écran (live regions, ARIA)

### 9.1 Live regions principales

| Région | `aria-live` | Usage |
|---|---|---|
| Compteur panier | `polite` | « Article ajouté. Panier : 2 articles » |
| Toast erreur form | `assertive` | « Erreur sur le formulaire » |
| Toast confirmation | `polite` | « Newsletter confirmée » |
| Loading bouton | `busy="true"` | « Chargement en cours » |
| Stepper checkout | `polite` | « Étape 2 sur 3 : livraison » |

### 9.2 ARIA patterns par composant

| Composant | Rôle / attributs |
|---|---|
| Accordéon FAQ | `<button aria-expanded aria-controls>` + `<div role="region" aria-labelledby>` |
| Tabs `/kit` | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"` |
| Cart drawer | `role="dialog" aria-modal="true" aria-labelledby` |
| Stepper | `<ol aria-label="Étapes de commande">` + `aria-current="step"` sur item actif |
| Image décorative | `alt=""` ou `role="presentation"` |
| Image informative | `alt="description signifiante"` |
| Image complexe (composition kit) | `alt="résumé court"` + `aria-describedby` vers paragraphe long |
| Badge promo | `<span class="visually-hidden">Promotion :</span>` |
| Date publication article | `<time datetime="2026-03-15">` |
| Prix | `<span class="visually-hidden">Prix : </span>320 dirhams` |

### 9.3 Visually hidden utility

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Pour texte lu par lecteur d'écran sans rendu visuel.

## 10. Texte et lisibilité

| Règle | Valeur |
|---|---|
| **Taille minimale corps** | 16 px (1 rem) |
| **Line-height corps** | 1.6 minimum |
| **Mesure de ligne (longueur)** | 60-75 caractères pour articles, 50-65 pour intros |
| **Largeur max texte long** | 680 px (`--max-width-prose`) |
| **Justification** | `text-align: left` exclusivement (justify casse le rythme) |
| **Hyphens** | `auto` sur paragraphes longs en mobile |
| **Word-spacing** | jamais modifié (laisser native) |
| **Letter-spacing** | seulement sur all-caps display, jamais sur corps |
| **Italiques** | < 3 lignes consécutives |

## 11. Images & médias

### 11.1 Texte alternatif

| Image | Stratégie alt |
|---|---|
| Photo hero contextuelle | `alt="Mains posées sur une table, appliquant un soin transparent"` |
| Image produit `/kit` | `alt="Le rituel FemiGlow : flacon de soin, étiquette saison hiver"` |
| Photo article journal | descriptive du sujet, pas de l'esthétique |
| Image décorative (motif vague) | `alt=""` + `role="presentation"` |
| Logo / wordmark | `alt="FemiGlow"` (une seule fois par page) |
| Illustration manifeste | `alt=""` si répète le texte adjacent |

### 11.2 Vidéos

| Élément | Exigence |
|---|---|
| Caption (sous-titres) | Obligatoire — fichier `.vtt` chargé |
| Audio description | Si vidéo informative (pas de voix off → non requis) |
| Transcript | Lien sous la vidéo « Lire la transcription » |
| Auto-play | Interdit (cf. doc 08) |
| Controls | `<video controls>` natif minimum |
| `prefers-reduced-data` | Vidéo non-précharge automatiquement |

### 11.3 Images décoratives motifs (vague, fleuron, étiquettes)

```html
<img src="/motifs/vague.svg" alt="" aria-hidden="true" />
```

ou en CSS background si purement esthétique.

## 12. Couleur comme seul indicateur (interdit)

WCAG 1.4.1 — La couleur seule ne doit jamais transporter une information.

| Cas | Solution |
|---|---|
| État erreur form | Couleur Pétale + icône + texte « Erreur : ... » |
| Lien dans paragraphe | Couleur + soulignement (sauf footer où contexte clair) |
| Status commande | Couleur badge + label texte (« Confirmée », « Expédiée ») |
| Promo prix | Couleur barré + classe `.price-original` + texte « Ancien prix : » SR-only |
| Disponibilité | Couleur + label « En stock » / « Bientôt » |

## 13. Mouvement et accessibilité (rappel)

`prefers-reduced-motion: reduce` désactive :

- Toutes les transitions Framer Motion (configurer `MotionConfig` global)
- Parallaxes scroll
- Ken Burns sur cards
- Auto-play vidéos (jamais autorisées de toute façon)
- Animation tracé `/merci`

```tsx
// app/layout.tsx
import { MotionConfig } from 'framer-motion';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
```

## 14. Responsive & zoom

| Critère | Conformité |
|---|---|
| **Zoom 200 %** | Aucun contenu coupé, scroll horizontal interdit |
| **Zoom texte 200 %** | Layout reste fonctionnel, aucun overflow |
| **Reflow 320 px** | WCAG 1.4.10 — pas de scroll horizontal en dessous de 320 px |
| **Orientation** | Portrait et paysage — pas de blocage forcé |
| **`viewport`** | `width=device-width, initial-scale=1` — **jamais `user-scalable=no`** |

## 15. Touch & gestures

| Geste | Alternative obligatoire |
|---|---|
| Swipe carrousel témoignages | Boutons précédent/suivant visibles |
| Pinch zoom image produit | Bouton « Agrandir » qui ouvre lightbox |
| Pull to refresh | Aucun (pas de PWA Phase 1) |
| Long press | Aucun usage |

WCAG 2.5.1 — toute fonctionnalité accessible au geste complexe doit l'être au tap simple.

## 16. Identification des liens

| Type | Indication |
|---|---|
| Lien dans corps de texte | Soulignement permanent + couleur Encre |
| Lien dans menu | Pas de soulignement, mais hover trait sous label |
| Lien externe | Picto `↗` + `aria-label="ouvre dans un nouvel onglet"` + `rel="noopener noreferrer"` |
| Lien email/tel | `mailto:` `tel:` + style identique aux liens internes |
| Lien fichier (PDF) | Picto + indication taille « (PDF, 240 ko) » |

## 17. Errors et timeouts

| Cas | Comportement |
|---|---|
| Session checkout expire | Avertissement 60s avant + bouton « Prolonger » |
| Captcha (newsletter) | hCaptcha avec mode accessible |
| Formulaire bloqué (rate limit) | Message clair : « Limite atteinte. Réessayez dans 5 minutes. » |
| Validation Zod async | Affiche après debounce 500 ms, ne flash pas |
| Erreur réseau | Conserve toutes les saisies en localStorage avant submit (récupération) |

## 18. Tests d'accessibilité

| Niveau | Outil / méthode | Fréquence |
|---|---|---|
| **Statique CI** | `eslint-plugin-jsx-a11y` | Chaque commit |
| **Unitaire composant** | `jest-axe` dans Storybook + Vitest | Chaque PR |
| **E2E** | `@axe-core/playwright` | Avant merge sur main |
| **Manuel clavier** | Navigation Tab uniquement, sans souris | Chaque page release |
| **Manuel lecteur écran** | NVDA (Windows), VoiceOver (macOS / iOS), TalkBack (Android) | Avant chaque release majeure |
| **Manuel zoom** | 200 % et 400 % en Chrome / Firefox / Safari | Pré-release |
| **Audit externe** | Cabinet RGAA / WCAG (Phase 2) | Annuel |

### Exemple test Vitest + jest-axe

```ts
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './Button';

expect.extend(toHaveNoViolations);

it('Button has no a11y violations', async () => {
  const { container } = render(<Button>Découvrir</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 19. Checklist d'ergonomie par page

Avant qu'une page soit déclarée prête :

- [ ] Skip link fonctionnel
- [ ] Hiérarchie h1 → h2 → h3 sans saut
- [ ] Tous les `<img>` ont un `alt` adéquat (vide si décoratif)
- [ ] Toutes les actions sont des `<button>`, toutes les navigations des `<a>`
- [ ] Tab order suit l'ordre visuel
- [ ] Focus visible sur 100 % des éléments interactifs
- [ ] Tap targets ≥ 44 × 44 px
- [ ] Contrastes vérifiés sur tous les textes
- [ ] `prefers-reduced-motion` testé
- [ ] Zoom 200 % testé
- [ ] Reflow 320 px testé
- [ ] Lecteur d'écran : ordre lecture, landmarks, états
- [ ] Forms : autoComplete, inputMode, aria-describedby, role="alert"
- [ ] axe-core : 0 violation
- [ ] Lighthouse Accessibility : ≥ 95

## 20. Documentation interne

Chaque composant Storybook expose un onglet « Accessibility » documentant :

- Rôle ARIA et attributs
- Tab order interne
- Raccourcis clavier supportés
- Live regions exposées
- Comportement reduced-motion
- Score axe-core

> *Document suivant : [10 — Performance & Web Vitals](./10-performance-web-vitals.md)*
