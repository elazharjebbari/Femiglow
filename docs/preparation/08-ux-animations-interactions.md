# 08 — UX, animations, micro-interactions

> *Choré­graphie du mouvement, qualité perçue, fluidité de l'interface*

---

## 1. Philosophie : le mouvement comme silence

Chez FemiGlow, le mouvement n'amuse pas — il accompagne. Une transition n'a jamais valeur de spectacle ; elle valide une intention, ralentit le geste pour qu'il soit perçu, ou prépare l'œil à une nouvelle information. Le rythme cible est celui d'une **boutique parisienne haut de gamme un matin calme** : portes qui s'ouvrent doucement, soie qui glisse, lumière qui change d'angle.

Trois principes directeurs :

| Principe | Signification | Conséquence design |
|---|---|---|
| **Discrétion** | Aucune animation n'attire l'œil pour elle-même | Pas de bounces, pas de spring exagérés, pas d'auto-play |
| **Lenteur perçue** | Durations 300-600 ms, jamais < 200 ms ni > 1200 ms | Donne le temps de l'attention sans frustrer |
| **Réversibilité** | Toute animation peut être interrompue, inversée, ignorée | `prefers-reduced-motion` total respect, pas de blocage |

> **Règle d'or** — si retirer l'animation ne dégrade pas la compréhension, l'animation est **superflue** et doit être supprimée.

## 2. Tokens d'animation (rappel doc 02)

```css
:root {
  /* Durées */
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-base: 300ms;
  --duration-slow: 500ms;
  --duration-cinematic: 800ms;
  --duration-epic: 1200ms;

  /* Courbes */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-silk: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-in-quiet: cubic-bezier(0.4, 0, 1, 1);
  --ease-elastic-subtle: cubic-bezier(0.34, 1.26, 0.64, 1); /* à doser */
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Loi 60/30/10 du mouvement** : 60 % des transitions en `--duration-base` (300 ms), 30 % en `--duration-slow` (500 ms), 10 % en `--duration-cinematic` (800 ms) pour les hero et apparitions de page. Au-delà : exception documentée.

## 3. Choré­graphie d'apparition d'une page

Toute page B2C suit le même rituel d'arrivée :

```
T+0ms      Layout + header + footer rendus en SSR — pas d'animation
T+0ms      Le hero est déjà visible (pas d'effet « curtain »)
T+150ms    Wordmark : fade in 200 ms (--ease-out-soft)
T+200ms    Hero title : translateY(8px) + opacity 0 → 1 sur 600 ms
T+350ms    Hero subtitle : même mouvement, décalé de 150 ms
T+500ms    Hero CTA : translateY(4px) + opacity 0 → 1 sur 400 ms
T+700ms    Image hero : opacity 0 → 1 + scale(1.02) → 1 sur 800 ms
```

**Stagger** entre éléments : 100 à 200 ms, jamais moins (sensation de précipitation), jamais plus (sensation de lenteur excessive).

**Implementation Framer Motion** :

```tsx
// components/sections/hero/Hero.tsx
'use client';

import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 1 },
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function Hero({ title, subtitle, cta, image }: HeroProps) {
  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="visible"
      className="hero"
    >
      <motion.h1 variants={item}>{title}</motion.h1>
      <motion.p variants={item}>{subtitle}</motion.p>
      <motion.div variants={item}><Button {...cta} /></motion.div>
    </motion.section>
  );
}
```

**Important** — pas d'animation au-dessus de la ligne de flottaison qui dépende de `IntersectionObserver` : le contenu doit déjà être posé. L'animation décore, elle n'introduit pas.

## 4. Apparition sur scroll (sections internes)

Pour chaque section sous le hero, utiliser **scroll-driven animations** ou Framer Motion `whileInView`.

| Section | Effet | Distance | Durée | Trigger |
|---|---|---|---|---|
| Manifeste | fade + translateY 12px | once | 700 ms | `viewport: { once: true, margin: '-15% 0px' }` |
| Composition (kit) | stagger 4 items, 80 ms each | once | 500 ms/item | margin '-10% 0px' |
| Témoignages | fade simple, pas de translation | once | 600 ms | margin '-20% 0px' |
| Étiquettes circulaires | rotate 0deg → -8deg + scale(0.95) → 1 | once | 800 ms | margin '0px' |
| Photo contextuelle | scale(1.04) → 1 + opacity | once | 1000 ms | margin '-5% 0px' |

**Toujours `once: true`** — pas de re-trigger au scroll up. Ce serait du gimmick.

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-15% 0px' }}
  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
>
  {children}
</motion.div>
```

