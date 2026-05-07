# 01 — Vision & Architecture

## Principes directeurs

1. **Source unique de vérité** : la BDD décide ce qui s'affiche. Le code
   garde la structure (HTML, layout, accessibilité) ; la BDD pilote le
   contenu visuel et le comportement (lazy, anim).
2. **SVG > image** par défaut. L'image est une amélioration progressive.
   Si aucun binding ⇒ on rend le SVG fallback. Cela garantit que :
   - Premier rendu jamais cassé, même DB vide.
   - Un nouvel environnement (preview, staging) reste fonctionnel sans
     seed.
   - Désactiver le binding ⇒ retour immédiat au SVG (rollback instantané).
3. **Lazy-loading guidé par la sémantique du composant**, pas par
   l'image elle-même. Un hero est toujours `eager`+`priority`, peu
   importe la taille du PNG.
4. **Réutilise** le pipeline media existant (`mediaVariants`,
   `optimize-image`, `getStorage`). On NE recrée PAS un store séparé.
5. **Idempotent** : seed, discovery, regenerate — tout est rejouable
   sans casser l'état.
6. **Edge-friendly** : aucune logique de binding ne pull `node:crypto`
   dans le middleware. Le runtime des routes admin reste `nodejs`.
7. **A11y first** : `useReducedMotion`, `aria-busy` sur placeholder,
   focus visible sur picker, support clavier.

## Contraintes techniques

| Contrainte | Conséquence |
|------------|-------------|
| Next.js 14.2 App Router | RSC pour le rendu serveur, hooks client uniquement quand nécessaire. |
| TypeScript strict | Types exhaustifs sur les enums (slot, strategy, animation kind). |
| Drizzle dual-driver (postgres + memoryStore) | Toute query doit gérer les deux chemins. |
| Pipeline media synchrone en dev | Le seed exécute `optimizeImage` directement (pas de worker async). |
| 50 PNG sources dans `docs/images/values/` | Pas de mutations sur ces fichiers (lecture seule). |
| 26 SVG fallback dans `public/` | On garde leurs paths existants pour compat ascendante. |
| Storage adapter (local/vercel-blob) | Le seed utilise `getStorage()` ; les fichiers ingérés vont dans `public/media/` en dev. |

## Non-goals (V1)

- ❌ Édition d'image en admin (crop, filters). On reste consommateur.
- ❌ Versioning historique des bindings (audit OK, mais pas de "rollback").
- ❌ A/B testing de bindings (peut venir en V2).
- ❌ Localisation par locale (image FR vs EN). V2.
- ❌ Auto-discovery JS-AST des composants. On maintient un registre
   manuel + un script `scripts/seed-component-registry.ts`.

## Architecture par couches

```
┌────────────────────────────────────────────────────────────┐
│  COUCHE 1 — Schema (Drizzle)                                │
│  siteComponents · componentMediaBindings · componentAnimations  │
│  componentAnimationBindings                                  │
└────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│  COUCHE 2 — Queries (lib/db/queries/components/*)          │
│  CRUD bindings, list components, resolve binding by key+slot│
└────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│  COUCHE 3 — Service / Resolver (lib/components/*)          │
│  resolveComponentMedia(key, slot) → MediaImage props OR    │
│                                     fallbackSvg path       │
│  Couche cachée via unstable_cache (tag: "components")      │
└────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│  COUCHE 4 — Composants public                              │
│  <ComponentMedia /> (RSC) · useComponentMedia (client)     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  COUCHE 5 — Routes API admin                               │
│  CRUD components, bindings, animations                      │
│  POST /seed-from-docs (ingestion docs/images/values/)      │
│  POST /discover (regen registry from code)                 │
└────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│  COUCHE 6 — UI admin                                        │
│  /admin/components (list par page, preview, picker)         │
│  /admin/components/[key] (détail, slots, anim)              │
└────────────────────────────────────────────────────────────┘
```

## Flux clés

### 1. Premier render d'une page (production)

