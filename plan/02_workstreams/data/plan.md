# Workstream DATA — Plan d'action

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Cible d'architecture : **ADR-0007 Option 1 — converger vers A (LangGraph = moteur unique)**
> Statut : **plan de conception** (aucune modification de code applicatif ; sortie = documents).
> Baseline figée : `docs/audit-generation-publication-2026-05-29/`.
> Préfixe d'actions : **ACT-DA-###**.

---

## 0. Périmètre du workstream DATA

Ce workstream est propriétaire du **modèle de données, de la cohérence des états et de la vérité du schéma** sous-jacents au pipeline. Il **conçoit** (ne code pas) :

- Le **modèle d'entités** des tables de publication (`social_publish_job`, `social_publish_attempt`, `social_publication`, `social_publish_event`), de génération (`content_generation_run`, `ai_engine_generation_job`), de média (`media`, `media_variants`, …) et d'audit (`audit_events` — **nom réel pluriel**).
- Les **invariants d'état** et machines à états (qui garantissent qu'on ne publie pas deux fois, qu'on ne publie pas un post annulé, que les états restent cohérents `content_post ↔ social_publish_job`).
- La **clé d'idempotence** comme objet de données (forme, unicité, cycle de vie) — racine de l'anti-doublon (MISS-006).
- La **vérité du nom de table** utilisée par les harnais E2E (`audit_events`) et l'**isolation du stockage** (DB de test, tmpdir média) pour empêcher la pollution du média de prod par les tests (MISS-030).
- La **traçabilité de génération** (modèle réellement utilisé persisté dans le run, y compris en mock — BUG-056).

> **Frontière avec BACKEND** : le workstream backend (ACT-BE-021/022, ACT-BE-002, ACT-BE-013/014) **implémente** le code (routes, services, workers, env.ts). DATA **conçoit le contrat de données** que ce code doit respecter : invariants, migrations Drizzle, formes de clé, machines à états. Le backend cite explicitement une dépendance `ACT-DATA-SYNC-JOB` (cf. `02_workstreams/backend/tasks.csv:ACT-BE-021`) → **c'est ACT-DA-004** ci-dessous (modèle de sync d'état). DATA fournit l'**ADR + le data-model + le migration-plan** ; BACKEND consomme.

---

## 1. État cible (aligné convergence A)

Dans la cible « LangGraph moteur unique », le modèle de données doit supporter **un pont bidirectionnel et idempotent** entre A (`ai_engine_generation_job`, riche) et B (`content_*`, opérateur), et une **publication asynchrone fiable** sans risque de double-post sur de vrais comptes Instagram clients.

Quatre exigences-données structurent la cible :

1. **Idempotence stable dans le temps** — la clé d'idempotence d'un post+compte doit être **invariante au `scheduledAt`** : reprogrammer ou publier-maintenant ne doit jamais créer un *second* job exécutable. C'est le garde-fou de données du blocker scheduler (BUG-003), prérequis non négociable de l'activation live (MISS-006).
2. **Cohérence d'état transverse** — toute transition de `content_post` (cancel, reschedule, publish-now) doit **propager** l'effet aux `social_publish_job` liés (orphelins interdits). C'est la prévention de désync (BUG-038).
3. **Vérité du schéma vérifiable par les tests** — le harnais E2E doit cibler le **nom de table réel** (`audit_events`), tourner contre une **DB de test au schéma Drizzle réel**, et un nom de table faux doit devenir **rouge immédiatement** (BUG-023, BUG-042, BUG-064).
4. **Isolation du stockage & traçabilité** — les tests ne doivent **jamais** polluer le média/DB de prod (tmpdir + DB de test dédiée, caches invalidables), et chaque `generation_run` doit porter le **modèle intentionnel** réellement choisi, même en mock, pour audit/coût (BUG-056, MISS-030, MISS-003 côté traçabilité de résolution de clé).

> DATA ne ré-ouvre pas le débat architecture (acté). Il garantit que le **socle de données** ne sera pas le maillon qui transforme un blocker inerte en incident client, et que les **tests disent la vérité** sur le réel.