**Wrapper réutilisable** : `<Reveal />` dans `components/patterns/Reveal.tsx`, accepte `delay`, `distance`, `direction` pour normaliser le pattern à travers les pages.

## 5. Micro-interactions par composant

### 5.1 Button

| État | Transition | Tokens |
|---|---|---|
| `hover` | background-color + translateY(-1px) | 200 ms `--ease-out-soft` |
| `active` (press) | scale(0.98) + brightness(0.95) | 100 ms `--ease-in-quiet` |
| `focus-visible` | outline 2px Sauge offset 3px | instant |
| `loading` | label fade out, spinner fade in (cross-fade) | 200 ms |
| `disabled` | opacity 0.4, cursor not-allowed | instant |

**Jamais d'effet de relief** (no shadow on hover sur primary). FemiGlow n'est pas un site de SaaS.

### 5.2 Card (article, geste, témoignage)

```css
.card {
  transition: transform var(--duration-base) var(--ease-out-soft);
}
.card:hover {
  transform: translateY(-2px);
}
.card-image {
  transition: transform var(--duration-slow) var(--ease-out-soft);
}
.card:hover .card-image {
  transform: scale(1.02);
}
```

**Ken Burns à demi-mesure** : l'image agrandit légèrement, la carte remonte de 2 px. Aucune ombre n'apparaît — la séparation reste typographique.

### 5.3 Input (champs formulaire)

| État | Visuel |
|---|---|
| `idle` | border 1px Encre/20 |
| `focus` | border 1px Sauge, transition 150 ms |
| `filled` | border 1px Encre/40 |
| `error` | border 1px Pétale/dark, label rouge, message inline |
| `success` (validation Zod live) | border 1px Sauge, sans icône |

**Label flottant** : translation Y de 8 px à 0, scale 1 → 0.85, durée 200 ms `--ease-out-soft`. Aucun rebond.

### 5.4 NavItem (header)

```css
.nav-item {
  position: relative;
}
.nav-item::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -4px;
  height: 1px;
  background: var(--color-encre);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--duration-base) var(--ease-out-soft);
}
.nav-item:hover::after,
.nav-item[aria-current="page"]::after {
  transform: scaleX(1);
}
```

Trait fin sous le label, expansion gauche → droite. Pas de change de couleur.

### 5.5 Cart drawer (overlay)

| Phase | Animation |
|---|---|
| Backdrop in | opacity 0 → 0.4, 250 ms |
| Drawer in | translateX(100%) → 0, 400 ms `--ease-out-soft` |
| Items in | stagger 60 ms, fade only, 300 ms each |
| Drawer out | translateX 0 → 100%, 350 ms `--ease-in-quiet` |
| Backdrop out | opacity 0.4 → 0, 200 ms (commence 100 ms après drawer) |

**Lock body scroll** pendant ouverture (cf. doc 09 pour focus trap).

### 5.6 Toggle accordéon (FAQ)

```tsx
<motion.div
  initial={false}
  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
  transition={{
    height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    opacity: { duration: 0.25, delay: isOpen ? 0.1 : 0 },
  }}
  style={{ overflow: 'hidden' }}
>
  <div className="faq-answer">{answer}</div>
</motion.div>
```

Chevron : rotation `0deg ↔ 90deg`, 300 ms.

### 5.7 Tab pivot (`/kit` composition / FAQ / témoignages)

Underline animé qui glisse d'un onglet à l'autre :

```tsx
{activeTab === id && (
  <motion.span
    layoutId="tab-underline"
    className="tab-underline"
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
  />
)}
```

`layoutId` partagé permet à Framer Motion de calculer la trajectoire entre tabs sans configuration manuelle.

### 5.8 Add to cart (action pivot)

Séquence chorégraphiée — c'est le seul moment du site qui a droit à un peu de drame retenu :

```
T+0ms     Click bouton "Ajouter au rituel" → loading state immédiat
T+0ms     Spinner mince apparaît sur le label
T+200ms   Réponse store mise à jour
T+200ms   Label change : "Ajouté au rituel"
T+250ms   Compteur panier (header) incrémente avec un tick visuel
          (scale 1 → 1.15 → 1, 400 ms total)
T+1500ms  Label revient à "Ajouter au rituel"
```

