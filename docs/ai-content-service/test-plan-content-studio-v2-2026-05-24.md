# Plan de test — Content Studio v2

| Champ | Valeur |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-05-24 |
| **Auteur** | Agent IA (Claude Opus 4.7) |
| **Statut** | Draft — en attente de validation |
| **Module** | Content Studio v2 (`/admin/content-studio-v2/*`) |
| **Stack** | Vitest 2.1 · @testing-library/react 16 · MSW 2.14 · Playwright 1.48 · @axe-core/playwright 4.11 |

---

## 1. Résumé exécutif

### 1.1 Contexte

Content Studio v2 est le module de création, gestion et publication de contenu social de FemiGlow. Il couvre 4 modes (Home, Create, Library, Plan) et un pipeline IA (texte via OpenAI chat/completions, image via OpenAI images/generations). Le module est déployé en staging derrière deux feature flags (`CONTENT_STUDIO_V2_ENABLED`, `CONTENT_STUDIO_V2_DEFAULT`).

### 1.2 Constat

L'infrastructure de test actuelle couvre la logique pure (unit) et la navigation shell (E2E) mais **aucun parcours métier opérateur n'est vérifié end-to-end**. Sur les 12 étapes du workflow de création d'un post, 0 sont testées du point de vue utilisateur. Les sorties de l'IA ne sont pas validées structurellement. 3 routes API critiques n'ont pas de mock MSW. Le CI ne lance que 1 spec E2E sur 78.

### 1.3 Objectif

Mettre en place une batterie de tests **exhaustive et multi-couche** qui garantit :
- Chaque fonctionnalité fonctionne du point de vue d'un opérateur humain
- Les sorties IA sont validées structurellement (pas de data corrompue en DB)
- Les erreurs dégradées sont testées (timeout, rate limit, budget, fichiers corrompus)
- Les régressions visuelles sont détectées automatiquement
- L'accessibilité WCAG 2.1 AA est maintenue (seuil ≥ 90 Lighthouse)

### 1.4 Critères de succès

| Indicateur | Seuil |
|---|---|
| Taux de réussite Vitest | 100% |
| Taux de réussite Playwright | 100% |
| Couverture branches (lib/content-studio + content-studio-v2) | ≥ 80% |
| Couverture statements (idem) | ≥ 85% |
| Score Lighthouse a11y (4 modes) | ≥ 90 |
| Violations axe-core critiques par spec E2E | 0 |
| Temps total CI (unit + E2E) | < 8 min |

---

## 2. Stratégie de test — 4 couches

```
┌──────────────────────────────────────────────────────────┐
│  Couche 4 — Playwright E2E + Visual Regression + axe     │  Opérateur
│  Vrai Chrome · vrai serveur · parcours métier complets   │  humain
├──────────────────────────────────────────────────────────┤
│  Couche 3 — Vitest + RTL + MSW (integration composant)   │  Composant
│  jsdom · handlers MSW · flux client ↔ API mockée         │  dans son
│  Tests des interactions UI réalistes                      │  contexte
├──────────────────────────────────────────────────────────┤
│  Couche 2 — Vitest + MSW (integration service)           │  Service
│  Node · handlers MSW OpenAI · in-memory DB               │  layer
│  Pipeline IA · validation sortie · erreurs dégradées      │
├──────────────────────────────────────────────────────────┤
│  Couche 1 — Vitest unit (fonctions pures)                │  Logique
│  Aucun mock · aucun DOM · aucun réseau                   │  pure
│  Helpers, state machines, parsers, calculs                │
└──────────────────────────────────────────────────────────┘
```

### 2.1 Couche 1 — Vitest unit

**But** : vérifier que chaque fonction pure calcule le bon résultat.
**Environnement** : Node pur, pas de jsdom, pas de MSW.
**Quand** : à chaque commit, < 30s pour le module.

### 2.2 Couche 2 — Vitest integration (service + IA)

**But** : vérifier le pipeline serveur, la validation des sorties IA, les erreurs dégradées.
**Environnement** : Node + MSW (mocks OpenAI) + in-memory DB.
**Quand** : à chaque commit, < 60s pour le module.

### 2.3 Couche 3 — Vitest + RTL + MSW (composants)

**But** : vérifier que les composants React réagissent correctement aux interactions et aux réponses API.
**Environnement** : jsdom + MSW handlers content-studio.
**Quand** : à chaque commit, < 90s.

### 2.4 Couche 4 — Playwright E2E

**But** : vérifier les parcours opérateur complets dans un vrai navigateur.
**Environnement** : Chrome headless · serveur staging (port 8012) · `CONTENT_STUDIO_IMAGE_PROVIDER=mock` + pas de clé OpenAI (fallback templates déterministes).
**Quand** : CI et local, < 120s.
**Bonus intégrés** : `toHaveScreenshot()` (visual regression) + `@axe-core/playwright` (a11y).

---

## 3. Inventaire des fonctionnalités et stratégie de test par fonctionnalité

### 3.1 Mode /home — Dashboard

| ID | Fonctionnalité | Couche 1 | Couche 2 | Couche 3 | Couche 4 |
|---|---|---|---|---|---|
| H-01 | Affichage des 5 KPI (posts semaine, drafts en attente, taux succès jobs, coût IA, top performers) | `computeRecentActivity`, `computeBrandHealth` ✅ existant | — | `HomeClient.test.tsx` render avec snapshot données | E2E: page charge, KPI visibles |
| H-02 | Card "Posts cette semaine" lie vers /plan?range=next7 | — | — | MetricCard href test | E2E: clic → navigation |
| H-03 | Card "Drafts en attente" lie vers /library?status=needs_review | — | — | MetricCard href test | E2E: clic → navigation |
| H-04 | Activity feed affiche les 10 derniers événements | `activity.test.ts` ✅ existant | — | ActivityFeed render test | — |
| H-05 | Brand health affiche le score agrégé | `brand-health.test.ts` ✅ existant | — | BrandHealthCard render test | — |
| H-06 | Account health affiche l'état des comptes sociaux | — | — | AccountHealthCard render test | — |
| H-07 | Skeleton loading pendant le chargement serveur | — | — | — | E2E: navigation → skeleton visible → contenu apparaît |
| H-08 | Page transition (framer-motion fade) | — | — | — | E2E: nav entre modes → pas de flash |

### 3.2 Mode /create — Création de contenu

