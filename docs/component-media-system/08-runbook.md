# 08 — Runbook d'exécution

> Plan d'action étape par étape. À exécuter dans l'ordre. Chaque étape
> est validée avant de passer à la suivante (`tsc`, `vitest run`).

## Phase A — Schéma & types (45 min)

1. ✅ Créer `apps/web/src/lib/db/schema.ts` — ajouter :
   - enum `componentCategoryEnum`
   - enum `animationKindEnum`
   - enum `placeholderStrategyEnum`
   - tables `siteComponents`, `componentMediaBindings`,
     `componentAnimations`, `componentAnimationBindings`
2. ✅ `apps/web/src/lib/db/types.ts` — interfaces TS correspondantes.
3. ✅ `apps/web/src/lib/db/client.ts` — ajouter aux Maps memoryStore.
4. ✅ `apps/web/drizzle/migrations/0004_component_media_system.sql`.
5. ✅ `apps/web/src/lib/tracking/server/audit.ts` — étendre
   `TrackingResource` avec `'site_component'`,
   `'component_media_binding'`, `'component_animation_binding'`.

**Validation** : `npx tsc --noEmit` ✅.

## Phase B — Registre composants (60 min)

1. ✅ `apps/web/src/lib/components/registry.ts` — TS const
   `SITE_COMPONENT_REGISTRY: SiteComponentSeed[]` (≈ 25 entrées).
2. ✅ `apps/web/src/lib/components/seed-mapping.ts` — `IMAGE_TO_COMPONENT`.
3. ✅ `apps/web/src/lib/components/seed-alt.ts` — alt hints.
4. ✅ `apps/web/src/lib/components/animations-registry.ts` — 7 profils
   (`none`, `fade-in`, `reveal-up`, `scale-hover`, `parallax-soft`,
   `schema-svg`, `cross-link`).

**Validation** : test unit registre (`registry.test.ts`).

## Phase C — Queries (60 min)

1. ✅ `apps/web/src/lib/db/queries/components/site-components.ts`
   - `upsertSiteComponent`
   - `findComponentByKey`, `findComponentById`
   - `listComponents(filters)`
   - `deleteComponent` (cascade)
2. ✅ `apps/web/src/lib/db/queries/components/bindings.ts`
   - `upsertBinding`
   - `findBinding(componentId, slot)`
   - `listBindingsForComponent`
   - `deleteBinding`
   - `listBindingsForMedia` (pour "where is this media used ?")
3. ✅ `apps/web/src/lib/db/queries/components/animations.ts`
   - `upsertAnimation`
   - `findAnimationByKey`
   - `listAnimations`
   - `attachAnimation`, `detachAnimation`, `setDefaultAnimation`

**Validation** : `vitest run lib/db/queries/components` ✅.

## Phase D — Resolver (45 min)

1. ✅ `apps/web/src/lib/components/resolver.ts`
   - `resolveComponentMedia(key, slot, opts?)` cached via
     `unstable_cache(['component-media', key, slot], { tags: ['components'] })`
   - Retourne `ResolvedComponentMedia` (discriminated union).
2. ✅ `apps/web/src/lib/components/cache.ts` — wrapper revalidate.
3. ✅ Tests `resolver.test.ts`.

## Phase E — Pipeline de seed (90 min)

1. ✅ `apps/web/src/lib/components/seed-pipeline.ts`
   - `scanDocsValues(pageGroup?)` (lit `docs/images/values/`)
   - `seedFromDocs(opts)` (logique pseudo-code de 06).
2. ✅ `apps/web/scripts/seed-components.ts` — CLI wrapper.
3. ✅ Test `seed-pipeline.test.ts` (mock fs).

**Validation** : run `pnpm --filter @femiglow/web seed:components` en
dev local → vérifie 50 medias en DB + bindings inactifs.

## Phase F — Routes API admin (60 min)

1. ✅ `app/api/admin/components/route.ts` (GET liste).
2. ✅ `app/api/admin/components/[key]/route.ts` (GET détail).
3. ✅ `app/api/admin/components/[key]/bindings/route.ts` (POST upsert).
4. ✅ `app/api/admin/components/[key]/bindings/[slot]/route.ts` (DELETE).
5. ✅ `app/api/admin/components/[key]/animations/route.ts` (POST attach).
6. ✅ `app/api/admin/components/[key]/animations/[animationKey]/route.ts` (DELETE).
7. ✅ `app/api/admin/components/animations/route.ts` (GET liste).
8. ✅ `app/api/admin/components/seed-from-docs/route.ts` (POST).
9. ✅ `app/api/admin/components/sync-registry/route.ts` (POST).

Pour chaque route :
- Auth admin
- Schéma Zod
- `formatErrorResponse` + `auditTrackingChange`
- `revalidateTag('components')` après mutation

**Validation** : `npx tsc --noEmit` + tests via curl (smoke).

