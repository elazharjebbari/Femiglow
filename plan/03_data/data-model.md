# Modèle de données — Pipeline génération + publication

> FemiGlow Content Studio v2 / AI Engine. Cible ADR-0007 Option 1 (LangGraph moteur unique).
> Source de vérité du schéma : `apps/web/src/lib/db/schema.ts`, `schema-content-studio.ts`, `schema-social-publishing.ts`, `schema-ai-engine.ts`.
> Ce document **décrit l'existant + l'état cible** (entités, relations, états, invariants). Aucune modification de code.

---

## 1. Vue d'ensemble des entités

### 1.1 Génération (deux moteurs aujourd'hui — convergence vers A)

| Table (réelle) | Rôle | Moteur |
|---|---|---|
| `ai_engine_generation_job` | Job LangGraph riche (script→images/vidéo→voix-off→musique→sous-titres→compose→export), `state_snapshot`, `result_assets`, `cost_breakdown`, `quality_scores`, `moderation_ok`, `human_review_decision` | **A** (cible : moteur unique) |
| `content_generation_run` | Run de génération du flux create (image/texte opérateur) ; `provider`, `model`, `prompt_version`, `input_json`, `output_json`, `cost_cents` | **B** (devient UI au-dessus de A) |
| `media`, `media_variants`, `media_jobs`, `media_usages` | Assets matérialisés (image/video/audio), variantes, jobs de transformation, usages | partagé |

### 1.2 Contenu éditorial (B)

`content_campaign → content_idea → content_brief → content_draft → content_post`, plus `content_asset_binding` (draft↔media), `content_brand_review`, `content_idempotency_key`, `content_postiz_delivery` (chemin legacy Postiz), `content_performance_snapshot`, `content_learning_note`.

### 1.3 Publication sociale (lifecycle de job)

| Table (réelle) | Rôle |
|---|---|
| `social_account` | Compte cible (provider `dry_run|meta_graph|postiz`, platform `instagram|facebook`, capabilities) |
| `social_credential` | Secret/scopes du compte |
| `social_publish_job` | **Cœur du lifecycle** : statut, `idempotency_key` (unique), `scheduled_at`, `locked_at`, `attempt_count`, `last_error_json` |
| `social_publish_attempt` | Une tentative d'envoi (request/response/error/durée) |
| `social_publication` | Résultat publié (unique par job ; `remote_id`, `permalink`) |
| `social_publish_event` | Journal d'évènements du job (type, message, métadonnées) — heartbeat scheduler ici |

### 1.4 Audit & infra

| Table (réelle) | Rôle | Note |
|---|---|---|
| **`audit_events`** (pluriel) | Journal d'audit applicatif (`action`, `actor_id`, `resource_type`, `resource_id`, `meta`) | **Nom RÉEL pluriel** — `schema.ts:268`. Les E2E qui requêtent `audit_event` (singulier) cassent (BUG-023/042/064). |

---

## 2. Relations (clés étrangères réelles)

```
content_idea ──1:N──> content_brief ──1:N──> content_draft ──1:1*──> content_post
                                                      │
                                                      └──content_asset_binding──> media
content_post ──1:N──> social_publish_job ──1:N──> social_publish_attempt
                              │                └──1:1──> social_publication (unique par job)
                              └──1:N──> social_publish_event
social_publish_job ──N:1──> social_account ──1:N──> social_credential
content_generation_run ──N:1(nullable)──> content_idea / content_brief
ai_engine_generation_job ──N:1(nullable)──> content_idea / ai_engine_workflow_config
```

ON DELETE observés : `social_publish_job.post_id` → CASCADE depuis `content_post` ; `social_publish_job.account_id` → RESTRICT ; `social_publication.job_id` → CASCADE ; `social_publication` a `social_publication_job_unique` (1 publication par job) et `social_publication_provider_remote_unique`.

---

## 3. Machine à états — `social_publish_job` (existante, `state-machine.ts`)

```
draft ──────> approved ──────> queued ──────> publishing ──────> published (terminal)
  │               │              │   │             │
  └──> cancelled  └──> cancelled │   └──> failed ──┴──> failed
                                 └──> cancelled        │
                                                       └──> queued (retry) / cancelled
```

Transitions autorisées (`ALLOWED_TRANSITIONS`) :
- `draft → approved | cancelled`
- `approved → queued | cancelled`
- `queued → publishing | cancelled | failed`
- `publishing → published | failed`
- `published → ∅` (terminal)
- `failed → queued | cancelled`
- `cancelled → ∅` (terminal)

Terminaux : `published`, `cancelled`. Non-terminaux (= « actif/en attente ») : `draft`, `approved`, `queued`, `publishing`, `failed`.

> **Conséquence clé pour les garde-fous** : `queued → cancelled` est **autorisé** → la propagation d'annulation (ACT-DA-004) est viable sans changer la machine à états.

---

## 4. Invariants cibles (conçus par DATA)

### INV-1 — Idempotence stable (ACT-DA-003, MISS-006)

**Problème actuel** : `defaultIdempotencyKey(postId, accountId, suffix)` (`admin-service.ts:653`) injecte un suffixe variable :
- publish-now → `:now`
- schedule → `:<scheduledAt.toISOString()>`

→ deux chemins produisent des `idempotency_key` **disjointes**. L'`uniqueIndex social_publish_job_idempotency_unique` ne dédup donc PAS le « même post publié maintenant ET programmé ». Dès le scheduler branché : **double publication** sur le réseau client.