---

## 2. Diagnostic data des 10 findings assignés

| Id | Sév | Domaine | Essence (vérifié sur le réel) |
|---|---|---|---|
| **BUG-023** | major | create-ui-flow | E2E publish-draft requête `audit_event` (singulier) ; table réelle = `audit_events` (pluriel, `schema.ts:268`). `to_regclass('audit_event')=NULL`. Le parcours publish-draft n'a **pas** d'E2E vert. |
| **BUG-042** | major | test-mock-infra | Même cause : noms de table en dur faux (`spec L207, L227`). Le test n'a **jamais** pu passer contre la vraie DB → signal CI mort. |
| **BUG-064** | minor | publication-postiz | Conséquence : l'échec est un **crash de teardown** (cleanupSeed L227), pas un bug produit. Le rapport rouge masque que le chemin dry_run **fonctionne**. |
| **BUG-038** | major | publication-postiz | `cancelScheduledPost`/`reschedulePost` (`service.ts:568,603`) n'opèrent QUE sur `content_post` ; le `social_publish_job` reste **orphelin `queued`**. Désync latente, bug actif dès scheduler branché. État `queued→cancelled` est autorisé par `state-machine.ts:7` → fix viable. |
| **MISS-006** | major | publication-postiz | Clés d'idempotence **disjointes** : `publish-now` suffixe `:now`, `schedule` suffixe `:<ISO>` (`admin-service.ts:328,653`). Aucune dédup ne vérifie un job `queued` préexistant → **double publication** dès scheduler branché. |
| **BUG-028** | major | generation-image | Le picker propose des id de discovery Higgsfield (`flux_2`…) et des id custom **non routables** ; en live → fallback OpenAI clé vide → 409. Problème de **registre/référentiel de modèles** (donnée de routage). |
| **BUG-056** | minor | generation-image | En mock, le `content_generation_run` enregistre `mock-low-cost-image` en dur (`image-generation.ts:247`), **écrase le modèle intentionnel** choisi → perte de traçabilité/coût. |
| **MISS-003** | major | generation-image | Résolution de clé **divergente** : AI-Engine `resolveApiKey()` (DB chiffrée + ENV_KEY_MAP) vs create `env.CONTENT_STUDIO_OPENAI_API_KEY` direct. Une clé en DB est **invisible** au flux create. Racine transverse de gen-1/gen-2. (DATA = contrat du **registre de credentials/modèles** ; BACKEND = code de résolution.) |
| **MISS-030** | minor | test-mock-infra | `resolvedKeyCache`/`modelCache` TTL 5min sans invalidation env → desync UI/réalité ; aucun test « clé changée pendant TTL ». Donnée = **cycle de vie des caches** + isolation. |
| **BUG-032** | major | generation-video | Vitest sort `exit 1` (rejet de promesse orpheline) masqué par 1695 « passed ». DATA = **invariant de l'instrument de mesure** : un run vert doit prouver `exit 0`. (Filet de vérité, partagé avec BACKEND ACT-BE-001 pour la correction du test.) |

**Lecture transverse.** Trois familles :
- **Vérité du schéma & des tests** : BUG-023/042/064 (nom de table), BUG-032 (exit code), MISS-030 (caches/isolation).
- **Cohérence d'état & anti-doublon** : BUG-038 (sync), MISS-006 (idempotence). *Garde-fou dur du scheduler.*
- **Traçabilité & référentiel de génération** : BUG-056 (modèle persisté), BUG-028 (modèles routables), MISS-003 (résolution de clé unifiée).

---

## 3. Approche & changements de données requis

### 3.1 Vérité du schéma de test (P0)

**Problème de données** : le harnais E2E porte un **nom de table fantôme** (`audit_event`) que la DB ne possède pas. Ce n'est pas un bug produit (l'app insère bien dans `audit_events` via `log-event.ts:24`), c'est un **décalage harnais↔schéma** qui rend le parcours publish-draft non couvert et produit un faux rouge.