## Phase G — Composant public (45 min)

1. ✅ `apps/web/src/components/media/ComponentMedia.tsx` (RSC).
2. ✅ `apps/web/src/components/media/ComponentAnimationWrapper.tsx`
   (client).
3. ✅ Adapter 1-2 composants pilotes (Hero, ArticleCard) à
   `<ComponentMedia>`. **Compatibilité ascendante** : si pas de binding,
   le SVG fallback prend le path actuel `/images/hero-home.svg` etc.

**Validation** : page `/` rend correctement avec et sans binding.

## Phase H — UI admin (3-4 h, peut être déléguée)

1. ✅ `app/admin/components/page.tsx` (liste).
2. ✅ `app/admin/components/[key]/page.tsx` (détail).
3. ✅ `app/admin/components/seed/page.tsx` (assistant).
4. ✅ `app/admin/components/animations/page.tsx`.
5. ✅ Composants client :
   - `ComponentList`, `ComponentCard`
   - `SlotConfigPanel`, `MediaPickerDrawer`
   - `LoadingStrategySelect`, `AnimationProfileSelector`
   - `PreviewPanel`, `BindingToggle`, `SeedWizard`
6. ✅ Ajouter au shell admin existant le menu "Composants".

**Validation** :
- `npx vitest run components/admin/components` ✅
- Login admin → `/admin/components` → flux complet (assigner média,
  toggle isActive, désassigner) sans erreur.

## Phase I — Tests (90 min)

1. ✅ Vitest unit (Phases C, D, E déjà couvertes).
2. ✅ MSW + RTL pour UI admin.
3. ✅ `e2e/components-admin.spec.ts`.
4. ✅ `e2e/components-public.spec.ts`.
5. ✅ `e2e/components-seed.spec.ts`.

**Validation** : suite complète verte.

## Phase J — Validation finale (30 min)

1. ✅ `npx tsc --noEmit` (apps/web).
2. ✅ `npx vitest run` — toutes les suites passent.
3. ✅ `npx next build` — build succeeds.
4. ✅ `npx playwright test` — local (sans Postgres).
5. ✅ Smoke manuel : login admin, seed, assigner, vérifier sur le front.

## Phase K — Doc & migration prod (15 min)

1. ✅ `docs/component-media-system/CHANGELOG.md` — résumé V1.
2. ✅ `docs/admin/components.md` — guide utilisateur admin.
3. ✅ Update `apps/web/README.md` — section "Component Media System" +
   commande `pnpm seed:components`.
4. ✅ Note de migration : run `pnpm db:migrate` en prod, puis seed via
   admin UI.

## Rollback

Si un problème surgit en prod :

1. **Rapide** : dans `/admin/components`, désactiver tous les bindings
   (toggle `isActive=false`). Le site retombe sur les SVG fallback. Pas
   de re-deploy.
2. **Complet** : `DROP TABLE component_media_bindings, ...` puis le
   composant `<ComponentMedia>` retourne automatiquement le SVG
   (le resolver gère gracieusement l'absence de table via `try/catch`).
3. **Code** : feature flag `NEXT_PUBLIC_COMPONENT_MEDIA_ENABLED=false`
   force le `ComponentMedia` à toujours retourner le SVG.

## Estimation totale

| Phase | Durée   |
|-------|---------|
| A     | 45 min  |
| B     | 60 min  |
| C     | 60 min  |
| D     | 45 min  |
| E     | 90 min  |
| F     | 60 min  |
| G     | 45 min  |
| H     | 4 h     |
| I     | 90 min  |
| J     | 30 min  |
| K     | 15 min  |
| **Total** | **~10 h** |

## Risques identifiés

| Risque                                            | Mitigation                                |
|---------------------------------------------------|-------------------------------------------|
| Pipeline `optimizeImage` lent (50 PNG = ~5 min)   | Async + worker existant, polling UI       |
| Path SVG inexistant en prod                       | Test CI vérifie tous les fallbacks        |
| Cache Next.js stale après binding update          | `revalidateTag('components')` partout     |
| Conflit avec `mediaUsages` (double tracking)      | `recordUsage` reste, distinct du binding  |
| Storage Vercel Blob quota                         | Idempotent + `force=false` par défaut     |

## Critères d'acceptation V1

- [ ] 50 PNG ingérés (47 mappés + 3 unmatched documentés)
- [ ] 24 composants au registre, tous avec SVG fallback existant
- [ ] Toggle `isActive=true` sur 1 composant → image visible sur la page publique
- [ ] Toggle `isActive=false` → SVG fallback réapparaît
- [ ] Reduced-motion désactive l'animation des 6 profils
- [ ] 477 tests existants + ~30 nouveaux passent
- [ ] `next build` succeeds, bundle size ≤ +20 KB sur les pages impactées
- [ ] Admin reseed sans force → idempotent (0 changement)
- [ ] Admin seed avec force → re-upload + variants regen
