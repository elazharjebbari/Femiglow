# 05 — Plan de rollout & kill-switch

## 1. Principe

Déploiement **dark** puis **ramp** par le flag `NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED`
(client) couplé à `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (serveur). Tout est
réversible **sans redeploy**. La table/worker outbox sont déployés en amont,
inertes tant que rien n'enqueue.

## 2. Étapes de ramp

| Palier | Audience | Pré-requis | Critère de passage |
|---|---|---|---|
| **R0 — Dark** | 0 % (flag OFF) | migration + worker déployés | backlog outbox=0, comportement legacy intact |
| **R1 — Canary interne** | équipe / device de test (override flag) | smoke prod OK | parcours instantané, lead persisté, conversion OK, effets `done`<90 s |
| **R2 — 10 %** | 10 % du trafic checkout | dashboards en place | latence transition p95<50 ms ; perte=0 ; pas de hausse d'erreur/abandon |
| **R3 — 50 %** | 50 % | R2 stable 48 h | idem + backlog outbox sain ; pas de doublons CAPI/webhook |
| **R4 — 100 %** | 100 % | R3 stable 72 h | tous NFR verts |
| **GA** | défaut ON | R4 stable | suppression legacy (P8) |

> Mécanisme de pourcentage : si pas de bucketing dispo, ramper par cohorte
> (locale, device) ou activer 100 % directement après un canary long (R1→R4) si
> le volume est faible. Documenter le mécanisme retenu au moment de R2.

## 3. Métriques de décision (go/no-go) — cf. `observability.md`

- **GO si** : `transition_p95 < 50 ms`, `lead_loss_rate == 0`, `outbox_pending` borné, `outbox_dead == 0`, `dup_rate(CAPI/webhook) ≈ 0`, `checkout_abandon_rate` ≤ baseline.
- **NO-GO / rollback si** : hausse d'abandon, perte de lead détectée, backlog/dead en croissance, doublons d'événements.

## 4. Kill-switch (procédure)

1. **Flag OFF** (client + serveur) → retour legacy immédiat (< 1 min), file non instanciée.
2. Si anomalie worker : `systemctl stop femiglow-cron-lead-outbox.timer` (effets restent `pending`, rejouables).
3. Communiquer (canal ops) + ouvrir incident + figer le ramp.
4. Aucune perte attendue (rows lead + outbox conservées).

## 5. Critères de fin de rollout (GA)
- 100 % stable sur la fenêtre d'observation, tous NFR verts.
- Legacy supprimé (P8) + tests obsolètes retirés.
- Statut du dossier → `RELEASED` ; métriques réelles consignées dans le runbook (annexe).

## 6. Annexe — matrice flag × comportement
| `NEXT_PUBLIC_…` | `CHECKOUT_OPTIMISTIC…` (serveur) | Comportement |
|---|---|---|
| false | false/true | Legacy (await bloquant). Routes idempotentes mais non sollicitées en mode optimiste. |
| true | true | Optimiste complet (file + beacon + outbox enqueue). |
| true | false | **Interdit** (incohérent) — garde-fou : si serveur OFF, ignorer le client ON (log warn). |