**Changement conçu** (DATA fournit le contrat ; backend/frontend appliquent) :
- Établir le **registre canonique des noms de table** consommables par les tests (voir `schemas.yaml`). Le test doit dériver le nom du **schéma Drizzle** (source unique), pas d'un littéral.
- Exiger que les E2E DB tournent contre une **DB de test migrée au schéma réel** (`drizzle/migrations` appliquées), avec une assertion de pré-vol `to_regclass('public.audit_events') IS NOT NULL`.
- DoD : un nom de table faux → **rouge immédiat** ; le parcours publish-draft dry_run → **E2E vert**, prouvé mock et (dry_run) staging.

### 3.2 Idempotence indépendante de `scheduledAt` (P1 — garde-fou dur)

**Problème de données** : `defaultIdempotencyKey(postId, accountId, suffix)` injecte `scheduledAt.toISOString()` (schedule) ou `'now'` (publish-now) en suffixe. Deux chemins → deux clés disjointes → l'`uniqueIndex social_publish_job_idempotency_unique` ne dédup **pas** ce qui devrait l'être. Reprogrammer crée un **2e job** ; publish-now ne neutralise pas le job programmé.

**Modèle cible conçu** :
- **Clé d'idempotence de publication = `content-studio:{postId}:{accountId}`** (sans suffixe temporel ni mode). Un post+compte ⇒ **au plus un job non-terminal** (`draft|approved|queued|publishing`).
- Invariant de données formalisé : *index unique partiel* sur `(post_id, account_id)` WHERE `status IN ('queued','publishing')` — empêche structurellement deux jobs actifs concurrents pour le même couple. (Migration additive, réversible.)
- `reschedule` **mute** `scheduled_at` du job existant (ne crée pas) ; `publish-now` **réutilise/annule** le job `queued` existant avant exécution.
- DoD : publish-now sur un post déjà programmé → **un seul** envoi ; reschedule ×2 → **un seul** `social_publish_job queued`. Vérifié mock (scheduler actif) ET live (dry_run staging, aucun double permalink).

> DATA conçoit l'**invariant + l'index partiel + la nouvelle forme de clé** (migration). BACKEND (ACT-BE-022) implémente l'appel. Cette action **précède l'activation live** du scheduler.

### 3.3 Cohérence d'état `content_post ↔ social_publish_job` (P1 — garde-fou dur)

**Problème de données** : pas de propagation. Annuler un post laisse le job `queued` (orphelin) ; reprogrammer laisse l'ancien `scheduled_at`.