**Invariant cible** :
- Clé canonique = `content-studio:{postId}:{accountId}` (sans suffixe temporel ni mode).
- **Au plus UN** `social_publish_job` non-terminal (`status ∈ {queued, publishing}`) par couple `(post_id, account_id)`.
- Garanti structurellement par un **index unique partiel** :
  `social_publish_job_active_unique` sur `(post_id, account_id)` WHERE `status IN ('queued','publishing')`.
- `reschedule` **mute** `scheduled_at` du job existant ; `publish-now` **réutilise/annule** le job `queued` préexistant avant exécution.

### INV-2 — Cohérence d'état transverse (ACT-DA-004, BUG-038)

**Problème actuel** : `cancelScheduledPost` / `reschedulePost` (`service.ts:568,603`) modifient **uniquement** `content_post`. Le `social_publish_job` reste orphelin `queued` avec l'ancien `scheduled_at`.

**Invariant cible** :
- `content_post.status = cancelled` ⇒ **∀** `social_publish_job` du post avec `status ∈ {queued, approved, draft}` → `cancelled` (transition légale).
- `content_post.scheduled_at = T` (reschedule) ⇒ le job `queued` du post a `scheduled_at = T` (mutation en place, pas de 2e job — cohérent avec INV-1).
- Propagation **transactionnelle** (même transaction que la mutation `content_post`).
- Garde-fou structurel optionnel (ADR-0009) : check applicatif transactionnel (préféré au trigger pour rester dans Drizzle/testable).

### INV-3 — Vérité du schéma de test (ACT-DA-001/002, BUG-023/042/064)

- Le nom de table consommé par un test **dérive du schéma Drizzle** (source unique), jamais d'un littéral.
- La table d'audit est **`audit_events`** (pluriel). `to_regclass('public.audit_event')` doit rester NULL (signal qu'un test au singulier est faux).
- Les E2E DB tournent contre une base **migrée au schéma réel** ; pré-vol `to_regclass(...)` non null sur l'inventaire de tables.
- Le signal de test est une **donnée** : sa vérité = `exit code` (cf. INV-5).

### INV-4 — Traçabilité de génération (ACT-DA-005, BUG-056)

- Tout `content_generation_run` porte le **modèle intentionnel** (choisi par l'opérateur) en plus du **modèle exécuté**. En mock, `intended_model ≠ model` (`mock-*`) et `estimated_cost_cents` reflète le coût du modèle intentionnel (simulation).
- Réalisation : colonne additive `intended_model` (+ `estimated_cost_cents`) OU `input_json.intendedModel` (ADR-0008/0011 tranche). Migration **réversible**.

### INV-5 — Vérité de l'instrument de mesure (ACT-DA-008, BUG-032)

- Un rapport de tests « tout vert » ⇔ `exit 0`. Aucune promesse de polling provider ne reste pendante (drain complet des fake-timers).
- Le gate CI lit le **code de sortie**, pas la ligne « N passed ».

### INV-6 — Isolation du stockage & caches (ACT-DA-007, MISS-030)

- Racine média = chemin **absolu** dérivé de `MEDIA_LOCAL_DIR`/`MEDIA_DIR`, indépendant du `process.cwd()` (aujourd'hui `generate-voiceover.ts:13`, `transcode-export.ts:15` sont cwd-relatifs).
- En test : racine = **tmpdir dédié** + **DB de test isolée** ; **zéro** row `media` / fichier hors tmpdir ne touche la prod.
- Caches `resolvedKeyCache` / `modelCache` (`api-key-manager.ts:255-294`, TTL 5min) : invalidés sur **changement env**, pas seulement sur save/delete DB. Test « clé changée pendant la fenêtre TTL ».

### INV-7 — Registre de modèles & résolution de credentials unifiée (ACT-DA-006, BUG-028/MISS-003)

- **Registre de modèles** (donnée de référence) : par id → `{ provider, role, routable, keyRef }`. Le picker ne propose **que** `routable=true`. Un id non routable ⇒ erreur métier explicite (pas de fallback OpenAI silencieux → 409 — `image-generation.ts:31-39`).
- **Résolution de credentials unique** : `resolveProviderCredential(keyRef)` → DB chiffrée puis ENV_KEY_MAP, **partagée par A, B et le picker**. Une clé stockée en DB (via AI-Engine `saveApiKey`) doit être **lisible** par le flux create (aujourd'hui invisible — MISS-003).

---

## 5. Couverture des findings assignés

| Id | Entité(s) / invariant(s) | Action |
|---|---|---|
| BUG-023 | `audit_events` / INV-3 | ACT-DA-001/002 |
| BUG-042 | `audit_events` / INV-3 | ACT-DA-001/002 |
| BUG-064 | `audit_events` / INV-3 (teardown) | ACT-DA-001/002 |
| BUG-038 | `social_publish_job`, `content_post` / INV-2 | ACT-DA-004 |
| MISS-006 | `social_publish_job.idempotency_key` / INV-1 | ACT-DA-003 |
| BUG-028 | registre de modèles / INV-7 | ACT-DA-006 |
| MISS-003 | référentiel credentials / INV-7 | ACT-DA-006 |
| BUG-056 | `content_generation_run` / INV-4 | ACT-DA-005 |
| MISS-030 | `media` storage + caches / INV-6 | ACT-DA-007 |
| BUG-032 | instrument de test / INV-5 | ACT-DA-008 |