#### 3.2.1 Intention (formulaire)

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-01 | Sélection format (post/story/reel/carousel) via radio cards | — | — | `IntentionForm.test.tsx`: click radio → aria-checked | E2E: click radio → checked |
| CR-02 | Sélection pilier (8 valeurs) | — | — | IntentionForm: select → value change | E2E: select visible, options 8 |
| CR-03 | Sélection objectif | — | — | IntentionForm: select → value change | — |
| CR-04 | Sélection plateforme (instagram/facebook) | — | — | IntentionForm: select → value change | E2E: click → value change |
| CR-05 | Textarea prompt (8–2000 chars) | — | — | IntentionForm: type < 8 → erreur, type 100 → OK | E2E: type → char counter |
| CR-06 | Soumission → POST /ideas → idée créée | — | Route test: Zod validation, 201 | IntentionForm + MSW: submit → success toast | E2E: submit → stepper avance |
| CR-07 | Validation required fields → erreur inline | — | Route test: 422 si prompt manquant | IntentionForm: submit vide → erreur | — |
| CR-08 | Idempotency-Key header (double submit) | — | Route test: 2x POST même key → même idée | — | — |
| CR-09 | Erreur serveur → toast erreur | — | — | IntentionForm + MSW 500 → toast error | — |

#### 3.2.2 Génération IA (texte)

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-10 | POST /ideas/:id/generate → brief + 3 drafts | `generation.test.ts` (fallback) | Service test: MSW OpenAI → brief+drafts créés | — | E2E: click Générer → 3 cards variantes |
| CR-11 | Fallback templates si clé API absente | `generation.test.ts` ✅ implicite | Service test: env sans clé → fallback | — | E2E: vérifie que ça fonctionne sans clé |
| CR-12 | Validation structurelle sortie JSON OpenAI | **`generation.parse-safety.test.ts`** (NOUVEAU) | — | — | — |
| CR-13 | JSON tronqué → fallback graceful | **`generation.edge-cases.test.ts`** (NOUVEAU) | — | — | — |
| CR-14 | OpenAI rate limit 429 → erreur + budget non consommé | — | **Service test** (NOUVEAU): MSW 429 → HttpError | — | — |
| CR-15 | OpenAI timeout → fallback | — | **Service test** (NOUVEAU): MSW delay 65s → timeout | — | — |
| CR-16 | OpenAI content_filter refusal → fallback | — | **Service test** (NOUVEAU) | — | — |
| CR-17 | Budget daily dépassé → 429 | `budget.test.ts` (NOUVEAU) | Service test: budget check refuse | — | E2E: erreur budget affiché |
| CR-18 | Auto brand review sur chaque draft généré | `brand-rules.test.ts` ✅ existant | Service test: draft avec "miracle" → blocked | — | — |
| CR-19 | State machine idea: → generated | `state-machine.test.ts` ✅ existant | Service test: assertTransition vérifié | — | — |
| CR-20 | Audit event content_studio.idea.generated | — | Service test: vérifie logAuditEvent appelé | — | — |
| CR-21 | Generation run enregistrée (coût, durée) | — | Service test: row inserée | — | — |

#### 3.2.3 Variantes

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-22 | VariantsCompare affiche N variantes côte à côte | — | — | `VariantsCompare.test.tsx` (NOUVEAU): render 3 variantes | E2E: 3 cards visibles |
| CR-23 | Click variante → sélection + CaptionEditor se met à jour | — | — | VariantsCompare: click → onSelect → draft change | E2E: click variant → caption change |
| CR-24 | Score brand affiché par variante | — | — | VariantsCompare: score badge rendered | — |
| CR-25 | POST /drafts/:id/variation → nouveau draft | — | Route test | — | — |

#### 3.2.4 Édition caption

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-26 | Hook field (max 280 chars) | — | — | `CaptionEditor.test.tsx` (NOUVEAU): type 300 → tronqué | E2E: type → counter |
| CR-27 | Caption field (max 2200 chars) | — | — | CaptionEditor: type → counter | E2E: type → counter |
| CR-28 | Autosave debounce 1.5s → PATCH /drafts/:id | `useDraftAutosave` ✅ existant (10 tests) | — | CaptionEditor + MSW: type → wait 2s → PATCH appelé | — |
| CR-29 | Autosave status indicator (idle/saving/saved/error) | `useDraftAutosave` ✅ | — | CaptionEditor: status visible | E2E: type → "Enregistré" apparaît |
| CR-30 | Cmd+S → flush immédiat (palette command) | — | — | CreateWorkspace: Cmd+S → flush() appelé | E2E: Cmd+S → status "Enregistré" |
| CR-31 | Erreur serveur autosave → status error + retry | `useDraftAutosave` ✅ | — | CaptionEditor + MSW 500 → status error | — |
| CR-32 | Auto brand review après chaque save | — | Service test: PATCH draft → review relancée | — | — |

#### 3.2.5 Génération visuelle IA

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-33 | Click "Générer un visuel" → POST /generate-visual | — | Service test ✅ `service.approval.test.ts` | `MediaStudio.test.tsx` (NOUVEAU): click → fetch appelé | E2E: click → image apparaît |
| CR-34 | Estimator progress bar (p50/p95 historique) | `useGenerationEstimator` ✅ (9 tests) | — | MediaStudio: estimator bar visible pendant fetch | — |
| CR-35 | Mock image provider → SVG/PNG Sharp déterministe | `image-generation.test.ts` ✅ (mock path) | — | — | E2E: image aperçu visible (mock) |
| CR-36 | OpenAI images path (b64_json → buffer) | **`image-generation.openai.test.ts`** (NOUVEAU) | Service test + MSW OpenAI images | — | — |
| CR-37 | OpenAI images content_policy_violation → erreur | — | **Service test** (NOUVEAU): MSW refusal | MediaStudio + MSW 422 → toast error | — |
| CR-38 | Budget visual (2/4/8¢ selon qualité) → 429 si dépassé | — | Service test | MediaStudio + MSW 429 → toast budget | — |
| CR-39 | Auto-bind primary asset après génération | — | Service test ✅ `service.approval.test.ts` | — | — |
| CR-40 | Audit event content_studio.visual.generated | — | Service test | — | — |

#### 3.2.6 Upload + crop/trim média

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-41 | Upload image → ImageCropper dialog | — | — | `Uploader.test.tsx` (NOUVEAU): file drop → cropper open | E2E: upload image → crop modal |
| CR-42 | Crop interactif (react-easy-crop) + confirm → POST /upload-and-crop | — | Route test (NOUVEAU): multipart → Sharp → media créé | `ImageCropper.test.tsx` (NOUVEAU) | E2E: crop → confirm → image preview |
| CR-43 | Upload vidéo → VideoTrimmer dialog | — | — | `Uploader.test.tsx`: video drop → trimmer open | E2E: upload video → trim modal |
| CR-44 | Trim interactif + confirm → POST /upload-and-trim | — | Route test (NOUVEAU): multipart → FFmpeg → media créé | `VideoTrimmer.test.tsx` (NOUVEAU) | E2E: trim → confirm → preview |
| CR-45 | Rate limit upload-and-crop (30/min) | — | Route test: 31st request → 429 | — | — |
| CR-46 | Rate limit upload-and-trim (10/min) | — | Route test: 11th request → 429 | — | — |
| CR-47 | Fichier trop gros (>25MB image, >200MB vidéo) | — | Route test: 413 | — | — |
| CR-48 | Type MIME invalide | — | Route test: 400 | — | — |
| CR-49 | Crop schema Zod invalide | — | Route test: 400 | — | — |