**Modèle cible conçu** :
- **Règle de cohérence transverse** (data invariant) : `content_post.status = cancelled` ⇒ tous les `social_publish_job` non-terminaux du post sont `cancelled`. `content_post.scheduledAt = T` ⇒ le job `queued` du post a `scheduled_at = T`.
- Transition `queued → cancelled` est **déjà autorisée** (`state-machine.ts:7`) — le fix est purement applicatif (DATA confirme la viabilité de l'invariant ; ACT-DA-004 = le modèle de sync que BE-021/301 consomme).
- Optionnel (ADR-0009) : déclencheur de cohérence (DB trigger ou check applicatif transactionnel) pour rendre l'orphelin **structurellement impossible**.
- DoD : annuler un post programmé → job `cancelled` (vérifié `GET /publish-jobs`) ; avec scheduler mock actif, le post annulé n'est **jamais** publié. Prouvé mock ET live (dry_run).

### 3.4 Traçabilité de génération — modèle intentionnel persisté (P3/P5)

**Problème de données** : `content_generation_run` enregistre le modèle d'**exécution** (`mock-low-cost-image`), pas le modèle **intentionnel** choisi par l'opérateur. Audit/coût faussés en mock.

**Modèle cible conçu** :
- Le `generation_run` doit porter à la fois `model` (exécuté) **et** `intended_model` (choisi). En mock, `intended_model` = choix opérateur, `model` = `mock-*`, et un `estimated_cost_cents` du modèle intentionnel (simulation réaliste). Migration **additive** (colonne nullable) ou via `input_json.intendedModel` (sans migration). ADR tranche.
- DoD : POST generate-visual mode=mock model=`gpt-image-1-mini` → `GET generation-runs` montre `intended_model=gpt-image-1-mini` ; en live `model=gpt-image-1` et `cost>0`. Prouvé mock ET live.

### 3.5 Référentiel de modèles routables (P1/P2)

**Problème de données** : pas de **source unique** « id de modèle → routable + provider + résolution de clé ». Le picker propose des id que le générateur ne sait pas router (BUG-028) ; et la résolution de clé diverge (MISS-003).

**Modèle cible conçu** :
- Un **registre de modèles** (donnée de référence) déclarant pour chaque id : `provider`, `role` (image/video/text), `routable: bool`, `keyRef` (clé logique résolue via une **résolution unique** `resolveProviderCredential`). Le picker ne propose **que** des id `routable=true` résolus par la **même** chaîne que le moteur.
- MISS-003 : DATA spécifie le **contrat du référentiel de credentials** (un id logique de clé, résolu DB-chiffrée → ENV_KEY_MAP, partagé par A/B/picker). BACKEND (ACT-BE-010) implémente `resolveProviderCredential()`.
- DoD : tout id proposé par le picker en badge « Live » est **générable** ; un id non routable → erreur métier explicite (pas de fallback OpenAI silencieux). Prouvé mock ET live.

### 3.6 Isolation du stockage & caches invalidables (P0/P4)

**Problème de données** : médias générés écrits sous des chemins **cwd-relatifs** (`generate-voiceover.ts:13`, `transcode-export.ts:15` = `join(process.cwd(), '../../.media-storage/ai-engine')`) → en test, pollution possible du stockage de prod ; `MEDIA_LOCAL_DIR` par défaut `./.media-storage` (relatif). Caches `resolvedKeyCache`/`modelCache` TTL 5min non invalidés sur changement env (MISS-030).

**Modèle cible conçu** :
- **Contrat de stockage média** : racine **absolue** dérivée de `MEDIA_LOCAL_DIR` (ou `MEDIA_DIR`), indépendante du cwd ; en environnement de test, racine = **tmpdir dédié**, et DB = **DB de test isolée**. DATA fournit le contrat (chemins, conventions de slug, table `media` source de vérité) ; BACKEND (ACT-BE-002) implémente.
- **Cycle de vie des caches** : invalidation sur changement env (pas seulement save/delete DB) ; tests couvrant « clé changée pendant la fenêtre TTL ». DATA spécifie l'invariant ; BACKEND (ACT-BE-003) implémente.
- DoD : un run de tests n'ajoute **aucune** row `media` ni fichier hors tmpdir (vérifié `count(media)` avant/après + `ls tmpdir`) ; un changement de clé env est pris en compte **immédiatement** (test). Mock ET live.

### 3.7 Filet de vérité de l'instrument de mesure (P0)

**Problème de données** : la promesse rejetée orpheline (`video-generation.ts:206`) fait sortir vitest en `exit 1` masqué par « 1695 passed ». DATA = l'invariant *« un run de tests vert PROUVE exit 0 »* ; sans lui, aucun invariant de données n'est vérifiable. Correction du test partagée avec BACKEND (ACT-BE-001) ; DATA porte l'**exigence de gate** (exit code = vérité).

---

## 4. Tableau de couverture audit (id → action)

> **Mandat** : chacun des 10 ids assignés apparaît dans `audit_lie` d'au moins une action. Vérifié mécaniquement.

| Id assigné | Sév | Action(s) DATA | t_ref |
|---|---|---|---|
| **BUG-023** | major | ACT-DA-001 (vérité table `audit_events` + E2E vert), ACT-DA-002 (DB de test schéma réel) | T-003 |
| **BUG-042** | major | ACT-DA-001, ACT-DA-002 | T-003 |
| **BUG-064** | minor | ACT-DA-001 (teardown tolérant + assertion corps), ACT-DA-002 | T-003 |
| **BUG-038** | major | ACT-DA-004 (modèle de sync `content_post↔job`) | T-301 |
| **MISS-006** | major | ACT-DA-003 (idempotence indépendante de scheduledAt + index partiel) | T-204 |
| **BUG-028** | major | ACT-DA-006 (registre de modèles routables) | T-101 |
| **BUG-056** | minor | ACT-DA-005 (modèle intentionnel persisté dans generation_run) | T-902 |
| **MISS-003** | major | ACT-DA-006 (contrat référentiel credentials/résolution unique) | T-005 |
| **MISS-030** | minor | ACT-DA-007 (isolation stockage tmpdir/DB test + caches invalidables) | T-410 ; T-411 |
| **BUG-032** | major | ACT-DA-008 (invariant instrument : run vert ⇒ exit 0) | T-001 ; T-002 |

**Couverture : 10/10.** Aucun id non couvert.

---

## 5. Dépendances inter-workstreams

| Action DATA | Dépend de / Bloque | Workstream partenaire |
|---|---|---|
| ACT-DA-001/002 (vérité table + DB test) | Bloque T-010 (smoke opérateur) ; prérequis de toute preuve E2E | QA/BACKEND |
| ACT-DA-003 (idempotence) | **Bloque l'activation live** de ACT-BE-021 (scheduler) ; consommé par ACT-BE-022 | BACKEND |
| ACT-DA-004 (sync d'état) | = dépendance `ACT-DATA-SYNC-JOB` citée par ACT-BE-021 ; **bloque activation live** scheduler | BACKEND |
| ACT-DA-005 (modèle intentionnel) | Consommé par ACT-BE-013/014 (génération texte/variation) | BACKEND |
| ACT-DA-006 (registre modèles + credentials) | Consommé par ACT-BE-010 (`resolveProviderCredential`) et le picker (FRONTEND) | BACKEND, FRONTEND |
| ACT-DA-007 (isolation stockage/caches) | Consommé par ACT-BE-002 (MEDIA_DIR) et ACT-BE-003 (caches) | BACKEND |
| ACT-DA-008 (gate exit code) | Partagé avec ACT-BE-001 (correction du test) ; fondation de tout | BACKEND/QA |

**Règle de séquencement critique (reprise de l'executive-summary §5.3)** : ACT-DA-003 (idempotence) **ET** ACT-DA-004 (sync d'état) sont un **gate dur** avant l'activation live du scheduler (ACT-BE-021/T-103b). Sans eux : doubles publications / publication d'un post annulé sur de vrais comptes Instagram clients — **seul risque irréversible** du projet.

---

## 6. Livrables transverses du workstream

- `plan/02_workstreams/data/plan.md` (ce document) + `tasks.csv` + `adr/`.
- `plan/03_data/data-model.md` — entités, relations, machines à états, invariants.
- `plan/03_data/schemas.yaml` — schémas machine-lisibles (tables, colonnes, contraintes, clé d'idempotence, registre de modèles).
- `plan/03_data/migration-plan.md` — migrations Drizzle requises, ordre, réversibilité.
- ADR proposés : `adr-0008` (clé d'idempotence stable + index partiel), `adr-0009` (invariant de cohérence d'état + propagation), `adr-0010` (vérité du schéma de test & isolation du stockage), `adr-0011` (registre de modèles & résolution de credentials unifiée).

---

## 7. Principe de preuve (rappel)

Aucune action n'est « faite ». Chaque DoD exige **« prouvé en exerçant X en mock ET live »** : un chemin opérateur ou une commande (probe authentifiée, `psql to_regclass`, `GET /publish-jobs`, `GET /generation-runs`, comptage `media` avant/après). En live, toute preuve touchant la publication reste en **dry_run** tant que le garde-fou anti-doublon (ACT-DA-003/004) n'est pas prouvé.
