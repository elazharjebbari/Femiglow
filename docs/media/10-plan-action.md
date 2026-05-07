# 10 — Plan d'action

## Vue d'ensemble

Découpage en **6 phases** de 1 à 2 semaines chacune, environ
**95 tâches atomiques** (`MED-001` → `MED-095`).

| Phase | Thème | Livrable | Durée estimée |
|---|---|---|---|
| 1 | Couche data | schéma DB, migrations, queries, seed | 5 j |
| 2 | Pipeline backend | optimizeImage/Video/Audio, storage adapter, cron | 8 j |
| 3 | API admin + public | routes REST, validation, audit | 5 j |
| 4 | Frontend RSC | composants `<MediaImage/Video/Audio>`, hooks | 6 j |
| 5 | Admin UI | bibliothèque, drawer, upload, settings | 8 j |
| 6 | Polish + tests + migration | E2E, a11y, perfs, migration des SVG existants | 5 j |

Total : ~37 j de dev, soit **5–6 semaines** à plein temps.

---

## Phase 1 — Couche data (MED-001 → MED-015)

### MED-001 — Ajouter les enums Drizzle

`src/lib/db/schema.ts` : ajouter les 11 `pgEnum` listés dans
`02-data.md`. **Critère** : `pnpm typecheck` passe.

### MED-002 — Schéma table `media`

Ajouter `media` avec toutes les colonnes (id, kind, source, slug,
metadata, blurhash, palette, alt, status, …). FK `created_by` →
`admin_users.id`. **Critère** : `pnpm db:generate` produit la
migration sans erreur.

### MED-003 — Schéma `media_variants`

FK CASCADE vers `media`. UNIQUE partial sur
`(media_id, format, breakpoint)`.

### MED-004 — Schéma `media_tags`, `media_to_tags`

Tags + jointure many-to-many.

### MED-005 — Schéma `media_usages`

Tracking d'utilisation, indexes.

### MED-006 — Schéma `media_jobs`

File d'attente, indexes partiels.

### MED-007 — Migration initiale `0001_media.sql`

Vérifier l'ordre (enums → tables → indexes) et l'absence de drop.

### MED-008 — Étendre `Store` interface (memoryStore)

`src/lib/db/client.ts` : ajouter les Maps pour le double-driver.

### MED-009 — Queries `media.ts` (double-driver)

`createMedia`, `findMediaById`, `findMediaBySlug`, `listMedia`,
`updateMedia`, `softDeleteMedia`, `hardDeleteMedia`. Pattern
homogène avec `leads.ts`.

### MED-010 — Queries `media-variants.ts`

`createVariant`, `listVariants(mediaId)`, `deleteVariantsByMedia`.

### MED-011 — Queries `media-jobs.ts`

`enqueueJob`, `claimNextPendingJob` (avec FOR UPDATE SKIP LOCKED côté
Drizzle, FIFO côté memory), `markJobDone`, `markJobFailed`.

### MED-012 — Queries `media-tags.ts`

CRUD léger.

### MED-013 — Queries `media-usages.ts`

`recordUsage` avec UPSERT, `listUsages(mediaId)`.

### MED-014 — Types TypeScript

`src/lib/media/types.ts` : `Media`, `MediaVariant`, `MediaOverrides`,
`PaletteEntry`, etc.

### MED-015 — Tests Vitest queries (couvre tous les drivers)

Cf. `09-tests.md` § Vitest unit. **Critère** : ≥ 30 tests, coverage
> 90 % sur queries.

---

## Phase 2 — Pipeline backend (MED-016 → MED-040)

### MED-016 — Installer dépendances

`pnpm add sharp blurhash file-type music-metadata fluent-ffmpeg ffmpeg-static`. Vérifier que sharp build sur Vercel fra1 (binaire prebuild).

### MED-017 — Storage adapter — interface

`src/lib/media/storage/types.ts` : `StorageAdapter` interface.

### MED-018 — Storage `local` adapter

Filesystem, route handler `/_media/[…path]`.

### MED-019 — Storage `vercelBlob` adapter

SDK `@vercel/blob`, signed URLs HMAC custom.

### MED-020 — Storage `external` (passthrough)

Anti-SSRF réutilisé de `lib/webhooks/anti-ssrf.ts`.

### MED-021 — `getStorage()` selector

Selon `env.MEDIA_STORAGE_DRIVER`.

### MED-022 — `validateUpload(file, kind)`

Magic-bytes via `file-type`, size limits, MIME whitelist.

### MED-023 — Pipeline `optimizeImage`

`sharp` + 6 breakpoints × 3 formats. Test avec PNG de
`docs/images/values/`.

### MED-024 — Calcul `blurhash`

Encodeur `blurhash` sur version 32×32.

### MED-025 — Calcul `palette` (k-means)

k=3 sur 64×64.

### MED-026 — Calcul `phash` (perceptual hash)

Implémentation 64-bit DCT (réutiliser `sharp-phash` ou
implémentation maison).

### MED-027 — Pipeline `optimizeVideo`