#### 3.2.7 Preview

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-50 | PreviewPane change avec la plateforme sélectionnée | — | — | `PreviewPane.test.tsx` (NOUVEAU): platform=instagram → ratio 4:5 | E2E: switch platform → preview ratio change |
| CR-51 | Caption live-preview (frappe caption → preview MAJ) | — | — | PreviewPane: caption prop change → text rendered | E2E: type caption → preview texte MAJ |
| CR-52 | Media preview (image sélectionnée affichée) | — | — | PreviewPane: media prop → img rendered | E2E: upload image → preview image visible |

#### 3.2.8 Publication / Approbation

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-53 | Approve → POST /approve → post créé | — | Service test ✅ `service.approval.test.ts` | `PublishActionGroup.test.tsx` (NOUVEAU): click approve → success | E2E: click Approuver → status change |
| CR-54 | Approve bloqué si brand review = blocked | — | Service test ✅ | PublishActionGroup: bouton disabled + tooltip | — |
| CR-55 | Approve bloqué si pas de primary asset | — | Service test ✅ | PublishActionGroup: bouton disabled | — |
| CR-56 | Publish now → POST /publish-now | — | Route test (NOUVEAU) | PublishActionGroup: confirm dialog → success toast | — |
| CR-57 | Schedule → POST /schedule (datetime picker) | — | Route test (NOUVEAU) | PublishActionGroup: date pick → confirm → success | — |
| CR-58 | Draft on provider → POST /draft-on-provider | — | Route test (NOUVEAU) | PublishActionGroup: confirm → success toast | — |
| CR-59 | Dropdown 3 modes de publication | — | — | PublishActionGroup: dropdown open → 3 items | — |

#### 3.2.9 Stepper

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| CR-60 | Step 1 active par défaut (pas de draft) | `deriveActiveStep` ✅ existant | — | Stepper ✅ existant | — |
| CR-61 | Step 2 active après génération | `deriveActiveStep` ✅ | — | Stepper ✅ | E2E: après generate → step 2 active |
| CR-62 | Steps futurs désactivés (non cliquables) | — | — | Stepper ✅ existant | — |

### 3.3 Mode /library — Bibliothèque

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| LI-01 | Grid de cards avec thumbnail + status badge + caption | — | — | `LibraryClient.test.tsx` ✅ existant (5 tests) | E2E: grid visible |
| LI-02 | Recherche texte debounced → ?q= dans URL | `filters.test.ts` ✅ | — | LibraryClient ✅ | E2E ✅ `library.spec.ts` |
| LI-03 | Filtre status multi-select (popover) | — | — | LibraryFilters: click → checkbox → URL update | E2E: click filtre → items filtrent |
| LI-04 | Filtre plateforme single-select | — | — | — | E2E ✅ `library.spec.ts` |
| LI-05 | Filtre pilier single-select | — | — | — | E2E: click filtre pilier → items filtrent |
| LI-06 | Filtre date range (du / au) | — | — | LibraryFilters: date pick → URL params | — |
| LI-07 | Réinitialiser filtres | — | — | LibraryFilters: click reset → all cleared | — |
| LI-08 | Compteur résultats (X / Y résultats) | — | — | LibraryClient ✅ | — |
| LI-09 | Sélection individuelle (checkbox card) | `selection.test.ts` ✅ | — | LibraryClient ✅ | — |
| LI-10 | Bulk action bar apparaît quand ≥1 sélectionné | — | — | LibraryClient ✅ | E2E: select 2 → bar visible |
| LI-11 | Bulk approve → POST /approve × N (parallel) | — | — | BulkActionBar + MSW: click → N calls → success toast | E2E: select 2 → approve → toasts |
| LI-12 | Bulk archive → confirm dialog → POST /archive × N | — | — | BulkActionBar + MSW: click → dialog → confirm → N calls | E2E: select 2 → archive → dialog → confirm |
| LI-13 | Archive individuelle (optimistic removal, rollback on error) | — | — | LibraryClient + MSW: archive → card disparaît, MSW 500 → card revient | — |
| LI-14 | Duplication draft → POST /variation | — | — | LibraryClient + MSW: duplicate → toast success | — |
| LI-15 | Responsive mobile (2 colonnes min) | — | — | — | E2E viewport 375: grid 2 cols |
| LI-16 | Palette: Approuver/Archiver/Clear sélection (quand ≥1 sélecté) | — | — | — | E2E: Cmd+K → commandes contextuelles visibles |

### 3.4 Mode /plan — Planning calendrier

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| PL-01 | Vue semaine par défaut (7 colonnes) | `calendar-helpers.test.ts` ✅ | — | — | E2E ✅ `plan.spec.ts` |
| PL-02 | Vue mois (grille 7×5/6) | `buildMonthDays` ✅ | — | — | E2E ✅ |
| PL-03 | Vue liste | — | — | — | E2E ✅ |
| PL-04 | Navigation ← → (semaine/mois précédent/suivant) | — | — | Calendar: click → cursor change → re-render | E2E: click → date range change |
| PL-05 | Bouton "Aujourd'hui" | — | — | Calendar: click → cursor = today | E2E: palette → Aller à aujourd'hui |
| PL-06 | Filtre statut (select) | — | — | Calendar: select → URL ?status= | E2E: select → cards filtrent |
| PL-07 | Filtre plateforme (select) | — | — | Calendar: select → URL ?platform= | — |
| PL-08 | Filtre pilier (select) | — | — | Calendar: select → URL ?pillar= | — |
| PL-09 | Calendar cards avec statut + plateforme + thumbnail | — | — | CalendarCard render test | — |
| PL-10 | Double-click card → QuickEditDrawer | — | — | Calendar: dblclick → drawer open | E2E: dblclick card → drawer visible |
| PL-11 | QuickEditDrawer: reschedule → PATCH /reschedule | — | Route test | QuickEditDrawer + MSW: submit → success toast | E2E: change date → save → toast |
| PL-12 | Drag-and-drop card vers un autre jour | `useCalendarDnD.test.ts` ✅ | — | — | E2E: drag card → drop day → PATCH called → card moved |
| PL-13 | DnD reject sur jours passés | `useCalendarDnD.test.ts` ✅ | — | — | E2E: drag → past day → toast error + card revient |
| PL-14 | DnD optimistic update + rollback | `useCalendarDnD.test.ts` ✅ | — | — | — |
| PL-15 | Nombre "+X autres" en vue mois (>3 items) | — | — | MonthGrid: 5 items → "+2 autres" affiché | — |
| PL-16 | JobQueue affiche les jobs queued/publishing/failed | — | — | `JobQueue.test.tsx` ✅ | — |
| PL-17 | JobQueue retry → POST /publish-jobs/:id/retry | — | — | JobQueue ✅ | — |
| PL-18 | JobQueue cancel → POST /publish-jobs/:id/cancel | — | — | JobQueue ✅ | — |
| PL-19 | JobQueue polling 30s | — | — | JobQueue ✅ | — |
| PL-20 | PlanMetrics (KPI tiles read-only) | — | — | PlanMetrics render test | — |
| PL-21 | Palette: Today, Prev, Next, Vue semaine/mois/liste | — | — | — | E2E ✅ `plan.spec.ts` |

