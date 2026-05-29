# ADR-0008 — Clé d'idempotence de publication stable + index unique partiel anti-double-job

- **Statut** : Proposé (workstream DATA)
- **Date** : 2026-05-29
- **Findings liés** : `MISS-006` (major), contexte `BUG-038`, `BUG-003` (garde-fou du scheduler)
- **Actions** : ACT-DA-003 (conception) ; consommé par ACT-BE-022 (implémentation)

## Contexte

La table `social_publish_job` possède un index unique sur `idempotency_key` (`social_publish_job_idempotency_unique`). Mais la valeur de cette clé est produite par `defaultIdempotencyKey(postId, accountId, suffix)` (`admin-service.ts:653`) avec un **suffixe variable** :
- `publish-now` → suffixe `'now'` ;
- `schedule` → suffixe `scheduledAt.toISOString()` (`admin-service.ts:328`).

Deux chemins du **même post sur le même compte** produisent donc des clés **disjointes**. L'unicité ne protège pas le cas réel : un post **publié maintenant** puis dont le **job programmé** se déclenche à échéance → **double publication** sur le réseau (Instagram client). Latent aujourd'hui (le scheduler ne tourne pas, `BUG-003`), **actif** dès qu'il est branché. C'est le seul risque **irréversible** du projet.

## Décision

1. **Clé d'idempotence canonique invariante** : `content-studio:{postId}:{accountId}` — **sans** suffixe temporel ni mode. Un couple (post, compte) ⇒ une clé stable.
2. **Index unique partiel additif** garantissant structurellement l'invariant INV-1 :
   ```sql
   CREATE UNIQUE INDEX social_publish_job_active_unique
     ON social_publish_job (post_id, account_id)
     WHERE status IN ('queued','publishing');
   ```
   ⇒ **au plus un** job non-terminal actif par couple.
3. **Comportement** : `reschedule` mute le `scheduled_at` du job existant (pas de 2e job) ; `publish-now` réutilise/annule le job `queued` préexistant avant d'exécuter.
4. **Backfill** (M8) de déduplication des doublons actifs existants **avant** création de l'index (sinon échec).

## Conséquences

- ✅ Le scheduler peut être activé en live **sans** risque de double-post (garde-fou dur de `BUG-003`/T-103b).
- ✅ Double protection : clé stable (collision détectée) + index partiel (1 seul actif).
- ✅ Migration **additive et réversible** (`DROP INDEX`).
- ⚠️ Nécessite un backfill de dédup (M8) documenté/auditable avant l'index.
- ⚠️ Tout chemin créant un job doit passer par la clé canonique (sinon contournement).

## Alternatives écartées

- **Garder le suffixe temporel** : ne dédup pas now/schedule → laisse le double-post.
- **Dédup purement applicative sans index** : non structurelle, race condition possible sous concurrence (deux requêtes simultanées).