**Pas de toast bruyant.** Pas d'animation de produit qui « vole » vers le panier (kitsch e-commerce générique). Le compteur header est la confirmation suffisante.

## 6. Choré­graphie du tunnel checkout

Les 3 étapes (`/commander`) utilisent une **transition horizontale** subtile, pas un slide brutal :

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={step}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
  >
    {stepContent}
  </motion.div>
</AnimatePresence>
```

Le **stepper** (1 — 2 — 3) anime le passage avec un trait qui se complète :

- step inactive : cercle Encre/20
- step active : cercle plein Sauge, label en gras
- step completed : cercle Encre, check intérieur (animation de tracé SVG, 400 ms)

**Aucune validation par défaut** sur erreur de saisie : on n'agresse pas l'utilisateur. Validation `onBlur` ou `onSubmit`, jamais `onChange` (sauf pour la validation Zod live douce qui colore la bordure sans afficher d'erreur tant que le champ n'a pas été quitté).

## 7. Page `/merci` — moment de lettre

C'est le seul endroit où l'on s'autorise une **animation de tracé manuscrit** sur la signature SVG :

```tsx
<motion.svg viewBox="0 0 200 60">
  <motion.path
    d="M10 30 C 30 10, 70 10, 90 30 ..."
    fill="none"
    stroke="var(--color-encre)"
    strokeWidth="1.2"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{ duration: 1.6, ease: 'easeInOut', delay: 1.2 }}
  />
</motion.svg>
```

Tracé en 1.6 s après que le reste de la page se soit posé. Cette signature est l'unique « effet » du site — elle marque la bascule transaction → relation.

## 8. Parallaxe & scroll effects

**Refus formel** des parallaxes verticales lourdes (effet « zine ») et des sticky scrolls détournés. La seule parallaxe autorisée :

| Lieu | Effet | Amplitude |
|---|---|---|
| `/maison` photo fondatrice | translate Y -40 px sur scroll de la section | discret |
| `/rituel` motif vague de fond | translateY -20px, opacity 0.3 → 0.5 | très discret |

**Implementation** : `useScroll` + `useTransform` Framer Motion. Throttle natif via rAF. Désactivation totale en `prefers-reduced-motion`.

## 9. Loading states

| Contexte | Pattern |
|---|---|
| Fetch initial (RSC) | Aucun loader visible — le SSR rend déjà |
| Loader page (App Router `loading.tsx`) | Skeleton typographique + image placeholder Sauge/20 (no shimmer agressif) |
| Bouton soumission | Spinner inline, label change après 200 ms si toujours pending |
| Sub-action (newsletter) | Bouton désactivé + spinner remplace le label |
| Skeleton cards (journal) | Block Sauge/10 avec animation `pulse` lente, 1500 ms cycle |

**Skeleton CSS** :

```css
@keyframes femiglow-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.6; }
}
.skeleton {
  background: var(--color-sauge-soft);
  animation: femiglow-pulse 1500ms var(--ease-in-out-silk) infinite;
}
```

Pas de shimmer (skewed gradient sweep) — trop tech, trop SaaS.

## 10. Empty states

| Page | Contexte vide | Traitement |
|---|---|---|
| `/journal` | Aucun article (théorique) | Texte éditorial : « Le journal s'écrit chaque saison. Premier billet à venir. » |
| `/panier` | Panier vide | Illustration discrète + « Votre panier est silencieux. » + CTA `/kit` |
| Recherche journal | 0 résultat | « Rien de cette saison ne porte ce mot. Essayez : *hiver*, *cuticules*, *patience*. » |

**Aucune illustration cute** (pas de personnage, pas d'animal). Pictogramme sobre Sauge ou typographie seule.

## 11. Erreurs (4xx / 5xx)

| Erreur | Page | Ton |
|---|---|---|
| 404 | `app/not-found.tsx` | « Cette page n'existe plus dans la maison. » + 4 redirections (rituel, kit, journal, accueil) |
| 500 | `app/error.tsx` | « Un imprévu. Notre équipe est prévenue. » + bouton « Recharger la page » |
| Form error | inline | message court Pétale, sans alarme |
| Stripe decline | inline panier checkout | « Le paiement n'a pas abouti. Vérifiez vos informations ou essayez une autre carte. » |

Aucune erreur n'utilise de point d'exclamation. Aucune ne dit « Oups ».

## 12. Hover, focus & touch

**Coexistence pointer/touch** :

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }
}
```

Sur mobile, les hover effects ne déclenchent pas (sinon ils restent collés après le tap). Les états visités sont gérés par `:active` (court) ou `aria-pressed`.

