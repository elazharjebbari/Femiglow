# Plan de migration Drizzle — Workstream DATA

> FemiGlow Content Studio v2 / AI Engine. Cible ADR-0007 Option 1.
> Conception uniquement. Les migrations seront générées via `drizzle-kit` (cf. `apps/web/drizzle.config.ts`, `apps/web/drizzle/migrations`) par le workstream backend, sur la base des contrats DATA ci-dessous.
> **Principe** : migrations **additives et réversibles** d'abord ; aucune migration destructive sur la baseline. Le code applicatif change en parallèle (autre workstream) — DATA ne fournit que le schéma cible.

---

## 0. Inventaire des changements de données requis

| # | Action | Type | Migration Drizzle ? | Réversible |
|---|---|---|---|---|
| M1 | Index unique partiel anti-double-job | Schéma (additif) | **Oui** | Oui (DROP INDEX) |
| M2 | Forme de clé d'idempotence stable | **Code seulement** (valeur, pas schéma) | Non (data) | Oui (logique) |
| M3 | Propagation de cohérence d'état | **Code seulement** (transaction applicative) | Non | Oui (logique) |
| M4 | Traçabilité modèle intentionnel | Schéma (additif) OU code | **Optionnel** | Oui |
| M5 | Registre de modèles + résolution credentials | **Config/code** (donnée de référence) | Non (sauf table de registre optionnelle) | Oui |
| M6 | Isolation stockage + caches | **Runtime/config** | Non | Oui |
| M7 | Vérité du schéma de test | **Harnais de test** | Non | Oui |
| M8 | Backfill clé d'idempotence (jobs existants) | **Data backfill** | Oui (script) | Oui (best-effort) |

---

## 1. M1 — Index unique partiel anti-double-job (ACT-DA-003 / MISS-006)

**But** : garantir structurellement INV-1 (au plus 1 job actif par couple post/compte).