### 3.5 Shell commun

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| SH-01 | Sidebar navigation entre 4 modes | — | — | — | E2E ✅ `shell.spec.ts` |
| SH-02 | Sidebar highlight du mode actif (aria-current) | — | — | — | E2E ✅ |
| SH-03 | Topbar breadcrumb reflète la route | — | — | — | E2E ✅ |
| SH-04 | Theme toggle dark/light + persistence | — | — | — | E2E ✅ |
| SH-05 | Palette Cmd+K (ouverture + navigation) | — | — | — | E2E ✅ |
| SH-06 | Lien "Ancien" vers /admin/content-studio-legacy | — | — | — | E2E: click → redirect legacy |
| SH-07 | Skeleton loading sur chaque mode | — | — | — | E2E: nav → skeleton → content |
| SH-08 | Page transition framer-motion | — | — | — | E2E: nav → pas de flash blanc |
| SH-09 | Redirect /admin/content-studio → v2 quand V2_DEFAULT=true | — | — | — | E2E: goto /content-studio → URL = /content-studio-v2/home |
| SH-10 | Rollback via V2_DEFAULT=false → legacy | — | — | — | E2E (optionnel) |

### 3.6 API routes — validation et erreurs

| ID | Fonctionnalité | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| API-01 | Auth requise sur chaque route admin | — | Route test: sans cookie → 401/redirect | — | E2E: incognito → login page |
| API-02 | Feature flag disabled → 403/EmptyState | — | Route test: ENABLED=false → 403 | — | — |
| API-03 | Zod validation sur chaque schéma d'input | — | Route test: body invalide → 422 + détails | — | — |
| API-04 | Idempotency-Key sur POST /ideas | — | Route test: ✅ existant | — | — |
| API-05 | State machine assertTransition sur chaque mutation | `state-machine.test.ts` ✅ | Service test: transition invalide → 422 | — | — |
| API-06 | Daily budget gate (génération texte + image) | `budget.test.ts` (NOUVEAU) | Service test | — | — |

### 3.7 Erreurs dégradées et edge cases

| ID | Scénario | C1 | C2 | C3 | C4 |
|---|---|---|---|---|---|
| ERR-01 | OpenAI chat/completions → 429 rate limit | — | MSW mock → vérifie fallback templates | — | — |
| ERR-02 | OpenAI chat/completions → réponse JSON tronquée | JSON.parse fail | MSW mock → vérifie fallback | — | — |
| ERR-03 | OpenAI chat/completions → JSON valide mais shape incorrecte | Zod parse fail (NOUVEAU) | MSW mock → vérifie fallback | — | — |
| ERR-04 | OpenAI chat/completions → content_filter refusal | — | MSW mock → vérifie fallback | — | — |
| ERR-05 | OpenAI images → content_policy_violation | — | MSW mock → vérifie error propagation | MSW → toast error | — |
| ERR-06 | OpenAI images → 0 bytes response | — | MSW mock → vérifie error | — | — |
| ERR-07 | Upload fichier corrompu (image) | — | Route test: Sharp lance → 422 | — | — |
| ERR-08 | Upload fichier corrompu (vidéo) | — | Route test: FFmpeg lance → 422 | — | — |
| ERR-09 | Budget daily épuisé → génération refusée | — | Service test → HttpError 429 | MSW → toast budget | E2E: erreur budget |
| ERR-10 | Réseau coupé pendant autosave | — | — | MSW network error → status error | — |
| ERR-11 | DnD reschedule → serveur 500 → rollback | — | — | — | E2E: drag → MSW intercept 500 → card revient |
| ERR-12 | Bulk archive → 2/5 échouent → toast mixed | — | — | BulkActionBar + MSW mixed → warning toast | — |
| ERR-13 | Draft approve → brand blocked → erreur | — | Service test ✅ | PublishActionGroup: erreur affichée | — |
| ERR-14 | Draft approve → pas de media → erreur | — | Service test ✅ | PublishActionGroup: erreur affichée | — |

### 3.8 Accessibilité

| ID | Vérification | Couche |
|---|---|---|
| A11Y-01 | axe-core 0 violations critiques par page | Couche 4: chaque spec E2E parcours ajoute `new AxeBuilder({ page }).analyze()` |
| A11Y-02 | Tous les interactive elements ont un accessible name | Couche 4: axe rule `button-name`, `link-name`, `label` |
| A11Y-03 | Color contrast WCAG AA (4.5:1 texte normal) | Couche 4: axe rule `color-contrast` |
| A11Y-04 | Touch targets ≥ 24×24px | Couche 4: axe rule `target-size` |
| A11Y-05 | Focus visible sur tous les interactive elements | Couche 4: tab-through spec |
| A11Y-06 | Keyboard navigation (Tab, Enter, Escape) | Couche 4: chaque spec parcours utilise keyboard |
| A11Y-07 | aria-current="page" sur le nav item actif | Couche 4: ✅ `shell.spec.ts` |

### 3.9 Visual regression