`fluent-ffmpeg` MP4 H.264 + WebM VP9 + poster.

### MED-028 — Pipeline `optimizeAudio`

MP3 + Opus, durée via `music-metadata`.

### MED-029 — `blurhashToSvgDataUrl` (RSC server-only)

Décodage côté serveur, PNG base64 inline.

### MED-030 — `extractPosterFromVideo`

Frame à `00:00:01`.

### MED-031 — Worker cron `/api/cron/media-optimize`

Claim atomique, traitement par kind, retry exponentiel.

### MED-032 — `vercel.json` cron entry

`* * * * *` sur la nouvelle route.

### MED-033 — Idempotence des uploads Blob

Clé canonique `media/{id}/{format}/{breakpoint}.{ext}`.

### MED-034 — Détection variantes manquantes

Avant `status='ready'`, vérifier le compte attendu.

### MED-035 — Audit events pipeline

`logAuditEvent('media.optimized', …)` à chaque succès.

### MED-036 — Tests Vitest pipeline

Image, vidéo, audio. Snapshots des tailles. Coverage ≥ 85 %.

### MED-037 — Tests Vitest storage adapters

Local + mock vercelBlob.

### MED-038 — Tests Vitest queue (claim, retry, backoff)

Simuler erreurs transitoires.

### MED-039 — Endpoint `/api/cron/media-recover` (manuel)

Repique les `failed`.

### MED-040 — Variables d'env + Zod validation

`src/env.ts` : `MEDIA_STORAGE_DRIVER`, taille max, etc.

---

## Phase 3 — API admin + public (MED-041 → MED-055)

### MED-041 — `POST /api/admin/media/upload`

Multipart, validation, INSERT media + job, 201.

### MED-042 — `GET /api/admin/media` (liste paginée)

Filtres, recherche, tri, cursor.

### MED-043 — `GET /api/admin/media/{id}`

Détail complet.

### MED-044 — `PATCH /api/admin/media/{id}`

Métadonnées + détection régénération nécessaire.

### MED-045 — `DELETE /api/admin/media/{id}` (soft + hard)

Avec confirmation côté UI pour hard.

### MED-046 — `POST /api/admin/media/{id}/regenerate`

Idempotent.

### MED-047 — `GET/PATCH /api/admin/media/settings`

Config globale + déclenchement régénération masse.

### MED-048 — `POST /api/admin/media/tags` (CRUD)

CRUD léger.

### MED-049 — `GET /api/media/{idOrSlug}` (public)

Cache HTTP `s-maxage=86400`. Pas d'auth.

### MED-050 — Rate-limit upload

30 req/min/IP.

### MED-051 — `GET /admin/media/health` (admin only)

Stats queue + dernière exécution cron.

### MED-052 — Audit events (toutes mutations)

`media.uploaded`, `metadata_updated`, `regenerated`, `deleted`,
`override_changed`.

### MED-053 — Tests MSW intégration API admin

Cf. `09-tests.md`.

### MED-054 — Tests MSW intégration API publique

Cache headers, 404 deleted, etc.

### MED-055 — CSP : ajouter `img-src` et `media-src` Vercel Blob

Dans `next.config.js` ou middleware CSP.

---

## Phase 4 — Frontend RSC (MED-056 → MED-070)

### MED-056 — `getMedia(idOrSlug)` (RSC + cache)

`unstable_cache` avec tags.

### MED-057 — `<MediaImage>` (RSC wrapper)

Résolution config, sélection variantes, render `<MediaImageClient>`.

### MED-058 — `<MediaImageClient>` (Client Component)

`<picture>` + srcset + BlurHash inline + fade-in.

### MED-059 — `<MediaVideo>` + `<MediaVideoClient>`

Stratégies lazy spéciales (`interaction`).

### MED-060 — `<MediaAudio>`

Simple `<audio>` avec preload selon stratégie.

### MED-061 — `<MediaPlaceholder>` (SVG fallback)

Inline + externe.

### MED-062 — Hook `useMediaInView`

IntersectionObserver wrapper.

### MED-063 — Hook `useNetworkInfo`

Lit `navigator.connection`.

### MED-064 — Hook `useReducedMotion`

`prefers-reduced-motion`.

### MED-065 — `resolveConfig(media, context, props)`

Hiérarchie de résolution (cf. `08-overrides.md`).

### MED-066 — `pickVariants(variants, config)` + `buildSrcset`

Helpers de construction du `<picture>`.

### MED-067 — `recordUsage` (best-effort, queueMicrotask)

Tracking d'usage non-bloquant.

### MED-068 — `<link rel="preload">` pour hero images

Via `metadata` layout ou `<head>` injecté.

### MED-069 — Tests Vitest composants

`@testing-library/react` + jsdom. Coverage ≥ 85 %.

### MED-070 — Tests jest-axe (vitest-axe)

`<MediaImage>`, `<MediaVideo>`, `<MediaAudio>` — 0 violation.

---

## Phase 5 — Admin UI (MED-071 → MED-088)

