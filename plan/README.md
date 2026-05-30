# Plan d'action exécutable — pipeline génération + publication

> **Plan figé** · version **1.0.0** · **2026-05-29** · couvre la baseline d'audit `docs/audit-generation-publication-2026-05-29/`.
> **Cible architecture (décidée) : ADR-0007 Option 1 — converger vers A (LangGraph moteur unique ; le create-flow devient une UI au-dessus de A).**
> ⚠️ Ce dossier **ne contient aucune modification de code** : c'est le **quoi** et le **pourquoi**, prêts à être exécutés dans une phase future.

## Statut & garantie de couverture

> ✅ **Couverture totale prouvée mécaniquement : 102 / 102 points d'audit** (68 `BUG-*` + 34 `MISS-*`) reliés à ≥1 action. `BUG-044` = réfuté → no-action documenté.
> **67 actions** (`ACT-*`) réparties en 6 workstreams, séquencées en **6 phases (P0→P5)**, chacune avec critère de fin **mesurable mock+live**.

Invariants vérifiés (cf. `01_coverage/_remediation-post-adversarial.md`) : 0 point non couvert · 0 dépendance pendante · 0 dépendance vers une phase postérieure · cohérence `tasks.csv ↔ phasing.md` 67/67 · acceptation & estimation 67/67. Revue **adversariale** passée (`01_coverage/coverage-report.md`) + remédiée.

## Comment exécuter ce plan (phase future)

1. Lire `00_overview/executive-summary.md` (vision cible + séquencement macro) et `guiding-principles.md`.
2. Suivre `07_runbook/runbook.md` **phase par phase** (P0→P5), avec la boucle **correction → re-test → vérification indépendante** et les **gates durs G0→G5** entre phases.
3. Pour chaque action : prendre sa ligne dans `02_workstreams/<ws>/tasks.csv` (description, dépendances, DoD), implémenter, puis valider via `06_acceptance/acceptance-criteria.csv` (**statut mock ET live**).
4. **Ne jamais** activer la publication live (`SOCIAL_PUBLISHING_MODE=live`) avant que le **garde-fou** soit vert : `ACT-BE-022` + `ACT-DA-003` + `ACT-DA-004` + `ACT-FE-006` (cf. gate G1).
5. En cas d'échec : `07_runbook/rollback.md` (flags, migrations `down`, désactivation scheduler).

## Structure

```
plan/
├── README.md                       ← vous êtes ici
├── manifest.yaml                   version, date, baseline couverte, empreinte
├── 00_overview/
│   ├── executive-summary.md        vision cible (convergence A) + séquencement macro P0..P5
│   ├── guiding-principles.md       parité mock/live, vérité=réel, garde-fous
│   ├── target-architecture.md (+.puml)  architecture cible détaillée
│   └── adr-index.md                index global des 16 ADR de plan (PLAN-ADR-001..016)
├── 01_coverage/
│   ├── audit-to-action.csv         PREUVE: 102 points d'audit → action(s) → statut
│   ├── coverage-report.md          revue adversariale (points superficiels/risques)
│   ├── _remediation-post-adversarial.md  corrections appliquées après revue
│   ├── _routing.json               table de routage déterministe (point → workstream)
│   └── _actions_index.json         index machine des actions
├── 02_workstreams/<ws>/            architecture · backend · frontend · ui-ux · data · design
│   ├── plan.md                     objectifs, état cible, approche, couverture
│   ├── tasks.csv                   id_action,titre,description,dependances,effort,priorite,dod_mesurable,audit_lie,t_ref,statut
│   └── adr/                        ADR proposés (handles globaux dans 00_overview/adr-index.md)
├── 03_data/                        data-model.md · schemas.yaml · migration-plan.md
├── 04_design/                      design-system.md · ux-flows.puml · ui-states.md
├── 05_dev-plan/                    phasing.md · dependencies.puml · milestones.csv · estimations.csv
├── 06_acceptance/                  definition-of-done.md · acceptance-criteria.csv
└── 07_runbook/                     runbook.md · rollback.md
```

## Traçabilité croisée (ids partagés)

`BUG-*/MISS-*` (audit) → `audit-to-action.csv` → `ACT-*` (`02_workstreams/*/tasks.csv`) → `acceptance-criteria.csv` (critère mock+live) → `phasing.md` (phase + gate) → `runbook.md` (étape). Les `t_ref` relient chaque action aux tâches `T-*` de l'action-plan d'audit (`docs/.../06_action-plan/`).

## Définition de fin (DoD globale)

> **Système 100 % fonctionnel, prouvé par des tests orientés opérateur qui passent À L'IDENTIQUE en mode MOCK ET en mode LIVE.** Aucune action n'est « faite » : elle est **« vérifiée en mock + live par tel chemin opérateur »**. Détail : `06_acceptance/definition-of-done.md`.

> Figé : évolutions via un futur CHANGELOG/nouveaux ADR, pas par réécriture (cf. ADR-0001 de la baseline d'audit).
