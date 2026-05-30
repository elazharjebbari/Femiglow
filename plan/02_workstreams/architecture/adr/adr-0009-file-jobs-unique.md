# ADR-0009 — File de jobs async unique (worker resumable)

- **Statut** : Proposé (Phase B — workstream architecture)
- **Date** : 2026-05-29
- **Consolide côté exécution** : ADR-0005 (cron self-hosted), ADR-0006 (Higgsfield async submit+poll)
- **Findings liés** : `MISS-022`, `MISS-009`, `BUG-037`, `BUG-062`
- **Tâches** : `ACT-ARC-006`, `ACT-ARC-007`, `ACT-ARC-009` ; réutilise `T-103`, `T-103b`, `T-204`, `T-301`, `T-302`, `T-411`

## Contexte

Deux besoins d'exécution asynchrone existent, traités aujourd'hui de façon ad-hoc et cassée :

1. **Polling provider** : Higgsfield est une API **async submit+poll** (`POST /v1/text2image/<model>` ou `/v1/image2video/<model>` → `GET /v1/requests/{id}/status`, statuts `queued|processing|completed|failed`). Le code actuel utilise des endpoints **synchrones faux** (`/v1/images/generate`, `/v1/videos/generate`) et fait du polling **dans le handler HTTP** (jusqu'à 5 min) — viole les timeouts runtime self-hosted (PM2/LiteSpeed) et échoue en permanence (BUG-002/008, MISS-009/022). Le routeur vidéo route par `startsWith('hf-')` (préfixe interne) au lieu de `provider==='higgsfield'`, donc les ids live-découverts (veo3_1, kling3_0) ne sont jamais routés (MISS-022).

2. **Scheduler de publication** : `runScheduledPublishJobs` n'est branché à aucun cron effectif en self-hosted (BUG-003) ; `vercel.json` est sans effet ici. La publication programmée ne s'exécute jamais.

Ces deux besoins ont les **mêmes exigences** : worker resumable, idempotence, locking sur ticks chevauchants, retry borné, observabilité. Les traiter séparément = deux mécaniques concurrentes et un double coût de maintenance.

## Décision

1. **Une seule infrastructure de jobs async**, mutualisée entre le polling provider (Higgsfield) et le scheduler de publication.

2. **Propriétés du worker** :
   - **Resumable** : un poll interrompu reprend depuis l'état persisté (`requestId`, `attempt`, `nextPollAt`).
   - **Idempotence + locking** : un lock empêche deux ticks chevauchants de traiter le même job ; la clé d'idempotence de publication est **indépendante de `scheduledAt`** (T-204) et la sync `content_post ↔ social_publish_job` (T-301) est un **gate dur AVANT** activation live (ADR-0007 §risques).
   - **Backoff borné + timeout global** : pas de boucle infinie ; retry borné des jobs `failed` retryables (T-302).
   - **Heartbeat** : chaque exécution émet un `social_publish_event` (ADR-0005 §3) ; alerte si aucun tick depuis N minutes.

3. **Déclencheur self-hosted** : câblé sur `/api/cron/tick` (systemd timer existant, chaque minute) avec `CRON_SECRET` — **pas** `vercel.json`. Contrôle CI : toute route `/api/cron/*` a un déclencheur sur la cible effective.

4. **Stockage déterministe** : le worker peut tourner avec un cwd ≠ `apps/web`. `MEDIA_DIR` doit être **absolu injecté** (T-411), et compose/transcode doivent passer par l'**abstraction de stockage unique** `getStorage().put()` plutôt que `fs` + chemin relatif codé en dur (BUG-062). Sinon les assets sont écrits/servis ailleurs et la file produit des médias introuvables. **Doit précéder** la mise en worker du polling/scheduler.

5. **Routage provider par identité, pas par préfixe** : le worker route un job de génération par `provider==='higgsfield'` (capability/registre), jamais par `startsWith('hf-')` (MISS-022).

## Conséquences

- ✅ Higgsfield async réellement opérationnel et conforme ; mockable fidèlement (parité, ADR-0003).
- ✅ Publication programmée s'exécute, sous garde-fou anti-doublon.
- ✅ Une seule mécanique d'idempotence/locking/retry à maintenir.
- ⚠️ Bloqué (côté vérif live Higgsfield) sur la fourniture du credential complet `KEY_ID:KEY_SECRET` → DoD découplée (contrat async prouvé en mock fidèle ≠ vérif live à la fourniture).
- ⚠️ Activation live du scheduler **interdite** tant que T-204 + T-301 ne sont pas satisfaits.

## Alternatives écartées

- **Polling dans le handler HTTP** : ne correspond à aucun runtime self-hosted viable (timeouts), échec permanent.
- **Deux files séparées (génération vs publication)** : double coût, divergence des garanties d'idempotence.
- **`vercel.json` cron** : sans effet en self-hosted (ADR-0005).
