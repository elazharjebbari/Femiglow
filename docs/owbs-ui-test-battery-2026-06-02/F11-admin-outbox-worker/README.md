# F11 — Admin : supervision outbox & worker (effets durables)

**Surface :** `lead_event_outbox`, `lead-outbox-processor`,
`POST /api/cron/lead-outbox`. **Public :** **opérateur**.

## 🔴 GAP MAJEUR (élément non testé / manquant)
**Il n'existe AUCUNE interface d'administration pour superviser l'outbox.** Les
effets `dead` (webhook jamais livré) sont **invisibles** pour l'opérateur — c'est
le risque RSK-15 (sévérité **high**). F11 :
1. **Spécifie** une vue admin minimale de supervision (à construire),
2. **Définit** une procédure opérationnelle de repli (SQL/commandes) si l'UI n'est pas livrée à temps,
3. **Teste** les deux (UI si construite, procédure sinon) + le worker.

## 1. Fonctionnement optimal (cible)
- Une page `/admin/leads/outbox` liste les effets par **statut** (pending/processing/done/dead),
  type (order_webhook…), `leadId`, `attempts`, `last_error`, `next_attempt_at`.
- **Compteurs** en tête : pending / dead / backlog. Filtre par statut/type.
- Action **« rejouer »** un effet `dead` (remet `pending`, `attempts=0`).
- Le worker cron draine ; un effet réussit → `done`, échoue → backoff → `dead` après max.

## 2. Points à vérifier (tous angles)
### UI/UX opérateur (si vue construite)
- Visibilité immédiate du **backlog** et des **dead** (alerte visuelle si dead>0).
- Détail d'un effet : type, lead, tentatives, dernière erreur (sans PII en clair).
- Rejeu d'un dead avec confirmation + feedback ; idempotent.
### Backend / worker
- `pickAndProcessBatch` : `FOR UPDATE SKIP LOCKED` (pas de double-traitement), backoff, dead après max.
- Cron : `401` sans `CRON_SECRET`, `200` + rapport avec ; `maxDuration=60`.
- Dédup d'effet : `UNIQUE(type, lead_id, dedupe_key)` → pas de double webhook.
### Ops / observabilité
- Logs `owbs.outbox.done|reschedule|dead` exploitables ; alerte backlog/dead documentée.

## 3. Oracle principal
> Un webhook qui échoue de façon persistante devient `dead` et est **détectable**
> (vue admin OU requête de supervision), puis **rejouable** ; le worker ne
> double-traite jamais.

## 4. Livrables spécifiés (si on construit l'UI)
- Page `admin/leads/outbox` + route `GET /api/admin/leads/outbox` (liste/filtre/compteurs).
- Action rejeu `POST /api/admin/leads/outbox/[id]/replay`.
- Sinon : procédure SQL de supervision (cf. runbook + [`../90-execution/commands.txt`](../90-execution/commands.txt)).

## 5. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