### MED-071 — Layout `/admin/media`

Header avec breadcrumb, bouton "Importer".

### MED-072 — Composant `<MediaTile>`

Vignette, badges, hover, click.

### MED-073 — Grille `<MediaLibraryGrid>`

Virtualisée (react-virtuoso) au-delà de 200 items.

### MED-074 — Filtres + recherche `<MediaFilters>`

Type, statut, tag, période, inutilisés.

### MED-075 — Vue liste alternative `<MediaLibraryTable>`

Tri sur chaque colonne.

### MED-076 — Page upload `/admin/media/upload`

Drop zone, batch, progression.

### MED-077 — Modale doublon (phash detect)

Comparaison côte à côte, 3 actions.

### MED-078 — Drawer détail `<MediaDrawer>`

Apercu HD, métadonnées, sections collapsibles.

### MED-079 — Section "Variantes générées"

Tableau avec économie %.

### MED-080 — Section "Override (avancé)"

Formulaire structuré + toggle JSON.

### MED-081 — Section "Usages"

Liste des routes consommatrices.

### MED-082 — Section "Journal" (audit)

Timeline.

### MED-083 — Bulk actions (sélection multiple)

Tags, profil, régénérer, supprimer.

### MED-084 — Page dédoublonnage `/admin/media/duplicates`

Clusters phash.

### MED-085 — Page settings `/admin/media/settings`

Profils + breakpoints + stratégies.

### MED-086 — Toast / notifications

Cohérent avec le module admin existant.

### MED-087 — Responsive mobile

Drop zone fullscreen, drawer fullscreen, sheet de filtres.

### MED-088 — Tests E2E Playwright

Upload, library, drawer, settings.

---

## Phase 6 — Polish + migration (MED-089 → MED-095)

### MED-089 — Script `seed-media.ts`

Lit `docs/images/values/`, crée 10–15 médias seed.

### MED-090 — Migration des `<img>` existants

Audit script + remplacement par `<MediaImage>`.

Liste cible :

```
src/app/page.tsx
src/app/(public)/rituel/page.tsx
src/app/(public)/journal/[slug]/page.tsx
src/components/marketing/Hero.tsx
src/components/marketing/ProductCard.tsx
src/components/avis/AvisCard.tsx
…
```

### MED-091 — Tests E2E LCP (réseau simulé)

`< 2.5 s` sur 4G simulé.

### MED-092 — Optimisation bundle

Vérifier que `<MediaImage>` n'augmente pas le bundle JS principal de
plus de 8 KB gzipped (sharp et blurhash en server-only).

### MED-093 — Documentation utilisateur

Tutoriel "Ton premier import" dans `docs/admin/`. Captures d'écran.

### MED-094 — Runbook (cf. `11-runbook.md`)

Validé en preview avec un import réel.

### MED-095 — Mise en prod

- Cron Vercel activé.
- Migration DB Neon.
- Token Vercel Blob configuré.
- Smoke test post-déploiement.

---

## Critères de fin de phase (gates)

| Phase | Gate |
|---|---|
| 1 | `pnpm db:migrate` réussit + 30 tests Vitest verts + queries en double-driver |
| 2 | Pipeline traite une image complète (PNG → 18 variantes) en < 5 s + cron passe localement |
| 3 | Tous les endpoints répondent (manuel curl) + audit events visibles dans `/admin/audit` |
| 4 | Une page de demo (`/dev/media-demo`) rend `<MediaImage>`, `<MediaVideo>`, `<MediaAudio>` correctement avec 0 a11y violation |
| 5 | Toutes les pages admin sont navigables, l'upload fonctionne en preview avec Vercel Blob |
| 6 | LCP ≤ 2.5 s mobile sur preview, 0 régression sur les pages existantes, 0 a11y violation, runbook à jour |

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| `sharp` ne build pas sur Vercel | basse | bloquant | Tester en preview dès MED-016, fallback @squoosh/lib |
| `ffmpeg-static` trop lourd (~80 MB) | moyenne | déploiement lent | Lazy import dans le worker uniquement |
| Quota Vercel Blob dépassé | basse | blocage uploads | Monitoring `/admin/media/health`, cap à 50 GB Phase 1 |
| Pipeline lent sur grosses vidéos | haute | UX dégradée | Cap à 1280px width, message d'attente clair |
| Migration des `<img>` existants casse des pages | moyenne | régressions | Tests E2E sur les pages migrées avant merge |
| `phash` faux positifs (déduplication trop agressive) | moyenne | doublons forcés | Distance ≤ 5 bits stricte, UI pour ignorer cluster |
| AVIF mal décodé sur Safari < 17 | basse | image cassée | Fallback `<source type="image/webp">` toujours présent |

## Dépendances entre phases

```
Phase 1 ──► Phase 2 ──► Phase 3 ──┬──► Phase 4 ──► Phase 6
                                  └──► Phase 5 ─────┘
```

- Phase 4 et 5 peuvent partir en parallèle dès la fin de la Phase 3.
- Phase 6 attend les deux.
