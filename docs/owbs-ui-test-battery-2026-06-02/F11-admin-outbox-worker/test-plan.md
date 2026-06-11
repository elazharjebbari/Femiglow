# F11 — Plan de tests concret

> Le worker est **déjà bien testé** (pglite : SKIP LOCKED, reschedule/dead, cron auth,
> dedup). F11 **ajoute** la **supervision opérateur** (UI à construire OU procédure).

## A. Worker (intégration pglite — vérifier/compléter l'existant)
- **F11-S10..S14** : déjà couverts (`lead-outbox.pglite.integration.test.ts`,
  `register-handlers.pglite.integration.test.ts`, `cron/lead-outbox` route test) →
  **vérifier verts**. Compléter : un effet qui dépasse `max_attempts` ⇒ `dead`
  (assertion `countByStatus('dead')`).

## B. Vue admin (si construite — TDD)
- **F11-S01/S02/S03/S04** : RTL sur `admin/leads/outbox` avec fixtures (pending/done/dead) →
  liste + compteurs + **alerte si dead>0** + détail (sans PII) + filtres.
- **F11-S05** : action « rejouer » → `POST /api/admin/leads/outbox/[id]/replay` (MSW) →
  l'effet repasse `pending attempts=0` ; idempotent.
- a11y axe sur la vue.

## C. Procédure (si pas d'UI — SPEC/OPS, testé manuellement + scriptable)
- **F11-S06/S20/S21** : exécuter les requêtes de supervision (cf.
  [`../90-execution/commands.txt`](../90-execution/commands.txt)) :
  `SELECT status,count(*) … GROUP BY status` ; lister les `dead` ; **rejouer** via
  `UPDATE … SET status='pending', attempts=0, next_attempt_at=now()`. Vérifier qu'un
  rejeu mène à `done` au cycle suivant.

## D. Décision (UI vs procédure)
> **Recommandation** : construire la vue minimale (S01-S05) — le risque RSK-15
> (effets invisibles) est `high`. À défaut, la procédure (S06) est **obligatoire**
> et doit être dans le runbook + supervisée (alerte `dead>0`).

## E. Étapes
1. Vérifier worker existant vert + ajouter assertion dead (S10-S14).
2. **Décider** UI vs procédure ; implémenter + tester (S01-S06).
3. Observabilité backlog/dead (S20/S21) dans le runbook.
