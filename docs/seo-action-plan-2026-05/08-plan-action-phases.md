# 08 — Plan d'action par phases

Découpage exécution en 6 phases ordonnées, chacune avec étapes test-first, livrables, dépendances, durée estimée, et critères de done.

Ordre conçu pour livrer **valeur immédiate** (P0 d'abord) puis **structurel** (P1) puis **confort** (P2). Phases indépendantes en aval (2, 3, 4 parallélisables une fois 1 livré). Phase 5 dépend de 4 (résolution OG dynamique) mais peut commencer après phase 1.

## Phase 0 — Hot patches (P0)

**Durée** : 1 h (1 développeur).
**Risque** : très faible.
**Dépendance** : aucune.
**Feature flag** : aucun (déploiement direct).

### 0.1 Étapes

1. **Tests d'abord** : écrire les tests Vitest pour `metadata` de `/commander` et `/merci` (assertions title, description, robots, canonical).
2. Écrire le test Vitest + Testing Library pour `BulkDeleteConfirmDialog` (modale, désactivation tant que nombre ne matche pas, callback onConfirm).
3. Implémenter `BulkDeleteConfirmDialog.tsx`.
4. Modifier `SeoBulkActionBar.tsx` pour appeler la modale avant suppression réelle.
5. Ajouter `export const metadata` à `apps/web/src/app/(commerce)/commander/page.tsx` et `merci/page.tsx`.
6. Vérifier que les tests existants restent verts (sitemap, robots, autres metadata).
7. Run `pnpm typecheck` + `pnpm lint` + `pnpm vitest run`.
8. Commit unique : `feat(seo): hot patches P0 — metadata /commander /merci + bulk delete confirm`.

### 0.2 Fichiers touchés

- `apps/web/src/app/(commerce)/commander/page.tsx` (modifié)
- `apps/web/src/app/(commerce)/merci/page.tsx` (modifié)
- `apps/web/src/components/admin/seo/SeoBulkActionBar.tsx` (modifié)
- `apps/web/src/components/admin/seo/BulkDeleteConfirmDialog.tsx` (nouveau)
- `apps/web/src/components/admin/seo/BulkDeleteConfirmDialog.test.tsx` (nouveau)
- `apps/web/src/app/(commerce)/commander/page.test.ts` (nouveau)
- `apps/web/src/app/(commerce)/merci/page.test.ts` (nouveau)

### 0.3 Critères de done

- Tests Vitest verts pour les 3 nouveaux fichiers de test.
- Tests existants verts (zéro régression).
- `pnpm typecheck` clean.
- Build prod réussit.
- Commande manuelle : `curl -I http://localhost:3000/commander | grep -i x-robots-tag` (si exposé) ou inspection HTML.

---

## Phase 1 — Sitemap freshness (P1 F-04)

**Durée** : 2 h.
**Risque** : faible.
**Dépendance** : aucune.
**Feature flag** : aucun.

### 1.1 Étapes

1. **Tests d'abord** : étendre `apps/web/src/app/sitemap.test.ts` avec deux nouveaux tests :
   - `lastModified` d'un article = `article.updatedAt` retourné par `getPublishedArticles`.
   - `lastModified` des routes statiques = `new Date(process.env.NEXT_PUBLIC_BUILD_DATE)`.
2. Ajouter `NEXT_PUBLIC_BUILD_DATE` dans `next.config.js` (assignée à `new Date().toISOString()` au build).
3. Refactorer `apps/web/src/app/sitemap.ts` selon `05-frontend-public-design.md` §4.1.
4. Si nécessaire, étendre `lib/cms` pour retourner `updatedAt` (vérifier que la colonne existe en DB).
5. Vérifier visuellement le sitemap : `pnpm build && pnpm start`, fetch `/sitemap.xml`, valider format.
6. Commit : `feat(seo): use updatedAt for sitemap lastModified`.

### 1.2 Fichiers touchés

- `apps/web/src/app/sitemap.ts` (modifié)
- `apps/web/src/app/sitemap.test.ts` (étendu)
- `apps/web/next.config.js` (modifié — ajout NEXT_PUBLIC_BUILD_DATE)
- `apps/web/src/lib/cms/articles.ts` ou équivalent (vérifié, étendu si besoin)

### 1.3 Critères de done

- Test sitemap vert avec assertions sur `lastModified` (réel + build date).
- Fetch `/sitemap.xml` retourne XML valide.
- Aucune route statique avec `lastModified = new Date()` à runtime (toujours `BUILD_DATE`).

---

## Phase 2 — Media picker OG image (P1 F-05)

**Durée** : 1 jour.
**Risque** : faible.
**Dépendance** : phase 0 mergée.
**Feature flag** : aucun (UX additionnelle, non destructive).

### 2.1 Étapes

1. **Audit composant existant** : vérifier l'existence de `MediaPickerDialog` ou équivalent réutilisable dans l'admin médias. Lire `apps/web/src/components/admin/media/`.
2. **Tests d'abord** : écrire `OgImagePicker.test.tsx` avec 8-10 cas (rendering, sélection mode, persistance, a11y, états vide/error).
3. Implémenter `OgImagePicker.tsx` (3 modes : none, media, template).
4. Intégrer dans `SeoOverrideEditor.tsx` en remplacement de l'input texte `ogImageMediaId`.
5. Intégrer dans `SeoSettingsEditor.tsx` pour le default global.
6. Étendre tests existants `SeoOverrideEditor.test.tsx` pour couvrir le nouveau picker.
7. Smoke test manuel : édition produit, sélection image, save, rechargement, vérification persistance.
8. Commit : `feat(seo-admin): media picker for OG image with template fallback`.

### 2.2 Fichiers touchés

- `apps/web/src/components/admin/seo/OgImagePicker.tsx` (nouveau)
- `apps/web/src/components/admin/seo/OgImagePicker.test.tsx` (nouveau)
- `apps/web/src/components/admin/seo/SeoOverrideEditor.tsx` (modifié)
- `apps/web/src/components/admin/seo/SeoOverrideEditor.test.tsx` (étendu)
- `apps/web/src/components/admin/seo/SeoSettingsEditor.tsx` (modifié)
- `apps/web/src/components/admin/media/MediaPickerDialog.tsx` (lu/réutilisé ou extrait)

### 2.3 Critères de done

- Tests `OgImagePicker.test.tsx` verts (≥ 8 cas).
- Test `SeoOverrideEditor` couvre la sélection d'une image.
- A11y : `@axe-core/playwright` passe sur `/admin/seo/new`.
- UX : la sélection d'une image apparaît dans le preview Facebook immédiatement.

---

## Phase 3 — Panel d'audit log SEO (P1 F-06)

**Durée** : 0,5 jour.
**Risque** : très faible.
**Dépendance** : aucune (peut être faite en parallèle de phase 2).
**Feature flag** : aucun.

### 3.1 Étapes

1. **Tests d'abord** : écrire `SeoAuditLogPanel.test.tsx` (rendering, filtres, load more, état vide).
2. Implémenter `lib/db/queries/seo.ts::listAuditEventsForSeo({ limit, cursor, action })`.
3. Écrire test `listAuditEventsForSeo.test.ts` (mock Drizzle ou test DB).
4. Implémenter `app/api/admin/seo/audit-log/route.ts` (GET) avec auth admin.
5. Écrire test API route via MSW ou test integration.
6. Implémenter `SeoAuditLogPanel.tsx`.
7. Ajouter route `/admin/seo/audit-log/page.tsx` + lien depuis `/admin/seo` liste.
8. Commit : `feat(seo-admin): audit log panel listing recent SEO events`.

### 3.2 Fichiers touchés

- `apps/web/src/lib/db/queries/seo.ts` (étendu)
- `apps/web/src/lib/db/queries/seo.test.ts` (étendu)
- `apps/web/src/app/api/admin/seo/audit-log/route.ts` (nouveau)
- `apps/web/src/components/admin/seo/SeoAuditLogPanel.tsx` (nouveau)
- `apps/web/src/components/admin/seo/SeoAuditLogPanel.test.tsx` (nouveau)
- `apps/web/src/app/admin/seo/audit-log/page.tsx` (nouveau)
- `apps/web/src/app/admin/seo/page.tsx` (modifié — lien)

### 3.3 Critères de done

- Tests verts.
- Page `/admin/seo/audit-log` accessible, affiche les 20 derniers events après une action.
- Filtres action et actor fonctionnels.
- Pagination cursor stable.

---

## Phase 4 — OG image dynamique (P1 F-07)

**Durée** : 2 jours.
**Risque** : moyen (edge runtime + cache CDN).
**Dépendance** : phase 2 mergée (le picker doit pouvoir sélectionner « template »).
**Feature flag** : `NEXT_PUBLIC_SEO_OG_DYNAMIC` (default `false` en staging, à activer en prod après validation).

### 4.1 Étapes

1. **Tests d'abord** :
   - `og-image.schemas.test.ts` — Zod validation.
   - `og-image-resolver.test.ts` — fonction `resolveOgImageForRoute` returns correct branch.
   - `ogImageGenerator.test.ts` — `renderTemplate` retourne JSX avec title.
2. Implémenter `lib/seo/og-image.schemas.ts`.
3. Implémenter `lib/seo/og-image-resolver.ts` (refactor de `og-image-resolver` existant pour gérer le mode dynamique).
4. Implémenter `app/api/og/[template]/route.tsx` avec `ImageResponse` (`next/og`).
5. Designer les 4 templates (marketing, article, product, default) avec charte FemiGlow.
6. Préparer polices (Inter + Cormorant Garamond) fetch via CDN dans le handler edge.
7. Tester E2E : `apps/web/e2e/og/dynamic-og.spec.ts` — fetch et assert.
8. Mesurer P95 latence (locale + staging).
9. Activer flag en staging, smoke test sur partages Facebook (Open Graph Debugger).
10. Commit : `feat(seo): dynamic OG image generation with 4 templates`.

### 4.2 Fichiers touchés

- `apps/web/src/lib/seo/og-image.schemas.ts` (nouveau)
- `apps/web/src/lib/seo/og-image-resolver.ts` (modifié ou refactoré)
- `apps/web/src/lib/seo/og-image-templates.tsx` (nouveau — JSX templates)
- `apps/web/src/app/api/og/[template]/route.tsx` (nouveau)
- `apps/web/e2e/og/dynamic-og.spec.ts` (nouveau)
- Tests unitaires associés (×3)

### 4.3 Critères de done

- Tests Vitest verts (schemas, resolver, templates).
- E2E Playwright vert (fetch retourne PNG valide).
- P95 latence < 800 ms (cache miss) sur staging.
- Flag activable runtime sans redéploiement (env var SSR).
- Headers cache-control corrects (`public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000`).

---

## Phase 5 — Scope `component` branché au rendu (P1 F-08)

**Durée** : 2 jours.
**Risque** : moyen (touche le rendu metadata des pages publiques).
**Dépendance** : phase 1 mergée. Phase 4 idéale mais pas obligatoire.
**Feature flag** : `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES` (default `false`).

### 5.1 Étapes

1. **Tests d'abord** :
   - `component-resolve.test.ts` — fonction `resolvePageWithComponents` (≥ 6 cas).
   - Snapshot `/kit` metadata avec et sans override composant.
   - `getActiveComponentOverrides.test.ts` (batch fetch).
2. Implémenter `lib/seo/cache.ts` (constantes tags) et `lib/db/queries/seo.ts::getActiveComponentOverrides`.
3. Implémenter `lib/seo/component-resolve.ts::resolvePageWithComponents`.
4. Modifier `app/kit/page.tsx` `generateMetadata` pour appeler `resolvePageWithComponents` (derrière flag).
5. Étendre la revalidation : dans `/api/admin/seo/[id]/publish/route.ts`, si `scope === 'component'`, revalidate aussi `seoTargetTag('page', parentPageKey)` via `resolvePageKeyFromComponentKey` map.
6. Étendre `/api/_debug/seo` pour retourner aussi les composantOverrides.
7. Tests E2E (`kit-component-override.spec.ts`) : insère override composant, visite `/kit`, assert title écrasé.
8. Activer flag en staging, snapshot prod metadata avant/après pour comparaison.
9. Commit : `feat(seo): wire component scope to page metadata resolution`.

### 5.2 Fichiers touchés

- `apps/web/src/lib/seo/cache.ts` (nouveau)
- `apps/web/src/lib/seo/component-resolve.ts` (nouveau)
- `apps/web/src/lib/seo/component-resolve.test.ts` (nouveau)
- `apps/web/src/lib/db/queries/seo.ts` (étendu)
- `apps/web/src/lib/db/queries/seo.test.ts` (étendu)
- `apps/web/src/app/kit/page.tsx` (modifié)
- `apps/web/src/app/api/admin/seo/[id]/publish/route.ts` (modifié)
- `apps/web/src/app/api/_debug/seo/route.ts` (étendu)
- `apps/web/e2e/seo/kit-component-override.spec.ts` (nouveau)

### 5.3 Critères de done

- Tests Vitest verts (≥ 10 nouveaux tests).
- Snapshot metadata `/kit` strictement identique au snapshot pré-phase quand flag à `false`.
- Avec flag `true` + override composant, le title `/kit` reflète le composant.
- Publication d'un override composant invalide bien la page parente (vérifié par log `revalidateTag`).
- Aucune nouvelle requête DB en hot path (batch fetch validé via test integration).

---

## Phase 6 — Confort & scale (P2, backlog)

**Durée** : 2 jours cumulés.
**Risque** : faible.
**Dépendance** : phases 1-5 mergées et stables 1 semaine.

### 6.1 Items

- **F-09 — Cache-Control HTML pages publiques** : étendre `next.config.js` headers (cf. `05-frontend-public-design.md` §6).
- **F-10 — Canonical normalisation** : middleware UTM strip + trailing slash. Tests middleware Vitest.
- **F-11 — UI hreflang** : section dans `SeoOverrideEditor` pour saisir alternates. Schéma DB optionnel (`seoAlternates` ou JSONB sur override).
- **F-12 — Sitemap viewer / robots editor** : section read-only dans `/admin/seo/settings` affichant `/sitemap.xml` parsé et `/robots.txt`.
- **F-13 — Snapshot diff visuel** : composant `SeoSnapshotDiff.tsx` qui affiche un diff JSON entre 2 snapshots.

### 6.2 Étapes (par item)

Modèle identique aux phases 0-5 : tests d'abord, implémentation, vérification, commit.

### 6.3 Critères de done par item

Définis lors de l'implémentation. Documenter en `10-acceptance-criteria.md` à ce moment-là.

---

## Vue d'ensemble — Gantt simplifié

```
Semaine 1
  Lundi      Phase 0 (1 h)  + démarrage Phase 1 (2 h)
  Mardi      Phase 2 (1 j)
  Mercredi   Phase 3 (0.5 j) + démarrage Phase 4 (0.5 j)
  Jeudi      Phase 4 (1 j)
  Vendredi   Phase 4 fin + démarrage Phase 5 (0.5 j)

Semaine 2
  Lundi      Phase 5 (1 j)
  Mardi      Phase 5 fin + stabilisation
  Mercredi   Buffer / revue / smoke prod
  Jeudi-Vend Phase 6 selon priorisation
```

Total : 8 jours homme effectifs + ~2 j de stabilisation/buffer.

## Décisions en attente

Aucune décision bloquante. Confirmer en début de phase 4 :

- Quel runtime pour `/api/og/[template]` : edge (préféré) vs node ?
- Politique de cache CDN : valeurs `s-maxage` et `stale-while-revalidate` à arbitrer avec ops.

## Indicateurs de progression

À mettre à jour dans `README.md` à chaque phase mergée :

```
| Phase | Statut    | Mergé sur main | Déployé prod |
|-------|-----------|----------------|---------------|
| 0     | À faire   | -              | -             |
| 1     | À faire   | -              | -             |
| ...
```