| ID | Baseline screenshot | Couche |
|---|---|---|
| VR-01 | `/home` — dashboard complet | Couche 4: `toHaveScreenshot('home-dashboard.png')` |
| VR-02 | `/create` — intention form vide | Couche 4: `toHaveScreenshot('create-empty.png')` |
| VR-03 | `/create` — après génération (3 variantes + preview) | Couche 4: `toHaveScreenshot('create-with-drafts.png')` |
| VR-04 | `/library` — grid avec cards | Couche 4: `toHaveScreenshot('library-grid.png')` |
| VR-05 | `/plan` — vue semaine | Couche 4: `toHaveScreenshot('plan-week.png')` |
| VR-06 | `/plan` — vue mois | Couche 4: `toHaveScreenshot('plan-month.png')` |
| VR-07 | Theme dark — home | Couche 4: toggle dark → `toHaveScreenshot('home-dark.png')` |
| VR-08 | Mobile 375px — library | Couche 4: viewport 375 → `toHaveScreenshot('library-mobile.png')` |

---

## 4. Fichiers de test à créer — plan de dev

### 4.1 Couche 1 — Vitest unit (NOUVEAU)

| Fichier | Tests | Priorité |
|---|---|---|
| `lib/content-studio/generation.parse-safety.test.ts` | JSON valide shape incorrecte (brief null, drafts string, caption number, hook absent, extra fields). JSON tronqué. Réponse vide. | P0 |
| `lib/content-studio/budget.test.ts` | Budget 0 → illimité. Budget 100 → refuse à 101. Budget calcul multi-runs même jour. Fuseau horaire midnight. | P1 |
| `lib/content-studio/image-generation.openai.test.ts` | Mock fetch réponse b64. content_policy_violation. 0 bytes. Timeout. Cost estimation par modèle. | P1 |
| `lib/content-studio/brand-rules.edge.test.ts` | Terme bloqué en majuscule. Terme dans hashtag. Emoji dans hook seulement. Score 0. | P2 |
| `lib/content-studio-v2/media/upload-image.test.ts` | FormData construction. Content-type multipart. Error response parsing. | P2 |
| `lib/content-studio-v2/media/upload-video.test.ts` | Idem vidéo. | P2 |

**Volume estimé** : ~45 tests

### 4.2 Couche 2 — Vitest integration service (NOUVEAU)

| Fichier | Tests | Priorité |
|---|---|---|
| `lib/content-studio/service.generate.test.ts` | Happy path (MSW OpenAI → brief+drafts). Fallback (no key). Budget refuse. Rate limit 429. Content filter. JSON tronqué. Audit event émis. GenerationRun insérée. | P0 |
| `lib/content-studio/service.visual.test.ts` | Happy path mock. OpenAI path (MSW images). Budget par qualité. content_policy_violation. Auto-bind primary. Audit event. | P0 |
| `app/api/admin/content-studio-v2/media/upload-and-crop/route.test.ts` | Happy path (real Sharp). Zod validation. Rate limit. File too large. Invalid MIME. Invalid crop coords. | P1 |
| `app/api/admin/content-studio-v2/media/upload-and-trim/route.test.ts` | Happy path (FFmpeg if avail, else skip). Zod validation. Rate limit. File too large. Invalid trim range. | P1 |
| `app/api/admin/content-studio/posts/[id]/schedule/route.test.ts` | Happy path. Invalid date. Post not approved. | P1 |
| `app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts` | Happy path. Post not approved. | P1 |
| `app/api/admin/content-studio/posts/[id]/reschedule/route.test.ts` | Happy path. Invalid date. | P2 |

**Volume estimé** : ~80 tests

### 4.3 Couche 3 — Vitest + RTL + MSW composants (NOUVEAU)

#### MSW handlers à ajouter d'abord

| Handler | Fichier | Scénarios |
|---|---|---|
| `POST /drafts/:id/generate-visual` | `content-studio-handlers.ts` | 200 → StudioMediaItem, 429 budget, 500 provider | 
| `POST /v2/media/upload-and-crop` | `content-studio-v2-handlers.ts` (NOUVEAU) | 200 → media, 400 bad crop, 413 too large |
| `POST /v2/media/upload-and-trim` | `content-studio-v2-handlers.ts` (NOUVEAU) | 200 → media, 400 bad range, 413 too long |
| `POST openai.com/v1/images/generations` | `openai-handlers.ts` (enrichir) | 200 → b64_json, content_policy_violation, 429 |
| Contract test: handler shape = route Zod schema | `content-studio-handlers.contract.test.ts` (NOUVEAU) | Chaque handler output parsé par le Zod schema correspondant |

#### Composants

| Fichier | Tests | Priorité |
|---|---|---|
| `IntentionForm.test.tsx` | Render vide. Required fields validation. Submit → success callback. Submit → server 422 → error inline. Submit → server 500 → toast error. Format change callback. Platform change. Disabled state. | P0 |
| `CaptionEditor.test.tsx` | Render avec initial values. Typing → onChange callback. Hook max 280 truncation. Caption counter. Autosave integration (type → wait → PATCH via MSW). Error status shown. | P0 |
| `MediaStudio.test.tsx` | Render items grid. Click "Générer" → fetch called (MSW). Estimator bar visible during fetch. Success → onUploaded called + toast. Error 429 → budget toast. Error 500 → error toast. Disabled when no draftId. | P0 |
| `PreviewPane.test.tsx` | Platform switch → aspect ratio change. Caption prop → text rendered. Media prop → img rendered. Format switch. | P1 |
| `PublishActionGroup.test.tsx` | Disabled when postId null. Dropdown 3 modes. Approve click → confirm dialog. Schedule → datetime input → confirm. Publish now → confirm. Success toast. Error toast. Autosave status display. | P1 |
| `VariantsCompare.test.tsx` | Render N variants. Click → onSelect. Score badge. Loading state. Diff highlight toggle. | P1 |
| `CreateWorkspace.integration.test.tsx` | Full flow: IntentionForm submit (MSW) → drafts appear → select variant → CaptionEditor visible → MediaStudio generate (MSW) → preview updates → approve (MSW). | P0 |
| `Uploader.test.tsx` | File drop image → cropper opens. File drop video → trimmer opens. Invalid file type → rejected. | P1 |
| `ImageCropper.test.tsx` | Render crop UI. Confirm → POST multipart (MSW). Cancel → closes. | P2 |
| `VideoTrimmer.test.tsx` | Render trim UI. Confirm → POST multipart (MSW). Cancel → closes. | P2 |
| `LibraryFilters.test.tsx` | Status multiselect. Platform select. Pillar select. Date range. Reset. | P2 |
| `QuickEditDrawer.test.tsx` | Open with post data. Reschedule → PATCH (MSW). Success toast. Invalid date → inline error. Close. | P2 |
| `HomeClient.test.tsx` | Render all sub-cards with snapshot data. Links point to correct URLs. | P2 |
| `PlanMetrics.test.tsx` | Render with data. Zero-state. | P3 |
| `CalendarCard.test.tsx` | Full variant. Mini variant. Status badge color. Double-click fires callback. | P3 |

