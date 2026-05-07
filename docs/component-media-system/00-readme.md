# Component-Media System — README

> Système de binding composants ↔ médias. Permet à un admin d'assigner
> visuellement un média (image, vidéo) à un slot d'un composant React,
> avec gestion fine de la stratégie de chargement, de l'animation, et
> d'un fallback SVG par défaut.

## Pourquoi

Aujourd'hui les composants ont des paths d'images **hardcodés** :

```tsx
<Image src="/images/hero-home.avif" alt="..." priority />
```

Conséquences :
- Pour changer une image héro, il faut un PR / un déploiement.
- Pas de centralisation : on ne sait pas en un coup d'œil "quels composants utilisent quelles images".
- Le dossier `docs/images/values/` (50 PNG sources curatées) n'est jamais
  importé : il sert uniquement de référence textuelle.
- Pas de fallback SVG configurable depuis l'admin.
- L'animation est codée en dur (Tailwind `group-hover`, framer-motion variants…).

## Ce qu'on veut

1. **Centraliser** : un registre `siteComponents` qui liste TOUS les composants
   visuels du site (hero, card, gallery, etc.), avec leur path source.
2. **Binder** : pour chaque composant, n slots (`primary`, `background`,
   `thumbnail`…) → 0 ou 1 binding média actif.
3. **Fallback SVG** : si pas de binding actif → SVG par défaut (déjà
   présents dans `apps/web/public/`).
4. **Lazy-loading par composant** : un hero = `eager` + `priority=high`,
   une carte de journal = `viewport` (IntersectionObserver), etc.
5. **Animations** : registry de profils (Reveal, ScaleHover, FadeIn…) +
   binding par composant. Réutilise `useReducedMotion`.
6. **Seed automatique** depuis `docs/images/values/`.
7. **UI admin moderne** : organisation par page (home / journal / kit /
   maison / rituel), preview, picker média, config animation, slider de
   stratégie de chargement.

## Architecture en 1 minute

```
┌──────────────────────────────────────────────────────────┐
│  Composant React (RSC)                                    │
│  <ComponentMedia componentKey="hero-home" slot="primary"  │
│                  fallbackSvg="/images/hero-home.svg" />   │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼ resolveBinding()
┌──────────────────────────────────────────────────────────┐
│  componentMediaBindings ───► mediaId ───► Media+Variants │
│         │                                                 │
│         └─► loadingStrategy / fetchPriority / animation  │
└──────────────────────────────────────────────────────────┘
         │                                             │
   pas de binding ?                              binding actif
         │                                             │
         ▼                                             ▼
   fallback SVG (statique)               <MediaImage media=... />
```

## Index

| # | Fichier | Sujet |
|---|---------|-------|
| 01 | [01-vision-architecture.md](01-vision-architecture.md) | Vision, principes, contraintes, non-goals |
| 02 | [02-data-model.md](02-data-model.md) | Schema, tables, enums, contraintes, indices |
| 03 | [03-api-contracts.md](03-api-contracts.md) | Routes, payloads, codes d'erreur |
| 04 | [04-frontend-ui-ux.md](04-frontend-ui-ux.md) | Wireframes, parcours, composants admin |
| 05 | [05-animations.md](05-animations.md) | Registry animations, bindings, profils |
| 06 | [06-seed-pipeline.md](06-seed-pipeline.md) | Ingestion `docs/images/values/` |
| 07 | [07-tests-strategy.md](07-tests-strategy.md) | Vitest + MSW + Playwright |
| 08 | [08-runbook.md](08-runbook.md) | Plan d'exécution étape par étape |

## Glossaire express

- **Composant** : `siteComponents` — registre fixe (key unique) qui décrit un
  composant React du site. Ex : `hero-home`, `article-card`, `gestes-grid-1`.
- **Slot** : un emplacement de média dans un composant. Le hero a un slot
  `primary` (image principale). Une carrousel a `slide-1`, `slide-2`, etc.
- **Binding** : `componentMediaBindings` — relation composant + slot →
  media + config (loading, animation).
- **Animation profile** : `componentAnimations` — variants framer-motion
  ou keyframes CSS réutilisables (Reveal, ScaleHover, FadeIn, SchemaSVG).
- **Loading strategy** : `eager` (LCP), `viewport` (IntersectionObserver),
  `interaction` (au hover/click), `idle` (requestIdleCallback).
- **Fallback SVG** : asset statique servi quand aucun binding actif. Sert
  aussi de placeholder en SSR.