**SQL conçu (drizzle-kit générera l'équivalent)** :
```sql
-- up
CREATE UNIQUE INDEX CONCURRENTLY social_publish_job_active_unique
  ON social_publish_job (post_id, account_id)
  WHERE status IN ('queued', 'publishing');
-- down
DROP INDEX IF EXISTS social_publish_job_active_unique;
```

**Définition Drizzle cible** (à ajouter dans `schema-social-publishing.ts`, par backend) :
```ts
activeJobUnique: uniqueIndex('social_publish_job_active_unique')
  .on(t.postId, t.accountId)
  .where(sql`${t.status} IN ('queued','publishing')`),
```

**Pré-condition** : avant de créer l'index, **dédupliquer** les éventuels doublons actifs existants (cf. M8). Sinon `CREATE UNIQUE INDEX` échoue.

**Vérification (DoD)** :
- mock : insérer un 2e job `queued` pour le même `(post_id, account_id)` → **violation** d'index unique.
- live (staging) : `\d social_publish_job` montre l'index ; publish-now+schedule sur le même post → `count(social_publication WHERE post_id=X) = 1`.

**Réversibilité** : `DROP INDEX` immédiat, sans perte de données.

---

## 2. M2 — Clé d'idempotence stable (ACT-DA-003 / MISS-006)

**But** : INV-1 — `idempotency_key = content-studio:{postId}:{accountId}` (sans suffixe temporel/mode).

**Pas de migration de schéma** : la colonne `idempotency_key` existe déjà (`social_publish_job.idempotency_key`, unique). C'est la **valeur produite** par `defaultIdempotencyKey` (`admin-service.ts:653`) qui change → **code** (ACT-BE-022).

**Impact data** : l'`uniqueIndex social_publish_job_idempotency_unique` (existant) commence alors à dédupliquer correctement now/schedule. Combiné à M1 (filtre status), la double protection est : (a) clé stable → réutilisation/collision détectée ; (b) index partiel → 1 seul actif.

**Réversibilité** : revenir à l'ancienne forme de clé est une simple bascule de code (logique).

---

## 3. M3 — Propagation de cohérence d'état (ACT-DA-004 / BUG-038)

**But** : INV-2 — cancel/reschedule propagent au `social_publish_job`.

**Pas de migration de schéma** : la transition `queued → cancelled` est **déjà** autorisée (`state-machine.ts:7`). Le changement est **applicatif et transactionnel** (ACT-BE-021/T-301) :
- `cancelScheduledPost` → après `cancelPost`, appeler `cancelPublishJob` sur les jobs non-terminaux du post (même transaction).
- `reschedulePost` → après `updatePostPlanning`, muter `scheduled_at` du job `queued` (pas de 2e job — cohérent M1).

**Option garde-fou structurel (ADR-0009)** : check applicatif transactionnel (préféré au trigger DB pour rester testable dans Drizzle). Si trigger retenu plus tard → migration additive réversible séparée.

**Vérification (DoD)** : annuler un post programmé → `social_publish_job.status = cancelled` (`GET /publish-jobs`) ; au tick scheduler mock, **0** `social_publication` pour le post annulé. Mock ET live (dry_run).

---

## 4. M4 — Traçabilité du modèle intentionnel (ACT-DA-005 / BUG-056)

**But** : INV-4 — persister le modèle choisi par l'opérateur, même en mock.

**Deux options (ADR-0008/0011 tranche)** :

**Option A — colonnes additives** (préférée si requêtes analytiques sur le modèle) :
```sql
-- up
ALTER TABLE content_generation_run ADD COLUMN intended_model text;
ALTER TABLE content_generation_run ADD COLUMN estimated_cost_cents integer;
-- down
ALTER TABLE content_generation_run DROP COLUMN estimated_cost_cents;
ALTER TABLE content_generation_run DROP COLUMN intended_model;
```
Colonnes **nullables** → migration additive, **réversible**, sans backfill obligatoire (les anciens runs restent NULL).

**Option B — sans migration** : stocker dans `input_json.intendedModel` / `input_json.estimatedCostCents` (jsonb existant). Zéro migration, mais non indexable.

**Recommandation DATA** : Option A (colonne `intended_model`) pour audit/coût requêtable ; effort S, risque nul (nullable).

**Vérification (DoD)** : POST generate-visual mock model=`gpt-image-1-mini` → `intended_model = gpt-image-1-mini`, `estimated_cost_cents > 0` ; live → `model = gpt-image-1`, `cost > 0`.

---

## 5. M5 — Registre de modèles + résolution credentials (ACT-DA-006 / BUG-028 / MISS-003)

**But** : INV-7 — source unique modèle→routable/keyRef + `resolveProviderCredential` partagée.

**Pas de migration de schéma obligatoire** : le registre peut être une **donnée de référence en code/config** (typée), consommée par A/B/picker. La table `ai_engine_api_keys` (DB chiffrée, `schema-ai-engine.ts:251`) reste la source des secrets.

**Option table de registre (si gouvernance dynamique souhaitée)** — additive, réversible :
```sql
-- up
CREATE TABLE model_registry (
  id text PRIMARY KEY,
  provider text NOT NULL,
  role text NOT NULL,            -- image|video|text
  routable boolean NOT NULL DEFAULT false,
  key_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- down
DROP TABLE IF EXISTS model_registry;
```

**Recommandation DATA** : commencer en **code/config** (réversible, testable, pas de migration) ; ne créer la table que si l'admin doit éditer le registre à chaud. ADR-0011 tranche.

**Vérification (DoD)** : picker badge « Live » ⇒ `routable=true` ; id non routable → erreur métier ; clé DB lue par le flux create (live).

---

## 6. M6 — Isolation stockage + caches (ACT-DA-007 / MISS-030)

**But** : INV-6 — racine média absolue, tmpdir/DB de test, caches invalidables.

**Pas de migration de schéma** : changements **runtime/config** (ACT-BE-002 MEDIA_DIR absolu, ACT-BE-003 caches). DATA fournit le **contrat** (chemins absolus, tmpdir en test, DB de test isolée, invalidation env).

**Vérification (DoD)** : suite de tests → **0** row `media` / fichier hors tmpdir touchant la prod (diff `ls .media-storage` + `count(media)` avant/après vides) ; changement de clé env pris en compte immédiatement.

---

## 7. M7 — Vérité du schéma de test (ACT-DA-001/002 / BUG-023/042/064)

**But** : INV-3 — E2E DB sur schéma réel, nom de table dérivé du schéma.

**Pas de migration de schéma applicatif** : changements **harnais de test** (le test utilise `audit_events`, pré-vol `to_regclass`, DB de test migrée). DATA fournit l'inventaire `table_name_registry` (cf. `schemas.yaml`).

**Vérification (DoD)** : E2E publish-draft vert (mock) ; renommer la table au singulier dans le test → rouge immédiat ; `to_regclass('public.audit_events') IS NOT NULL` en staging.

---

## 8. M8 — Backfill de déduplication (pré-condition de M1)

**But** : avant `CREATE UNIQUE INDEX` (M1), résoudre les doublons actifs existants pour ne pas faire échouer la création de l'index.

**Script conçu (idempotent, réversible best-effort)** :
```sql
-- Détection (dry-run) — doit retourner 0 ligne avant M1
SELECT post_id, account_id, count(*) AS active_jobs
FROM social_publish_job
WHERE status IN ('queued','publishing')
GROUP BY post_id, account_id
HAVING count(*) > 1;

-- Remédiation: annuler les doublons les plus anciens, garder le plus récent
-- (transition queued->cancelled autorisée). À exécuter en transaction, après revue.
```

**Réversibilité** : un job `cancelled` par erreur peut être re-créé via le chemin normal (publish-now/schedule). On documente la liste des jobs annulés (audit_events).

---

## 9. Ordre d'exécution (séquencement migrations)

```
P0 : M7 (vérité test)  ────────────────────────────┐
     [pré-requis: tout le reste est vérifiable]     │
P1 : M8 (backfill dedup) ─► M1 (index partiel) ─────┤  garde-fou dur
     M2 (clé stable, code) ─────────────────────────┤  AVANT activation live scheduler
     M3 (propagation état, code) ───────────────────┘  (ACT-BE-021/T-103b)
     M5 (registre modèles/credentials)
P3 : M4 (modèle intentionnel)
P4 : M6 (isolation stockage/caches)
```

**Règle dure** : M1 + M2 + M3 (anti-doublon + cohérence) **précèdent l'activation live** du scheduler. Activer le scheduler avant = doubles publications / publication d'un post annulé sur de vrais comptes Instagram clients (seul risque irréversible).

**Réversibilité globale** : toute migration de schéma proposée (M1, M4-A, M5-table) est **DROP-able** sans perte de données métier. Les changements de code (M2, M3, M6, M7) sont des bascules logiques. M8 est un data-fix documenté/auditable.

---

## 10. Couverture findings → migrations

| Id | Migration |
|---|---|
| MISS-006 | M1, M2, M8 |
| BUG-038 | M3 |
| BUG-056 | M4 |
| BUG-028, MISS-003 | M5 |
| MISS-030 | M6 |
| BUG-023, BUG-042, BUG-064 | M7 |
| BUG-032 | (instrument de test, hors migration de données) |
