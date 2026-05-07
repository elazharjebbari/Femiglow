# Système Component-Media — vue d'ensemble

> Pilotage admin des médias affichés sur le site — par composant, par slot,
> sans toucher au code, avec rollback safe et SVG fallback intégré.

## Vision

Chaque composant éditorial du site Next.js (Hero, ArticleCard, FeaturedArticle,
JournalExtraits, …) déclare un ou plusieurs **slots** dans `lib/components/registry.ts`.
La table `component_media_bindings` rattache un `media` (image, vidéo) à un
`(componentId, slot)` via une admin-page dédiée :

```
/admin/components             → liste des composants (par page, par catégorie)
/admin/components/[key]       → détail : slots, animation, fallback SVG
/admin/components/seed        → seed depuis docs/images/values/ (dry-run friendly)
/admin/components/animations  → catalogue des 7 profils d'animation
```

## Pourquoi

| Pain point pré-existant                            | Réponse Component-Media                                         |
| -------------------------------------------------- | --------------------------------------------------------------- |
| Image hard-codée dans `Hero.tsx`                   | Binding admin-pilotable, `mediaSlot` optionnel injecté par RSC. |
| Modifier une image = PR + déploiement              | Bouton « Choisir un média » → revalidation du tag `components`. |
| Pas de fallback gracieux si le binding est cassé   | SVG fallback déclaré au niveau du registry, servi sans pipeline raster. |
| Pas de loading-strategy par composant              | `defaultLoadingStrategy` (eager / viewport / idle / interaction). |
| Animations pilotées au cas par cas dans le JSX     | 7 profils canoniques (none, fade-in, reveal-up, …) attachés en DB. |

## Invariants

- **Rollback safe** : `isActive=false` par défaut sur upsert ; un binding inactif
  ne s'affiche jamais côté public, même si présent en DB.
- **Idempotence du seed** : `slug = ${pageGroup}-${basename}`. Re-seed = no-op
  par défaut (sauf `--force` pour régénérer les variants).
- **prefers-reduced-motion** respecté par tous les profils d'animation
  marqués `respectsReducedMotion=true` (par défaut).
- **Pas de waterfall** : les bindings d'une page sont résolus en parallèle
  via `Promise.all` côté RSC (cf. `JournalExtraitsBound`).
- **Single source of truth** : `SITE_COMPONENT_REGISTRY` (TS) → `siteComponents` (DB).
  Renommer une `key` après seed prod = orphelins (cf. runbook).

## Acteurs

- **Fondatrice / éditrice** : utilise l'admin pour assigner des médias et
  basculer une image saisonnière sans toucher au code.
- **Développeurs** : ajoutent un nouveau composant dans `registry.ts`,
  exposent un slot, lancent `pnpm sync:components`.
- **Cron / pipeline** : seed initial via `scripts/seed-components.ts` ou
  via `POST /api/admin/components/seed-from-docs`.

## Surfaces côté public déjà câblées

- `app/(marketing)/page.tsx` → `HeroBound componentKey="home-hero"`
- `app/(marketing)/page.tsx` → `JournalExtraitsBound` (3 articles featured)
- `app/(marketing)/journal/page.tsx` → `FeaturedArticleBound`
- `app/(marketing)/journal/[slug]/page.tsx` → `ArticleHeroBound` par slug

Tous tombent gracieusement sur le `featuredImage` du CMS si aucun binding
actif n'existe — pas de page cassée pendant la phase de bootstrap.
