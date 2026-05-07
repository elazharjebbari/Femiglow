# 07 — Stratégie de tests

## Pyramide

```
   ┌──────────┐     5  Playwright E2E (assigner / désassigner / lazy / a11y)
   │  E2E     │
   ├──────────┤
   │ Integ    │    12  MSW + React Testing Library (admin UI)
   ├──────────┤
   │  Unit    │    25  Vitest (queries, resolver, mapping)
   └──────────┘
```

## Vitest unit

### `lib/db/queries/components/site-components.test.ts`

- `upsertSiteComponent` insère puis met à jour
- `findComponentByKey` retourne null sans match
- `listComponents({ pageGroup: 'home' })` filtre correctement
- `deleteComponent` cascade les bindings (assert via memoryStore)

### `lib/db/queries/components/bindings.test.ts`

- `upsertBinding` enforce `unique(componentId, slot)`
- `upsertBinding` rejette un slot inconnu (test métier)
- `deleteBinding` retombe sur SVG fallback (resolver retourne `kind='svg'`)
- Override `customAlt` priorise l'admin

### `lib/components/resolver.test.ts`

- Pas de binding actif → `{ kind: 'svg', src: fallbackSvg }`
- Binding actif sans média → idem (binding "désactivé soft")
- Binding actif avec média → `{ kind: 'image', media, variants, ... }`
- Binding avec animation → contient `{ animation: { key, params } }`
- `resolveBatch([keys])` retourne map et n'appelle qu'une seule fois la DB

### `lib/components/seed.test.ts`

- Scanner détecte tous les PNG sauf `.DS_Store`
- `IMAGE_TO_COMPONENT` couvre 47/50 fichiers (3 unmatched documentés)
- `seedFromDocs({ force: false })` deux fois → `imported=50, then 0`
- `seedFromDocs({ autoActivate: true })` met `isActive=true`

### `lib/components/registry.test.ts`

- Tous les `key` sont uniques
- Tous les `defaultSvgFallback` existent dans `apps/web/public/`
- Pour chaque composant, `slots[].key` matche au moins un usage côté code
  (regex grep `componentKey="..."`)

## MSW + React Testing Library

### `components/admin/components/ComponentList.test.tsx`

- Rend la grille avec 4 cartes (mock fetch GET /api/admin/components)
- Filtre par tab `pageGroup` réduit la grille
- Clic sur carte navigue vers `/admin/components/[key]` (assert `<Link>`)

### `components/admin/components/ComponentDetailPanel.test.tsx`

- Affiche le slot + média actuel
- Clic "Désassigner" appelle PATCH bindings avec `mediaId: null` (mock)
- Toggle `isActive` PATCH le binding et met à jour l'affichage
- A11y : axe ne signale rien

### `components/admin/components/MediaPickerDrawer.test.tsx`

- Ouvre le drawer
- Liste 6 médias filtrés par tag (mock GET /api/admin/media)
- Sélection met à jour le state
- Confirmation appelle POST bindings avec `{ mediaId, slot }`

### `components/admin/components/AnimationProfilePreview.test.tsx`

- Profil `none` → pas de motion.div
- Profil `fade-in` → motion.div avec `initial={{ opacity: 0 }}`
- `useReducedMotion` mocked → désactive l'animation

## Playwright E2E

### `e2e/components-admin.spec.ts`

- **Login admin** + visite `/admin/components` → assertion 24 cartes
- **Filtre par page** → URL contient `?pageGroup=journal`
- **Détail composant** → preview SVG visible quand pas de binding actif
- **Activer un binding** (via PATCH API) → `isActive=true`, preview montre le media

### `e2e/components-public.spec.ts`

- **Sans binding** : visite `/`, hero rendu avec `<img src="/images/hero-home.svg">`
- **Avec binding actif** (préseedé) : visite `/`, hero contient `<picture>` (signal de `MediaImage`)
- **Lazy loading** : carte article a `loading="lazy"`, hero a `loading="eager"`
- **Reduced motion** : `prefers-reduced-motion: reduce` désactive l'animation
  (assertion : motion.div absent ou opacity=1 instantané)

### `e2e/components-seed.spec.ts`

- POST seed-from-docs → response.imported >= 47
- Visite `/admin/components` → cards montrent maintenant les médias
- Visite `/maison` → SVG ou MediaImage selon `autoActivate`

## Tests de régression visuelle (V2)

Out of scope V1. Note pour V2 : capturer screenshots Playwright avant/après
binding actif, comparer pixel diff (Percy/Chromatic).

## Coverage cible

| Couche       | Cible | Commande                              |
|--------------|-------|---------------------------------------|
| Queries      | 90%   | `npx vitest run lib/db/queries/components` |
| Resolver     | 95%   | `npx vitest run lib/components/resolver` |
| Admin UI     | 70%   | `npx vitest run components/admin/components` |
| E2E happy    | 100% des scénarios | `npx playwright test e2e/components*` |

## Données de test

Fixture `tests/fixtures/components.ts` :

```ts
export const FAKE_COMPONENTS = [
  { key: 'hero-home', name: 'Hero — Home', pageGroup: 'home', category: 'hero',
    slots: [{ key: 'primary', label: 'Image principale', required: true, acceptKinds: ['image'] }],
    defaultSvgFallback: '/images/hero-home.svg' },
  // ...
];
```

## CI

GitHub Actions :

```yaml
- name: Vitest
  run: npx vitest run --coverage
- name: Playwright
  run: npx playwright test
- name: Lint
  run: pnpm --filter @femiglow/web lint
- name: Typecheck
  run: pnpm --filter @femiglow/web typecheck
```

Aucun test ne dépend d'une connexion Postgres réelle (memoryStore par défaut).