**Tap targets** : minimum 44×44 px (Apple HIG / WCAG 2.5.5). Voir doc 09 pour détail.

## 13. Préférences utilisateur

| Préférence système | Conséquence |
|---|---|
| `prefers-reduced-motion: reduce` | Toutes les animations à 0.01 ms, scroll-behavior auto |
| `prefers-color-scheme: dark` | **Phase 1** : non supporté (palette claire forcée). Phase 2 : étude possible mais peu pertinent pour le contexte luxe-éditorial |
| `prefers-reduced-data` | Vidéos auto-désactivées, image hero passe en `loading="lazy"` même above-the-fold |
| `prefers-contrast: more` | Bordures forms en 1.5 px au lieu de 1 px, focus offset 4 px au lieu de 3 |

## 14. Transitions de page (App Router)

**Phase 1** : transitions natives Next.js (rendu instantané, navigation sans état). Pas de `<PageTransition />` global pour conserver la prévisibilité du linking interne.

**Phase 2 envisageable** : View Transitions API (now in stable Chrome / Safari TP) avec fallback no-op pour Firefox.

```tsx
// Future implementation
import { unstable_ViewTransition as ViewTransition } from 'react';

<ViewTransition name="hero-image">
  <Image ... />
</ViewTransition>
```

À évaluer en Phase 2 quand l'API est largement supportée et stable.

## 15. Performance des animations

| Règle | Détail |
|---|---|
| **Composer sur `transform` et `opacity`** | Jamais d'animation sur `width`, `height`, `top`, `margin` |
| **`will-change`** | Appliqué uniquement pendant l'animation (pas en CSS statique permanent) |
| **`contain: layout paint`** | Sur les zones animées indépendantes (cards en grille) |
| **Throttle scroll listeners** | rAF natif via `useScroll` Framer Motion ou `IntersectionObserver` |
| **Limit concurrent animations** | Max 4 éléments en stagger simultané |
| **Frame budget** | 16.67 ms pour 60 fps — vérifier en Performance tab Chrome DevTools |

Voir doc 10 pour budget complet.

## 16. Tests d'animation

| Niveau | Méthode |
|---|---|
| Visuel | Storybook avec stories `*.animated.stories.tsx` documentant chaque interaction |
| Interaction | `@storybook/addon-interactions` + `play()` pour scénarios click/hover |
| E2E | Playwright avec `page.waitForFunction()` sur `data-animation-state` attribute |
| Regression | Chromatic ou Percy (Phase 2) sur les compositions de page clés |
| Accessibility | jest-axe ou Storybook a11y addon — vérifier que les animations passent en mode reduced-motion |

**Convention test** : chaque composant animé expose un `data-animation-state="idle|entering|active|exiting"` lisible par les tests.

## 17. Anti-patterns formellement interdits

- ❌ Auto-play vidéo sonore
- ❌ Carrousels auto-rotatifs (Slider / témoignages se feuillettent à la main, jamais automatiquement)
- ❌ Pop-ups de réduction au scroll (« Wait! Don't go! »)
- ❌ Cookie banners avec animation d'attention (shake, glow)
- ❌ Notifications de stock factice (« 3 personnes regardent ce produit »)
- ❌ Toasts qui empilent en bas à droite
- ❌ Cursors customisés (Magic cursor)
- ❌ Curseurs SVG qui suivent la souris
- ❌ Animations 3D qui réagissent à la souris (parallax CSS perspective)
- ❌ Loading screens en plein écran avec logo qui pulse
- ❌ Confetti, particules, étoiles
- ❌ Scroll-jacking (snapping vertical forcé entre sections)

## 18. Checklist d'implémentation par composant animé

Avant merge, chaque composant animé doit cocher :

- [ ] Animation respecte `--duration-*` et `--ease-*` (pas de valeurs hardcodées)
- [ ] Passe le test `prefers-reduced-motion`
- [ ] Animations `transform` / `opacity` uniquement
- [ ] Pas de re-render inutile (memoized ou `useMotionValue`)
- [ ] `aria-live`, `aria-busy`, `aria-expanded` mis à jour si pertinent
- [ ] Storybook story documente chaque état
- [ ] Tap targets ≥ 44 px sur mobile
- [ ] Aucun layout shift introduit (CLS)

> *Document suivant : [09 — Ergonomie & accessibilité](./09-ergonomie-accessibilite.md)*