**Volume estimé** : ~220 tests

### 4.4 Couche 4 — Playwright E2E (NOUVEAU)

| Fichier | Tests | Priorité |
|---|---|---|
| `e2e/content-studio-v2/create-image-post.spec.ts` | Parcours opérateur complet : format post → pilier rituel → prompt → Générer → 3 variantes → select variant → edit caption → generate visual (mock) → preview visible → approve. + axe-core. + screenshot baseline. | P0 |
| `e2e/content-studio-v2/create-error-recovery.spec.ts` | Génération avec budget épuisé (page.route intercept 429) → toast budget → peut réessayer. Generation visual fail → toast error → peut réessayer. Autosave fail → status error visible. | P0 |
| `e2e/content-studio-v2/library-bulk-actions.spec.ts` | Sélectionner 3 cards → bulk bar visible → approve → toasts → cards status MAJ. Sélectionner 2 → archive → confirm dialog → toasts. Clear selection → bar disparaît. | P1 |
| `e2e/content-studio-v2/library-filters-search.spec.ts` | Search debounced → URL ?q=. Filtre status → items filtrent. Filtre plateforme. Reset. Compteur résultats cohérent. | P1 |
| `e2e/content-studio-v2/plan-calendar-navigation.spec.ts` | Vue semaine default. Switch mois → ?view=month. Switch liste. Prev/next. Today. Filtre statut. Filtre plateforme. | P1 |
| `e2e/content-studio-v2/plan-quick-edit.spec.ts` | Double-click card → drawer. Reschedule → save → toast. Close. | P1 |
| `e2e/content-studio-v2/plan-drag-drop.spec.ts` | Drag card → future day → card moved. Drag → past day → toast error + rollback. Drag → save (page.route intercept → 500) → rollback. | P1 |
| `e2e/content-studio-v2/home-dashboard.spec.ts` | Page charge. 5 KPI tiles visibles. Activity feed. Links fonctionnels (posts this week → /plan, drafts → /library). + axe-core. | P2 |
| `e2e/content-studio-v2/upload-crop-image.spec.ts` | Upload image via file chooser → crop modal → adjust → confirm → image dans mediapicker. | P2 |
| `e2e/content-studio-v2/upload-trim-video.spec.ts` | Upload vidéo → trim modal → adjust range → confirm → vidéo dans mediapicker. | P2 |
| `e2e/content-studio-v2/keyboard-navigation.spec.ts` | Tab through tous les interactive elements. Enter active les boutons. Escape ferme les modals. Cmd+K ouvre palette. Cmd+S save. | P2 |
| `e2e/content-studio-v2/theme-persistence.spec.ts` | Toggle dark → reload → dark persisté. Toggle light → reload → light persisté. | P2 |
| `e2e/content-studio-v2/responsive-mobile.spec.ts` | Viewport 375×812. Library grid 2 cols. Create layout stacked. Plan calendar scrollable. | P2 |
| `e2e/content-studio-v2/responsive-tablet.spec.ts` | Viewport 768×1024. Layout intermédiaire. | P3 |
| `e2e/content-studio-v2/visual-regression.spec.ts` | Screenshot baselines : home, create empty, create with drafts, library, plan week, plan month, dark mode, mobile 375. | P2 |
| `e2e/content-studio-v2/a11y-audit.spec.ts` | axe-core sur les 4 modes. 0 violations critical/serious. | P1 |
| `e2e/content-studio-v2/redirect-substitution.spec.ts` | /admin/content-studio → redirect v2/home (V2_DEFAULT=true). /admin/content-studio-legacy → legacy accessible. | P2 |

**Volume estimé** : ~130 tests

---

## 5. Plan de données de test

### 5.1 Stratégie

| Couche | Données |
|---|---|
| Vitest unit | Inline + factories existantes |
| Vitest integration | In-memory DB + `resetMemoryStore()` + factories `content-studio.ts` |
| Vitest RTL+MSW | MSW stateful handlers (état interne réinitialisé par test) |
| Playwright E2E | Base staging réelle (drafts/posts existants) + fallback generation (templates déterministes) |

### 5.2 Factories à ajouter

| Factory | Fichier | Champs |
|---|---|---|
| `buildContentIdea(overrides?)` | ✅ existant `test/factories/content-studio.ts` | — |
| `buildContentDraft(overrides?)` | ✅ existant | — |
| `buildContentPost(overrides?)` | ✅ existant | — |
| `buildContentBrief(overrides?)` | ✅ existant | — |
| `buildStudioMediaItem(overrides?)` | NOUVEAU | id, mediaId, kind, status, previewUrl, thumbUrl, originalUrl, alt, width, height, crop |
| `buildLibraryItem(overrides?)` | NOUVEAU | id, draftId, postId, status, caption, platform, format, pillar, thumbnail, createdAt |
| `buildPublishJobRow(overrides?)` | NOUVEAU | id, postId, status, scheduledAt, platform, format, provider, attemptCount, lastError |
| `buildGenerationRunResult(overrides?)` | NOUVEAU | brief (avec angle, proof, cta), drafts[] (avec caption, hook, format, platform, hashtags) |
| `buildOpenAIChatResponse(content)` | NOUVEAU | Wrapper `{ choices: [{ message: { content } }] }` shape |
| `buildOpenAIImageResponse(b64)` | NOUVEAU | Wrapper `{ data: [{ b64_json }] }` shape |

### 5.3 Contract testing MSW ↔ routes

Fichier : `src/test/msw/content-studio-handlers.contract.test.ts`

Pour chaque handler MSW qui retourne un objet `{ idea }`, `{ draft }`, `{ post }`, etc., importer le Zod schema de la route correspondante et `.parse()` la sortie du handler. Objectif : détecter les divergences type `status: 'brief'` vs `'generated'`.

---

## 6. Plan d'action détaillé

### Phase 0 — Infrastructure (1 jour)

| # | Tâche | Livrable | Tests verts avant/après |
|---|---|---|---|
| 0.1 | Ajouter Zod schema sur `JSON.parse()` dans `generation.ts` | Code fix | Existants passent |
| 0.2 | Créer les 4 factories manquantes | `test/factories/content-studio.ts` enrichi | — |
| 0.3 | Créer `content-studio-v2-handlers.ts` (upload-crop, upload-trim, generate-visual) | MSW handlers + tests | Handlers tests verts |
| 0.4 | Enrichir `openai-handlers.ts` avec image generation mock | MSW handler + test | Handler test vert |
| 0.5 | Contract test MSW ↔ routes | `handlers.contract.test.ts` | Contract tests verts |
| 0.6 | Fix MSW `status: 'brief'` → `'generated'` | Handler fix | Contract test vert |

