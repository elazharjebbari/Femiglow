# Système de gestion des médias FemiGlow — Spécification

Spécification complète d'un module **Media Library** intégré à
l'application FemiGlow (Next.js 14, App Router) qui couvre :

- gestion **images / vidéos / audio** (URL externe ou stockage local),
- pipeline d'**optimisation** (AVIF / WebP / JPEG / MP4 H.264 / WebM),
- **versions responsive** par breakpoint (mobile / tablet / desktop / wide),
- **qualité adaptative** par contexte (hero / inline / thumb),
- **lazy-loading intelligent** (eager pour hero, IntersectionObserver,
  LQIP, blurhash, SVG placeholder),
- **override par média** qui écrase la config par défaut,
- **interface admin** (bibliothèque, upload, métadonnées, dédoublonnage),
- **API publique** consommée par le frontend (Server Components + Client),
- **fallback SVG placeholder** pour préserver la structure des pages
  même en cas de chargement lent ou de bug.

Le module se branche sur l'infrastructure existante (Neon/Postgres,
Drizzle, iron-session, Vercel) et réutilise les conventions du module
admin (audit, rate-limit, CSP nonce, secrets chiffrés).

## Sommaire

| # | Document | Contenu |
|---|---|---|
| 00 | [Cahier des charges](00-cahier-des-charges.md) | Exigences fonctionnelles, non-fonctionnelles, KPIs, contraintes |
| 01 | [Architecture](01-architecture.md) | Vue d'ensemble, composants, flux, séquence upload, dépendances |
| 02 | [Couche data](02-data.md) | Schéma Drizzle (`media`, `media_variants`, `media_tags`, `media_usages`), migrations, indexes |
| 03 | [Backend](03-backend.md) | Routes API, pipeline `sharp`/`ffmpeg`, storage adapter, signed URLs |
| 04 | [Frontend](04-frontend.md) | `<MediaImage>`, `<MediaVideo>`, `<MediaAudio>`, hooks, intégration RSC |
| 05 | [UI/UX & design](05-ui-ux-design.md) | Bibliothèque admin, grille responsive, drawer détails, tokens design |
| 06 | [Optimisation rendu](06-optimisation-rendu.md) | Formats, qualité, breakpoints, BlurHash, art-direction |
| 07 | [Lazy-loading](07-lazy-loading.md) | Stratégies (`eager`, `viewport`, `idle`, `interaction`), hero opt-out, SVG placeholder |
| 08 | [Overrides per-media](08-overrides.md) | Système d'overrides qui écrase la config globale |
| 09 | [Stratégie de tests](09-tests.md) | Vitest unit, MSW intégration, Playwright E2E, jest-axe |
| 10 | [Plan d'action](10-plan-action.md) | Phases, tâches atomiques (MED-001 → MED-095) |
| 11 | [Runbook](11-runbook.md) | Opérations courantes : import, ré-encodage massif, incidents |

## Conventions transverses

- **Préfixe d'ID Postgres** : `me_` (média), `mv_` (variant), `mu_`
  (usage), `mt_` (tag).
- **Préfixe API** : `/api/admin/media/*` (admin) et
  `/api/media/*` (public, lecture seule).
- **Storage adapter** : interface unique avec implémentations `local`
  (filesystem `/public/_media/`), `s3` (Vercel Blob ou S3
  compatible), `external` (URL distante non re-hébergée).
- **Voix** : interfaces et messages d'erreur en **français**, ton
  FemiGlow (tutoiement, accessible, zéro jargon technique côté
  fondatrice).
- **Sécurité** : toutes les routes admin sont derrière le middleware
  `requireAdmin`. Les uploads sont **scannés** (magic bytes + taille
  max) avant écriture. CSP s'applique au rendu.

## Inputs externes pour les tests

Le répertoire `docs/images/values/` (déjà présent dans le repo)
contient les images sources réelles (PNG haute définition pour
`home`, `journal`, `kit`, `maison`, `rituel`). Elles serviront :

- **fixtures** des tests d'intégration MSW et E2E Playwright,
- **données de seed** pour la bibliothèque média en preview / staging,
- **source** du pipeline d'optimisation (PNG → AVIF/WebP/JPEG variants).

Les SVG actuels de `apps/web/public/products/`, `public/avis/`, etc.
sont conservés comme **placeholders** : ils sont rendus en première
peinture, puis remplacés progressivement par les variants optimisés
correspondants quand ceux-ci sont prêts (cf. doc `07-lazy-loading.md`).

## Dépendances ajoutées

| Paquet | Rôle | Usage |
|---|---|---|
| `sharp` | Encodage images AVIF/WebP/JPEG/PNG, redimensionnement | pipeline backend |
| `blurhash` | Génération hash compact pour LQIP | pipeline + frontend |
| `plaiceholder` (optionnel) | Génère blurDataURL Next.js compatible | pipeline |
| `fluent-ffmpeg` + binaire `ffmpeg-static` | Encodage vidéo MP4/WebM, extraction poster | pipeline backend |
| `music-metadata` | Extraction durée/bitrate audio | pipeline backend |
| `file-type` | Détection magic bytes (anti-MIME spoof) | pipeline upload |
| `nanoid` (déjà présent via `createId`) | IDs préfixés | toutes les tables |

## Hors-scope (Phase ultérieure)

- DAM full-text search (Algolia / Meilisearch) — à voir Phase 2.
- DRM / watermarking dynamique — pas de besoin actuel.
- Intégration directe Sanity CMS pour les médias — Phase 3, dépend de
  la décision CMS finale (cf. `docs/admin/specifications/02-design-system/`).
- CDN tiers (Cloudflare Images / Imgix) — Phase 2 si Vercel Images ne
  suffit pas en coût ou en latence (cf. `06-optimisation-rendu.md` §4).
