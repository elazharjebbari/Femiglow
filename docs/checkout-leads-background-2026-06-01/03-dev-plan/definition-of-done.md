# 03 — Définition de fini (Definition of Done)

## DOD-CODE — Toute tâche de code
- [ ] TS strict, **0 `any`** non justifié par commentaire ; types exportés pour les interfaces publiques.
- [ ] `pnpm lint` clean ; `pnpm tsc --noEmit` 0 erreur.
- [ ] Tests unités/intégration de la tâche **écrits et verts** ; couverture ≥ 90 % sur le module du cœur.
- [ ] Pas de PII en logs ; secrets via env ; pas de dépendance runtime nouvelle non validée.
- [ ] Code aligné sur les conventions existantes (nommage, structure repo, i18n FR commentaires).
- [ ] ADR respectées ; déviation = nouvelle ADR.

## DOD-DB — Migration
- [ ] Migration **additive** et **réversible** (up/down testés).
- [ ] Pas de lock long (CHECK en `NOT VALID`→`VALIDATE`).
- [ ] Index nécessaires au drain présents ; contrainte d'unicité d'idempotence d'effet en place.
- [ ] Aucune réécriture de données existantes.

## DOD-COMPAT — Compatibilité legacy
- [ ] Flag OFF ⇒ comportement **identique** au master actuel (réponses, ordre, side-effects) — prouvé par test `TST-R-OFF`.
- [ ] Aucun nouvel endpoint sollicité quand flag OFF.

## DOD-OPS — Ops/observabilité
- [ ] Logs structurés `owbs.*` (sans PII) ; métriques exposées (file, outbox backlog, latence, retry, 409).
- [ ] Alertes configurées (backlog pending>seuil, dead>0, taux d'échec transport).
- [ ] Timer systemd déployé et vérifié (drain effectif < 90 s).
- [ ] Runbook ([`../05-runbook/runbook.md`](../05-runbook/runbook.md)) à jour pour la tâche.

## DOD-GA — Disponibilité générale (fin de rollout)
- [ ] NFR validés sur fenêtre d'observation : latence transition p95 < 50 ms ; **perte de lead = 0** ; backlog outbox sain ; pas de doublons CAPI/webhook.
- [ ] Kill-switch testé (flag OFF < 1 min, sans redeploy).
- [ ] Legacy supprimé proprement + tests obsolètes retirés.
- [ ] Dossier (ce répertoire) mis à jour : statut `RELEASED`, métriques réelles consignées.

## Critères transverses
- [ ] Idempotence prouvée par test (rejeu ×N ⇒ 1 effet).
- [ ] Zéro perte prouvée par test e2e (fermeture en vol + beacon).
- [ ] Parité multi-navigateur (Chromium + WebKit) sur les e2e critiques (R-07).
