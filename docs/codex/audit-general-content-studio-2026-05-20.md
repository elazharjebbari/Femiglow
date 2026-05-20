# Audit général — Content Studio (AI generation + Postiz)

Date : 2026-05-20
Environnement : staging `/var/www/femiglow-staging`
Branche : `master` (à jour avec `origin/master`)
Auteur : Codex (audit synthétique)

## 0. Résumé exécutif

Le module **Content Studio** est un studio IA intégré à `apps/web` (Next.js App Router) qui orchestre :
**idée → brief → 3 brouillons IA → revue marque → approbation humaine → brouillon Postiz → publication → mesure**.

À ce jour, l'ensemble du pipeline est **fonctionnel en staging** en mode mock/fallback, et a été **validé en réel** sur OpenAI texte + image et sur création de brouillon Postiz (sans publication automatique) lors des passes du 2026-05-18.

**Maturité globale** : *prototype avancé, en cours de hardening avant production.* L'architecture est en place, la couverture de tests est respectable (~256 cas unit + 1 spec E2E Playwright), mais plusieurs zones nécessitent encore du travail : observabilité UI des runs IA, comparaison de variantes, retry contrôlé depuis l'admin, et durcissement systemd.

**État actuel du working tree** : 6 fichiers modifiés non-commités correspondant à la phase 1 et 2 du *plan-action-hardening-ai-generation-postiz* (extraction d'ID Postiz centralisée + retry réseau borné + `image:[]` pour drafts texte seul + E2E pipeline UI complet).

---

## 1. Vision et périmètre

### 1.1 Vision produit
Source : `docs/ai-content-studio/00-overview/executive-summary.md` et `decision-finale.md`.

> *L'IA propose, la fondatrice valide, Postiz publie.*

- Module **admin** intégré dans FemiGlow (pas un microservice).
- Mono-utilisateur initialement (la fondatrice). Pas multi-tenant, pas équipes concurrentes.
- Fidélité marque > volume (3 posts parfaits > 30 génériques).
- Humain dans la boucle obligatoire : aucune publication 100 % automatique.

### 1.2 Périmètre P0 inclus
- Bibliothèque d'idées + briefs éditoriaux.
- Génération texte (caption + 3 variantes) + visuel propositif.
- Brand safety déterministe + scoring 0-100.
- Review humaine obligatoire avant approbation.
- Calendrier éditorial simple, pipeline kanban.
- Bridge Postiz : `integrations`, `upload`, `posts (draft)`, `posts (list)`, `analytics`.
- Audit trail complet (audit logs + `content_generation_run`).

### 1.3 Périmètre exclu
- Publication 100 % automatique.
- Réponse DM, achat média publicitaire.
- Multi-marques, multi-langues (français hardcodé).

---

## 2. Architecture cible vs réelle

### 2.1 Couches livrées (code réel)

```
apps/web/src/
├── lib/content-studio/                  ← module domaine
│   ├── state-machine.ts                 ✅ 12 états, transitions strictes
│   ├── schemas.ts                       ✅ Zod (.strict) toutes entrées HTTP
│   ├── types.ts                         ✅ 11 entités typées
│   ├── repository.ts (~1400 l.)         ✅ Drizzle + fallback in-memory
│   ├── service.ts (~650 l.)             ✅ orchestration métier
│   ├── generation.ts                    ✅ OpenAI gpt-4o-mini + fallback
│   ├── image-generation.ts              ✅ DALL-E (opt-in) + mock SVG (default)
│   ├── brand-rules.ts                   ✅ regex + scoring
│   ├── budget.ts                        ⚠ non thread-safe
│   ├── idempotency.ts                   ✅ DB-backed + in-memory fallback
│   ├── postiz.ts                        ✅ retry exponentiel + extract ID centralisé
│   ├── automation.ts                    ✅ 4 jobs cron
│   ├── auth.ts                          ✅ requireAdminApi + feature flag
│   └── *.test.ts                        ✅ 13+ fichiers vitest
├── lib/db/schema-content-studio.ts      ✅ 11 tables Postgres + index
├── app/api/admin/content-studio/        ✅ 25 routes API REST
├── app/api/cron/content-studio/         ✅ 4 routes cron (CRON_SECRET)
├── app/admin/content-studio/page.tsx    ✅ server component
├── components/admin/content-studio/     ✅ 31 composants .tsx (4 onglets)
└── e2e/content-studio.spec.ts           ✅ Playwright (17→18 tests)
```

### 2.2 Modèle de données
Source : `apps/web/src/lib/db/schema-content-studio.ts`.

| Table | Rôle | Cascade |
|---|---|---|
| `content_campaign` | Regroupement | — |
| `content_idea` | Idée initiale | nullable → campaign |
| `content_brief` | Brief structuré (angle, proof, CTA) | cascade ← idea |
| `content_draft` | Variantes IA (3) | cascade ← brief |
| `content_brand_review` | Score 0-100 + violations | cascade ← draft |
| `content_post` | Post planifié | cascade ← draft |
| `content_postiz_delivery` | Livraison Postiz + retry | cascade ← post |
| `content_performance_snapshot` | Analytics importées | cascade ← post |
| `content_generation_run` | Audit IA (provider/cost) | nullable ← idea/brief |
| `content_asset_binding` | Lien draft ↔ media | cascade ← draft, restrict ← media |
| `content_learning_note` | Notes apprentissage | nullable ← post |
| `content_idempotency_keys` | Idempotence DB-backed | — |

**12 tables au total** (les docs en annoncent 11 + idempotency ajouté en P3.3).

### 2.3 State machine — 12 états
```
idea → brief, generated, archived          ← MAJ 2026-05-18 : ajout idea→generated
brief → generated, rejected, archived
generated → needs_review, rejected, archived
needs_review → approved, generated, rejected, archived
approved → scheduled, rejected, archived
scheduled → published, cancelled, rejected, archived
published → measured
mesured/cancelled/rejected → archived
archived = terminal
```
Validé par 36 cas test (`state-machine.test.ts`). Transitions assertées partout via `assertTransition()` qui lève `HttpError('invalid_state')`.

---

## 3. Inventaire des fonctionnalités implémentées

### 3.1 Backend / API admin (25 routes)

**Idées**
- `GET/POST /ideas` (idempotency key supporté)
- `POST /ideas/[id]/generate` (budget check 2¢)
- `POST /ideas/[id]/archive`

**Briefs**
- `PATCH /briefs/[id]`

**Drafts**
- `GET /drafts`, `PATCH /drafts/[id]`
- `POST /drafts/[id]/review` (auto brand-rules)
- `POST /drafts/[id]/approve` `/reject` `/archive` `/variation`
- `POST /drafts/[id]/generate-visual` (budget check)

**Posts**
- `GET /posts`
- `POST /posts/[id]/postiz-draft` ← création brouillon dans Postiz
- `POST /posts/[id]/reschedule` `/cancel` `/archive`

**Campagnes** (P3.8)
- `GET/POST /campaigns`, `PATCH /campaigns/[id]`

**Support**
- `GET /media`, `GET /generation-runs`, `GET /health`, `GET /automation`
- `POST /learning-notes`, `POST /utm`
- `POST /postiz/integrations/sync`

**Cron jobs** (Bearer `CRON_SECRET`)
- `postiz-sync` — sync intégrations
- `retry-deliveries` — rejeu deliveries `failed`, max 3 attempts, dédup par (postId, integrationId)
- `import-status` — pull statuts sur ±30j
- `import-performance` — pull analytics

### 3.2 Génération IA

**Texte** (`generation.ts`)
- OpenAI Chat Completions, modèle configurable (défaut `gpt-4o-mini`).
- Température 0.65, format JSON strict.
- Prompt système : français, sans emoji, sans `!`, sans urgence, sans promesse médicale.
- **Fallback déterministe** si clé absente ou erreur : 3 templates fixes (sobre / sensorielle / conversion douce). Cost = 0¢, provider = `fallback`.

**Image** (`image-generation.ts`)
- **Mock SVG → PNG via sharp** par défaut (`CONTENT_STUDIO_IMAGE_PROVIDER=mock`). Coût 0¢.
- **DALL-E (gpt-image-1-mini)** opt-in. Tailles 1024×1024 / 1024×1536 / 1536×1024. Coûts : 1-4¢ selon qualité.
- ⚠ Pas de fallback gracieux si `provider=openai` + clé absente → `throw Error`.

**Pipeline média**
- Génère buffer → `createMedia()` (kind=image, source=upload, compartiment `ai_generated`).
- Stocke `sources/{mediaId}/{id}.png` via `MEDIA_STORAGE_DRIVER=local` (`.media-storage/`).
- `enqueueJob('optimize')` + `runWorkerOnce()` → variants optimisés.
- Tag `overrides.contentStudio = { origin: 'ai_generated', provider, promptVersion, sourceDraftId }`.

**Aucun provider vidéo** (Runway, Sora, ElevenLabs, etc.) — n'est pas dans le périmètre P0/P3.

### 3.3 Intégration Postiz

**Client HTTP** (`postiz.ts`) — réel, connecté à `https://postiz.lumiereacademy.com`.
- Auth : header `Authorization: <POSTIZ_API_KEY>`.
- 5 endpoints couverts : `integrations`, `posts` (GET + POST), `analytics/post/{id}`, `upload`.
- **Retry exponentiel** (modifs non-commitées) : 3 attempts par défaut, délais `[250, 750, 1500]`ms, rejeu sur 408/425/429/5xx.
- **Extraction d'ID Postiz robuste** (modifs non-commitées) : BFS sur clés `id|postId|post_id|publicationId` dans conteneurs `post|posts|data|result|results|item|items|publication`, anti-cycle.
- Payload draft : wrappé `{ posts: [{ value: [{ content, image: [...] }], settings.__type, post_type }] }`. Carrousel → `post_type=post`. **Fix 2026-05-18 : `image: []` même sans média** (Postiz exigeait un array).

**Brand safety déterministe** (`brand-rules.ts`)
- Bloquants (−35 pts) : termes interdits, `!`, emoji, claims médicaux.
- Warnings (−12 pts) : termes commerciaux, >12 hashtags.
- Score baseline 100. Seuils non encore exposés en UI explicitement.

### 3.4 Frontend (4 onglets)
- **Pipeline** (kanban : idée → brief → drafts → review → approved → scheduled)
- **Calendrier** (vues semaine/mois, filtres, navigation)
- **Analytics** (snapshots performance)
- **Budget** (BudgetSummary : runs IA coût cumulés)

Composants notables : `DraftEditor`, `BriefEditor`, `RejectDialog`, `CancelDialog`, `PostizHealthPanel`, `DeliveryStatusBadge`, `LearningNoteForm`, `LoadMore`.

### 3.5 Tests & CI

| Type | Localisation | Volume |
|---|---|---|
| Unit + integration vitest | `lib/content-studio/*.test.ts` | 13 fichiers, ~256 cas |
| MSW handlers | `test/msw/content-studio-handlers.ts` | 474 lignes, 42 mocks |
| E2E Playwright | `e2e/content-studio.spec.ts` | 17 → **18 tests** (modif non-commitée ajoute pipeline UI complet) |
| Smoke runtime | `scripts/smoke-content-studio.ts` | npm `smoke:content-studio` |
| CI GitHub | `.github/workflows/ci.yml` | 2 jobs (Quality 15min, E2E 20min) |

Job CI ajoute un step *Content Studio isolated* qui re-run vitest sur le scope précis (`lib/content-studio + components + msw`).

---

## 4. État d'avancement par phases documentées

### 4.1 Phases M0 → M5 (livrées)
| Jalon | Statut documenté | Statut code |
|---|---|---|
| M0 — Cadrage | done | done |
| M1 — Data + services socle | done | done |
| M2 — API admin CRUD | done | done |
| M3 — UI prototype 4 onglets | done | done |
| M4 — Postiz staging | done | done (réel) |
| M5 — Tests + runbook | done | done (61→256 tests) |

### 4.2 Phase P3 production-readiness (en cours)
| Sous-phase | Commit | Statut |
|---|---|---|
| P3.1 env.example + boot validation + health endpoint | `c910069`, `908d589` | ✅ |
| P3.2 pagination serveur + LoadMore + lazy load tabs | `26806d2` → `dc5f392` | ✅ |
| P3.3 idempotency DB + budget enforcement + status | `9576e5f` → `5ec0e93` | ✅ |
| P3.4 MSW coverage 42 tests | `8ab2785` | ✅ |
| P3.5 helpers + schema tests | `1193701` | ✅ |
| P3.6 E2E 17 tests | `4a3f9c7` | ✅ |
| P3.7 CI isolated content studio + E2E job | `b1ec697` | ✅ |
| P3.8 Campagnes CRUD backend + frontend | `04d9d19`, `1e0f108` | ✅ |
| Stabilisation staging | `aa477fc`, `26a6f64`, `4f5c059` | ✅ |

### 4.3 Hardening AI generation / Postiz (en cours, non commité)
Source : `docs/codex/plan-action-hardening-ai-generation-postiz.md` (2026-05-19).

| Phase | Description | Statut |
|---|---|---|
| Phase 1 | Centraliser `extractPostizPostId()`, accepter formes imbriquées | ✅ working tree |
| Phase 2 | Retry borné 3-5 tentatives sur 408/425/429/5xx, persister stage en delivery | ✅ working tree |
| Phase 3 | Tests Vitest ciblés + typecheck + build + smoke HTTP | À valider |
| Phase 4 | UI/UX : statut delivery explicite, ID Postiz visible, retry depuis admin, panel provider/modèle/coût | ❌ à faire |

### 4.4 Tests réels exécutés le 2026-05-18
Source : `docs/codex/ai-generation-tests-et-ameliorations-2026-05-18.md`.

| Test | Résultat |
|---|---|
| State machine | ✅ (correction `idea→generated` ajoutée) |
| MSW Content Studio | ✅ |
| Image generation mock | ✅ |
| Smoke backend | ✅ après correction state machine |
| Playwright UI complète | ✅ 21 tests |
| Build Next.js | ✅ avec warnings existants |
| Typecheck | ✅ |
| Postiz integrations (lecture) | ✅ 4 intégrations détectées |
| **OpenAI texte réel** | ✅ |
| **OpenAI image réel** (`gpt-image-1-mini`) | ✅ |
| **Postiz draft réel sans média** | ✅ après fix `image: []` |
| **Postiz draft réel avec média IA** | ✅ après retry transitoire 503 |

---

## 5. Ce qui fonctionne (validé)

1. **Pipeline complet idée → draft Postiz** validé bout-en-bout, mock et réel.
2. **State machine stricte** — 36 cas testés, assertion partout.
3. **Repository dual-backend** — Drizzle + fallback in-memory pour dev/CI offline.
4. **Idempotency DB-backed** (`content_idempotency_keys`) avec TTL 24 h + fallback mémoire.
5. **Budget tracking quotidien** avec UI `BudgetSummary` et enforcement avant chaque génération.
6. **Brand safety auto** — regex + scoring 0-100, déclenchée à chaque création de draft.
7. **Postiz integrations sync** — `syncPostizIntegrations()` détecte 4 intégrations en staging.
8. **Upload média Postiz** — multipart FormData, retry sur 5xx (modif récente).
9. **Création draft Postiz** — payload conforme `{ image: [] }`, ID extrait même si imbriqué.
10. **4 jobs cron sécurisés** (`CRON_SECRET`) : sync, retry deliveries, import status, import performance.
11. **CI GitHub** — Quality + E2E + smoke + lint + typecheck + migrations validation.
12. **Audit trail** — chaque action loggée + `content_generation_run` (provider, modèle, coût, erreur).

---

## 6. Ce qui ne fonctionne pas / risques visibles

### 6.1 Critiques résiduels (audit GLM 2026-05-17)
*Note : ces points étaient signalés dans l'audit GLM ; vérifier qu'ils ont été corrigés dans les commits récents.*

| # | Symptôme | Localisation | Sévérité |
|---|---|---|---|
| C1 | Pagination `LoadMore` côté UI n'affichait pas de `totalCount` serveur | composants tabs | 🟡 moyen — à revérifier après `7232703` |
| C2 | Tests P3 testaient parfois des copies isolées au lieu des exports | tests P3.5 | 🟡 moyen |
| C3 | E2E Playwright majoritairement smoke/navigation (avant 2026-05-18) | e2e/ | ⚪ atténué par ajout pipeline UI complet |

### 6.2 Risques techniques actuels

| # | Risque | Sévérité |
|---|---|---|
| R1 | `checkDailyBudget()` non thread-safe — race condition possible si 2 requêtes simultanées | 🟡 moyen |
| R2 | `getDailySpentCents()` charge `listGenerationRuns(1000)` sans filtre date — coût croît avec l'historique | 🟡 moyen |
| R3 | Mutations DB non transactionnelles — un brief créé peut rester orphelin si `createDrafts` échoue | 🟡 moyen |
| R4 | `image-generation.ts` si `provider=openai` + clé absente → `throw Error` non gracieux | 🟢 faible |
| R5 | `.catch(() => ({}))` en cascade dans `postiz.ts` peut masquer erreurs de parse | 🟢 faible |
| R6 | Media storage `local` uniquement (`MEDIA_STORAGE_DRIVER=local`) — pas de backup S3/R2 en staging | 🟡 moyen |
| R7 | Service systemd staging observé `inactive (dead)` après stops externes (note 2026-05-18) | 🟡 moyen |
| R8 | `CRON_SECRET` par défaut placeholder 32-char en CI si var absente — à durcir | 🟡 moyen |
| R9 | Champs DB orphelins : `content_idea.rejectionReason`, `content_draft.parentDraftId` peu/non écrits | 🟢 faible |
| R10 | Token usage OpenAI non capturé/loggé (`generation.ts` ignore le champ `usage`) | 🟢 faible |

### 6.3 Non testé / non implémenté
- **Publication sociale réelle** : créer le brouillon Postiz fonctionne, mais aucun test n'a poussé `scheduled → published` avec effet externe.
- **Retry/backoff côté queue interne** : automation.ts retry, mais pas de file d'attente type BullMQ pour les générations longues.
- **Concurrence multi-admin** : pas de verrou métier par idée/draft.
- **Génération vidéo** : aucun provider câblé (Runway, Sora, Pika, etc.).
- **Multi-langue** : prompts français hardcodés.
- **Cropping visuel UI** : `crop` JSON présent en DB mais pas d'éditeur visuel.
- **Comparaison side-by-side des 3 variantes** : pas de vue dédiée.

---

## 7. Ce qui doit être amélioré (priorisé)

### 7.1 Priorité 1 — Compléter Phase 4 hardening (UI/UX)
1. Panel **"Statut de génération"** par draft : provider, modèle, statut, coût, erreur, timestamp.
2. Badge **"Mock staging"** sur les visuels mock, distinction fallback vs OpenAI.
3. Bouton **"Relancer la génération"** depuis un `generation_run` échoué.
4. **État de progression explicite** sur actions longues (texte, visuel, upload).
5. Statut delivery Postiz plus explicite (`sent` / `failed` / `auth_failed` + stage + dernier message + ID + lien).
6. **Retry contrôlé** d'une delivery échouée depuis l'admin avec audit log.

### 7.2 Priorité 2 — Robustesse système
7. **File de jobs** (BullMQ/pg-boss) pour générations longues au lieu de routes HTTP synchrones.
8. **Verrou métier** + idempotency sur `/ideas/:id/generate` et `/drafts/:id/generate-visual`.
9. Statut explicite `queued/running/succeeded/failed/retried` sur runs.
10. **Stocker le prompt final** (texte + image) avec version dans `content_generation_run` pour debug.
11. **Budget par provider + par action** (texte vs image), visible UI.
12. Corriger l'instabilité **systemd staging** (`inactive (dead)` après stops externes).
13. Backend transactions sur les mutations multi-tables (brief + drafts + asset_binding).

### 7.3 Priorité 3 — UX éditoriale
14. **Comparaison side-by-side** des 3 variantes (score, angle, CTA, hashtags, risque).
15. Affichage **raison brand-safety bloqué** directement sur le draft.
16. **Confirmation** avant toute action Postiz créant un objet externe.
17. Onglet/filtre **"Runs"** pour auditer générations par campagne/idée/draft.
18. Bouton **"copier prompt final"** pour debug éditorial.

### 7.4 Priorité 4 — Tests & qualité
19. Tests contractuels OpenAI/Postiz **opt-in** dans CI (désactivés par défaut, lancés manuellement).
20. 4 smokes séparés : `mock`, `openai`, `postiz-readonly`, `postiz-draft`.
21. **Rétention/nettoyage** des données test Content Studio créées par smoke/Playwright.
22. Corriger les **warnings de build hors AI generation** (Handlebars, dynamic server usage).
23. Coverage gate sur `lib/content-studio/` en CI.

### 7.5 Priorité 5 — Au-delà du P3
24. **Génération vidéo** (Runway/Pika/Sora) si périmètre élargi.
25. **Multi-langue** : externaliser les prompts.
26. **Cropping visuel** dans l'admin.
27. Migration éventuelle vers **S3/R2** pour la production (au-delà de `MEDIA_STORAGE_DRIVER=local`).
28. **Rollup analytics par campagne** (les snapshots existent, pas la vue agrégée).

---

## 8. État des fichiers non-commités (working tree)

| Fichier | Diff | Liée à |
|---|---|---|
| `lib/content-studio/postiz.ts` | +95/-11 — ajout `RetryOptions`, `extractPostizPostId` BFS, `fetchWithRetry`, applique retry à upload/draft/source media | Phase 1 + 2 hardening |
| `lib/content-studio/postiz.test.ts` | +22/-1 — couverture `extractPostizPostId` formes imbriquées | Phase 1 hardening |
| `lib/content-studio/service.ts` | +1/-5 — supprime duplicata local `extractPostizPostId`, utilise l'export | Phase 1 hardening |
| `lib/content-studio/state-machine.ts` | +1/-2 — autorise `idea → generated` | Bug fix 2026-05-18 |
| `lib/content-studio/state-machine.test.ts` | +5/-1 — couvre `idea → generated` | Test bug fix |
| `e2e/content-studio.spec.ts` | +51 — ajoute `mode: 'serial'` + test pipeline UI complet (idée → drafts → visuel mock) | Validation E2E 2026-05-18 |

**Nouveaux docs codex** (non versionnés) :
- `docs/codex/ai-generation-tests-et-ameliorations-2026-05-18.md`
- `docs/codex/plan-action-hardening-ai-generation-postiz.md`
- `docs/codex/runbook-ai-generation-postiz-hardening.md`

Ces 6 fichiers + 3 docs forment un commit cohérent prêt à être créé.

---

## 9. Écarts et contradictions identifiés

1. **Localisation doc** : `docs/content-studio/p3-plan/` est hors de `docs/ai-content-studio/`, incohérent avec la structure du README racine.
2. **State machine documentée vs réelle** : `architecture.md` décrit `idea → brief → generated`, mais l'API actuelle fait `idea → generated` directement (correction 2026-05-18).
3. **Provider image** : `concept.md` liste "DALL-E / Flux / Runway", la réalité est OpenAI + mock uniquement.
4. **Coverage P3** : les docs annonçaient ~75 tests, le code en a ~256 cas (largement dépassé en volume, mais granularité unit-heavy).
5. **`postizPostId` parfois `null`** sur deliveries `sent` : bug identifié et adressé par la centralisation `extractPostizPostId` (modifs non-commitées).

---

## 10. Recommandation de suite (orientations pour décision utilisateur)

Trois grandes voies possibles, par ordre croissant d'ambition :

### Voie A — Finaliser le hardening en cours (1-2 jours)
- Committer les modifs working tree (Phase 1 + 2 + tests).
- Implémenter Phase 4 UI/UX du plan-hardening (panel statut, badge mock, retry admin, ID Postiz visible).
- Cible : un Content Studio robuste et observable, prêt pour usage interne quotidien.

### Voie B — Hardening + queue/observabilité (1 semaine)
- Voie A
- + Introduire une file de jobs pour les générations longues.
- + Statut `queued/running/...` sur runs.
- + Verrou métier sur générations concurrentes.
- + Stocker prompt final versionné.
- + Budget par provider/action.
- Cible : système production-grade, multi-utilisateur safe.

### Voie C — Étendre le produit (2-3 semaines)
- Voie B
- + Génération vidéo (Runway/Pika).
- + Comparaison side-by-side variantes + UX éditoriale enrichie.
- + Multi-langue.
- + Cropping visuel.
- + Rollup analytics par campagne.
- Cible : véritable studio IA éditorial premium.

---

## 11. Annexes

### A. Variables d'environnement utilisées
| Variable | Défaut | Usage |
|---|---|---|
| `CONTENT_STUDIO_ENABLED` | `false` | Feature flag global |
| `CONTENT_STUDIO_OPENAI_API_KEY` | — | Texte + image OpenAI |
| `CONTENT_STUDIO_TEXT_MODEL` | `gpt-4o-mini` | Modèle texte |
| `CONTENT_STUDIO_IMAGE_PROVIDER` | `mock` | `mock` ou `openai` |
| `CONTENT_STUDIO_IMAGE_MODEL` | `gpt-image-1-mini` | Modèle image |
| `CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS` | `500` | Budget quotidien (5$) |
| `CONTENT_STUDIO_DEFAULT_TIMEZONE` | `Africa/Casablanca` | Scheduling |
| `POSTIZ_BASE_URL` | (requis) | URL API Postiz |
| `POSTIZ_API_KEY` | (requis) | Auth Postiz |
| `CRON_SECRET` | (requis) | Bearer routes /api/cron/* |
| `MEDIA_STORAGE_DRIVER` | `local` | `.media-storage/` |
| `NEXT_PUBLIC_SITE_URL` | (requis) | URL absolue uploads |

### B. Commits Content Studio des 50 derniers (sélection)
- `4f5c059` Harden content studio staging validation
- `26a6f64` Stabilize staging content studio
- `aa477fc` fix: resolve 7 build errors blocking staging
- `1e0f108` feat P3.8.2 — campaign frontend + MSW + tests
- `04d9d19` feat P3.8.1 — campaign CRUD backend
- `b1ec697` ci P3.7 — isolated tests + E2E job
- `4a3f9c7` test P3.6 — 17 E2E Playwright tests
- `5ec0e93` feat P3.3.4 — budget status + UI
- `98743cd` feat P3.3.3 — budget enforcement
- `715b6bb` feat P3.3.2 — DB-backed idempotency
- `9576e5f` feat P3.3.1 — idempotency migration

### C. Fichiers clés à consulter en priorité
- `apps/web/src/lib/content-studio/service.ts:467-595` — orchestration `createDraftInPostiz`
- `apps/web/src/lib/content-studio/postiz.ts` — client HTTP + retry + extractId
- `apps/web/src/lib/content-studio/state-machine.ts` — transitions
- `apps/web/src/lib/content-studio/brand-rules.ts` — scoring
- `apps/web/src/lib/db/schema-content-studio.ts` — schéma DB
- `docs/ai-content-studio/30-architecture/architecture.md` — architecture cible
- `docs/codex/plan-action-hardening-ai-generation-postiz.md` — plan en cours
- `docs/codex/ai-generation-tests-et-ameliorations-2026-05-18.md` — résultats tests réels
