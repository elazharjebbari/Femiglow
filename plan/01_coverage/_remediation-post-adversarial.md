# Remédiation post-revue adversariale

> La revue adversariale (`coverage-report.md`) a confirmé la couverture binaire **102/102** mais relevé 3 problèmes élevés, 5 moyens, 4 faibles portant sur la **profondeur, l'ordonnancement et les garde-fous**. Ce document trace les corrections appliquées à la baseline du plan.

## Corrections appliquées (vérifiées mécaniquement)

| # | Problème (revue) | Gravité | Correction appliquée | Vérification |
|---|---|---|---|---|
| 1 | `BUG-004` (blocker) couvert superficiellement : seules l'**exposition** (DTO `ACT-ARC-001`, UI `ACT-DS-005`) étaient liées ; la **production audio** restait en P4/P5 non reliée au blocker. | ÉLEVÉ | `BUG-004` ajouté à `audit_lie` de `ACT-BE-004`, `ACT-BE-030`, `ACT-BE-031`, `ACT-FE-005`. Note explicite en P1 : fermeture réelle du blocker au **jalon M4 (P4)**, pas P1. | `BUG-004` couvert par **6 actions** (production + exposition) dans `audit-to-action.csv`. |
| 2 | `ACT-BE-021` dépend de `ACT-DATA-SYNC-JOB` (id **inexistant**). | ÉLEVÉ | Alias résolu → `ACT-DA-004`. | 0 dépendance pendante (toutes pointent vers un `id_action` existant). |
| 3 | Activation **live** du scheduler non gardée par la sélection de compte → risque de publication sur le **mauvais compte IG client**. | ÉLEVÉ | `ACT-FE-006` (sélection explicite du compte) **remontée P3 → P1** et ajoutée aux dépendances de `ACT-BE-021` ; gate G1 mis à jour (compte déterministe exigé avant flip live). | `ACT-BE-021` dépend de `ACT-FE-006` ; aucune violation d'ordre de phase. |
| 4 | `ACT-BE-024` (accès anonyme aux médias clients `/_media`, MISS-010) orpheline de `phasing.md`/`milestones`/`estimations` (vraie divergence « 66 vs 67 »). | MOYEN | Ajoutée à `phasing.md` (P5), `estimations.csv`, et critère d'acceptation présent. | 67/67 actions placées, estimées, avec critère d'acceptation. |
| 5 | `ACT-BE-022` (idempotence applicative) déconnectée de `ACT-DA-003` (index unique partiel DB). | MOYEN | `ACT-DA-003` ajoutée aux dépendances de `ACT-BE-022` (backstop structurel en base). | Dépendance présente ; chaîne du garde-fou complète. |
| 6 | Alias de dépendances non résolus : `ACT-ARC-RESOLVE-CRED`, `ACT-ARC-MSW`, `ACT-ARC-BRIDGE`, `ACT-DATA-SYNC-JOB`. | MOYEN | Résolus → `ACT-ARC-013`, `ACT-ARC-004`, `ACT-ARC-002`, `ACT-DA-004`. | Toutes les dépendances pointent vers des ids canoniques (vérifié). |
| 7 | Collisions de numérotation ADR entre workstreams (3× `adr-0008`, etc.). | MOYEN | `00_overview/adr-index.md` : handles globaux uniques `PLAN-ADR-001..016`. | Index exhaustif des 16 ADR de plan. |
| 8 | 2 scénarios de parité non reflétés en acceptation : *Postiz integrations read*, *upload-and-trim*. | FAIBLE | 2 critères d'acceptation ajoutés (`ACT-ARC-005`, `ACT-BE-031`) avec `scenario_parite_lie`. | 69 lignes d'acceptation (67 actions + 2 critères de parité). |

## Garde-fou scheduler (publication programmée) — statut après remédiation

> **SATISFAIT.** L'activation **live** d'`ACT-BE-021` est désormais gardée (dépendances **dures**, même phase ou antérieure) par :
> - `ACT-BE-022` (idempotence applicative) + `ACT-DA-003` (index unique partiel DB) → anti double-publication,
> - `ACT-DA-004` (cohérence d'état `content_post ↔ social_publish_job`) → anti publication d'un post annulé/reprogrammé,
> - `ACT-FE-006` (compte cible explicite) → anti mauvais-compte IG client.
> Gate G1 mis à jour en conséquence. Aucune violation d'ordre de phase.

## Invariants re-vérifiés après remédiation
- Couverture audit→action : **102/102** (0 non couvert ; `BUG-044` réfuté = no-action).
- Dépendances : **0 pendante** (tous les tokens `ACT-*` résolvent vers un `id_action` existant).
- Ordonnancement : **0** action dépendant d'une action de phase strictement postérieure.
- Cohérence `tasks.csv` ↔ `phasing.md` : **67/67** actions, priorités alignées.
- Acceptation & estimation : **67/67** actions couvertes.