```
Page /maison → RSC <HeroMaison>
            → <ComponentMedia componentKey="hero-maison" slot="primary"
                              fallbackSvg="/maison/maison-hero.svg" />
            → resolveComponentMedia("hero-maison", "primary")
                ├─ binding actif ? → fetch Media + variants → <MediaImage />
                └─ pas de binding ? → <img src="/maison/maison-hero.svg" />
            → Stream HTML
```

### 2. Admin assigne une image

```
1. Admin va sur /admin/components/hero-maison
2. Clique "Assigner image au slot primary"
3. Picker média s'ouvre (gallery filtrée par tag "maison/hero")
4. Sélectionne maison-hero.png (déjà ingéré via seed)
5. Configure : loadingStrategy=eager, priority=high, animationKey=heroFadeIn
6. PATCH /api/admin/components/hero-maison/bindings { mediaId, slot, ... }
7. Cache invalidé (revalidateTag("components"))
8. Page /maison rendue → MediaImage poste sur la grille
```

### 3. Seed depuis docs/images/values/

```
1. Admin clique "Importer depuis docs/images/values"
2. POST /api/admin/components/seed-from-docs
3. Backend :
   a. Liste les 50 PNG via fs (no .DS_Store)
   b. Pour chaque PNG :
      - Lit metadata du doc 03-inventaire-images.md (déjà parsé en TS const)
      - Crée Media (kind=image, source=upload, slug=<dossier>-<nom>)
      - Lance optimizeImage (variants avif/webp)
      - Crée MediaUsage
      - Match avec un siteComponent existant via la map
        IMAGE_TO_COMPONENT (ex hero-home.png → component "hero-home")
      - Crée ou update componentMediaBinding (slot="primary", isActive=false par défaut)
   c. Audit log : "tracking.media_seeding"
4. Réponse : { imported: 50, mapped: 47, skipped: 3 }
```

## Décisions ADR

### ADR-001 : nouvelle table vs réutiliser `mediaUsages`

**Problème** : on a déjà `mediaUsages(mediaId, route, component)`.

**Décision** : créer `componentMediaBindings` séparé. Raisons :
- `mediaUsages` est un **journal** (best-effort, mis à jour par `recordUsage()` côté SSR à chaque rendu).
- `componentMediaBindings` est une **configuration explicite** modifiée par admin, qui survit aux flushes.
- Permet un slot unique (`unique(componentId, slot)`) qui n'aurait pas de sens dans un journal.

### ADR-002 : registre vs auto-discovery via AST

**Problème** : comment connaître la liste des composants ?

**Décision** : registre manuel curé dans `lib/components/registry.ts` (TS const,
pas de DB). Le seed le synchronise vers `siteComponents`. Raisons :
- Auto-discovery via AST (TS ESLint rule, ts-morph) est lourd, fragile,
  et expose le code source en clair dans la DB.
- Un registre TS = type-safe, review-friendly, CI-checkable.
- Un script `scripts/seed-component-registry.ts` upserte la table à
  chaque déploiement.

### ADR-003 : fallback SVG inline vs path

**Problème** : on rend `<img src="/path.svg">` ou un SVG inline généré ?

**Décision** : path. Le composant accepte une prop `fallbackSvg: string`
qui est un path public statique. Raisons :
- Simple, cacheable par le CDN.
- L'admin ne configure pas de SVG depuis l'UI (on a déjà 26 fichiers).
- Plus tard on peut ajouter `inlineSvg: string` pour une option avancée.

### ADR-004 : storage du PNG seed

**Problème** : où vont les PNG ingérés ? On les copie ou on garde les paths source ?

**Décision** : on les copie via `getStorage().put()` dans le pipeline normal
(`public/media/sources/<id>/...` en dev, Vercel Blob en prod). Raisons :
- Le pipeline d'optimisation génère les variants avif/webp.
- `docs/images/values/` reste source de vérité textuelle ; les fichiers
  utilisés en runtime sont gérés par le store.
- Évite que le frontend serve des fichiers depuis un dossier `docs/`
  (qui n'est pas dans `public/`).