### Phase 1 — Couche 1 : unit (1 jour)

| # | Tâche | Livrable | Volume |
|---|---|---|---|
| 1.1 | `generation.parse-safety.test.ts` | 10 tests (shapes invalides) | — |
| 1.2 | `generation.edge-cases.test.ts` | 8 tests (tronqué, vide, refusal) | — |
| 1.3 | `budget.test.ts` | 8 tests (limites, midnight, illimité) | — |
| 1.4 | `image-generation.openai.test.ts` | 6 tests (b64, policy, bytes, cost) | — |
| 1.5 | `brand-rules.edge.test.ts` | 6 tests (majuscule, hashtag, emoji, score) | — |
| 1.6 | `upload-image.test.ts` + `upload-video.test.ts` | 6 tests chacun | — |
| **Total Phase 1** | | **~44 tests** | |

### Phase 2 — Couche 2 : integration service (2 jours)

| # | Tâche | Livrable | Volume |
|---|---|---|---|
| 2.1 | `service.generate.test.ts` | 12 tests (happy, fallback, budget, rate limit, filter, truncated, audit, run) | — |
| 2.2 | `service.visual.test.ts` | 10 tests (mock, openai, budget×3, policy, bind, audit) | — |
| 2.3 | `upload-and-crop/route.test.ts` | 8 tests (happy, zod, rate, mime, size, coords) | — |
| 2.4 | `upload-and-trim/route.test.ts` | 8 tests (happy, zod, rate, size, range) | — |
| 2.5 | `posts/schedule/route.test.ts` | 5 tests (happy, invalid date, not approved) | — |
| 2.6 | `posts/publish-now/route.test.ts` | 4 tests (happy, not approved) | — |
| 2.7 | `posts/reschedule/route.test.ts` | 4 tests (happy, invalid date, not scheduled) | — |
| **Total Phase 2** | | **~51 tests** | |

### Phase 3 — Couche 3 : composants RTL+MSW (3 jours)

| # | Tâche | Volume |
|---|---|---|
| 3.1 | `IntentionForm.test.tsx` | 9 tests |
| 3.2 | `CaptionEditor.test.tsx` | 8 tests |
| 3.3 | `MediaStudio.test.tsx` | 8 tests |
| 3.4 | `CreateWorkspace.integration.test.tsx` | 5 tests (flux complet) |
| 3.5 | `PreviewPane.test.tsx` | 5 tests |
| 3.6 | `PublishActionGroup.test.tsx` | 8 tests |
| 3.7 | `VariantsCompare.test.tsx` | 5 tests |
| 3.8 | `Uploader.test.tsx` | 4 tests |
| 3.9 | `ImageCropper.test.tsx` | 3 tests |
| 3.10 | `VideoTrimmer.test.tsx` | 3 tests |
| 3.11 | `LibraryFilters.test.tsx` | 6 tests |
| 3.12 | `QuickEditDrawer.test.tsx` | 5 tests |
| 3.13 | `HomeClient.test.tsx` | 4 tests |
| 3.14 | `CalendarCard.test.tsx` | 4 tests |
| 3.15 | `PlanMetrics.test.tsx` | 3 tests |
| **Total Phase 3** | **~80 tests** |

### Phase 4 — Couche 4 : Playwright E2E (3 jours)

| # | Tâche | Volume | Prio |
|---|---|---|---|
| 4.1 | `create-image-post.spec.ts` — parcours doré complet | 8 tests | P0 |
| 4.2 | `create-error-recovery.spec.ts` | 6 tests | P0 |
| 4.3 | `a11y-audit.spec.ts` — axe-core × 4 modes | 4 tests | P1 |
| 4.4 | `library-bulk-actions.spec.ts` | 6 tests | P1 |
| 4.5 | `library-filters-search.spec.ts` | 6 tests | P1 |
| 4.6 | `plan-calendar-navigation.spec.ts` | 8 tests | P1 |
| 4.7 | `plan-quick-edit.spec.ts` | 4 tests | P1 |
| 4.8 | `plan-drag-drop.spec.ts` | 4 tests | P1 |
| 4.9 | `home-dashboard.spec.ts` | 5 tests | P2 |
| 4.10 | `upload-crop-image.spec.ts` | 4 tests | P2 |
| 4.11 | `upload-trim-video.spec.ts` | 3 tests | P2 |
| 4.12 | `keyboard-navigation.spec.ts` | 6 tests | P2 |
| 4.13 | `responsive-mobile.spec.ts` | 5 tests | P2 |
| 4.14 | `visual-regression.spec.ts` | 8 tests (screenshots baseline) | P2 |
| 4.15 | `redirect-substitution.spec.ts` | 3 tests | P2 |
| 4.16 | `responsive-tablet.spec.ts` | 4 tests | P3 |
| **Total Phase 4** | **~84 tests** |

### Phase 5 — CI et documentation (0.5 jour)

| # | Tâche |
|---|---|
| 5.1 | Mettre à jour `.github/workflows/ci.yml` : ajouter TOUS les specs E2E au job `e2e` (pas juste `content-studio.spec.ts`) |
| 5.2 | Ajouter `test:coverage` au CI avec seuils 80% branches / 85% statements sur `lib/content-studio*` |
| 5.3 | Ajouter screenshots baselines au git (LFS si > 10MB) |
| 5.4 | Documenter la commande de lancement locale dans le README du module |

---

## 7. Environnement de test

### 7.1 Vitest

```bash
# Unit + integration + composants
cd /var/www/femiglow-staging/apps/web
npx vitest run src/lib/content-studio src/lib/content-studio-v2 \
  src/components/admin/content-studio-v2 \
  src/app/api/admin/content-studio-v2 \
  src/test/msw/content-studio

# Avec coverage
npx vitest run --coverage --coverage.include='src/lib/content-studio/**,src/lib/content-studio-v2/**'
```

### 7.2 Playwright

```bash
# Prérequis : serveur staging actif sur 8012
systemctl is-active femiglow-staging.service

# Tous les specs v2
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/

# Un seul spec
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/create-image-post.spec.ts

# Avec UI mode (debug)
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test --ui
```

### 7.3 Variables d'environnement requises

| Variable | Vitest | Playwright | Valeur test |
|---|---|---|---|
| `CONTENT_STUDIO_ENABLED` | `true` | `true` (via .env) | — |
| `CONTENT_STUDIO_V2_ENABLED` | `true` | `true` (via .env) | — |
| `CONTENT_STUDIO_V2_DEFAULT` | — | `true` (via .env) | — |
| `CONTENT_STUDIO_IMAGE_PROVIDER` | `mock` | `mock` (via .env) | Utilise Sharp, pas OpenAI |
| `CONTENT_STUDIO_OPENAI_API_KEY` | absent | absent | Force fallback templates |
| `DATABASE_URL` | absent (in-memory) | réelle (staging) | — |
| `ADMIN_BOOTSTRAP_EMAIL` | — | via .env | Login E2E |
| `ADMIN_BOOTSTRAP_PASSWORD` | — | via .env | Login E2E |

---

## 8. Runbook d'exécution

### Étape 1 — Préparation (15 min)

```bash
# 1. Vérifier que le serveur staging tourne
systemctl is-active femiglow-staging.service
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8012/admin/login
# Attendu : 200

# 2. Vérifier les variables d'environnement
grep CONTENT_STUDIO /var/www/femiglow-staging/apps/web/.env
# Attendu : ENABLED=true, V2_ENABLED=true, V2_DEFAULT=true, IMAGE_PROVIDER=mock

# 3. Vérifier que la session Playwright est fonctionnelle
cd /var/www/femiglow-staging/apps/web
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test --project=setup
# Attendu : 1 passed

# 4. Vérifier que Vitest tourne
npx vitest run src/lib/content-studio/state-machine.test.ts --reporter=verbose
# Attendu : tests pass
```

### Étape 2 — Phase 0 : Infrastructure

```bash
# 2a. Appliquer le Zod schema sur generation.ts JSON.parse
# (commit indépendant pour isoler le changement)

# 2b. Créer les factories + handlers MSW
# Vérifier :
npx vitest run src/test/msw/content-studio --reporter=verbose
npx vitest run src/test/msw/content-studio-v2 --reporter=verbose
# Attendu : tous verts, contract tests inclus

# 2c. Commit
git add -A && git commit -m "test(content-studio): Phase 0 — infra (factories, MSW handlers, contract tests)"
```

### Étape 3 — Phase 1 : Unit tests

```bash
# Créer les fichiers listés en §4.1
# Vérifier :
npx vitest run src/lib/content-studio/generation.parse-safety.test.ts \
  src/lib/content-studio/generation.edge-cases.test.ts \
  src/lib/content-studio/budget.test.ts \
  src/lib/content-studio/image-generation.openai.test.ts \
  --reporter=verbose
# Attendu : ~44 tests, tous verts

git commit -m "test(content-studio): Phase 1 — unit tests generation, budget, image, brand-rules"
```

### Étape 4 — Phase 2 : Integration service

```bash
# Créer les fichiers listés en §4.2
# Vérifier :
npx vitest run src/lib/content-studio/service.generate.test.ts \
  src/lib/content-studio/service.visual.test.ts \
  src/app/api/admin/content-studio-v2 \
  src/app/api/admin/content-studio/posts \
  --reporter=verbose
# Attendu : ~51 tests, tous verts

git commit -m "test(content-studio): Phase 2 — integration tests service + routes"
```

### Étape 5 — Phase 3 : Composants RTL+MSW

```bash
# Créer les fichiers listés en §4.3
# Vérifier :
npx vitest run src/components/admin/content-studio-v2 --reporter=verbose
# Attendu : ~80 tests (existants + nouveaux), tous verts

git commit -m "test(content-studio-v2): Phase 3 — component tests RTL+MSW"
```

### Étape 6 — Phase 4 : Playwright E2E

```bash
# Créer les fichiers listés en §4.4
# Build pour intégrer les derniers changements
npm run build && chown -R nodeapp:nodeapp .next && systemctl restart femiglow-staging.service
sleep 3

# Vérifier :
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ --reporter=list
# Attendu : ~84+ tests (existants 14 + nouveaux ~84), tous verts

# Si des screenshots baseline sont créés :
npx playwright test --update-snapshots e2e/content-studio-v2/visual-regression.spec.ts
git add e2e/content-studio-v2/*.spec.ts-snapshots/

git commit -m "test(content-studio-v2): Phase 4 — E2E parcours opérateur + visual regression + a11y"
```

### Étape 7 — Phase 5 : CI

```bash
# Mettre à jour ci.yml
# Vérifier en local que le job complet tourne :
npx vitest run --reporter=verbose
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test --reporter=list

git commit -m "ci: run all E2E specs + coverage thresholds on content-studio"
```

### Étape 8 — Validation finale

```bash
# 1. Suite complète Vitest
npx vitest run --reporter=verbose 2>&1 | tail -5
# Attendu : X tests passed, 0 failed

# 2. Suite complète Playwright
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test 2>&1 | tail -10
# Attendu : X tests passed, 0 failed

# 3. Coverage
npx vitest run --coverage 2>&1 | grep -E "content-studio|Stmts|Branch"
# Attendu : Stmts ≥ 85%, Branch ≥ 80%

# 4. Rapport Playwright HTML
npx playwright show-report
```

---

## 9. Comptage prévisionnel

| Couche | Tests existants | Tests à créer | Total |
|---|---|---|---|
| Vitest unit (C1) | ~30 | ~45 | ~75 |
| Vitest integration (C2) | ~6 | ~51 | ~57 |
| Vitest RTL+MSW (C3) | ~45 | ~80 | ~125 |
| Playwright E2E (C4) | 14 | ~84 | ~98 |
| MSW contract tests | 0 | ~15 | ~15 |
| **Total** | **~95** | **~275** | **~370** |

Après exécution des 5 phases, le module Content Studio v2 disposera de **~370 tests** couvrant les 4 couches, les 12 étapes du parcours opérateur, les erreurs dégradées de l'IA, la visual regression sur 8 baselines, et l'accessibilité automatisée sur les 4 modes.

---

## 10. Glossaire

| Terme | Définition |
|---|---|
| **Parcours opérateur** | Séquence d'actions qu'un admin FemiGlow exécute pour accomplir un objectif métier (ex: créer un post image) |
| **Fallback templates** | Textes déterministes générés quand la clé OpenAI est absente ou que l'appel IA échoue |
| **Contract test** | Test qui vérifie qu'un mock (MSW handler) retourne la même structure que le code réel (route handler) |
| **Visual regression** | Comparaison pixel-par-pixel de screenshots entre le baseline et le rendu actuel |
| **axe-core** | Moteur d'analyse d'accessibilité automatisée (WCAG 2.1 AA) |
| **Daily budget** | Seuil de dépense IA quotidienne (en centimes) au-delà duquel les générations sont refusées |
| **Primary asset** | Média (image/vidéo) lié à un draft comme visuel principal — requis pour l'approbation |
| **State machine** | Automate à états qui gouverne les transitions de statut (idea/draft/post) |
