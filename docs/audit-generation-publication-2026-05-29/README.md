# Audit génération + publication — FemiGlow Content Studio v2 / AI Engine

> **Baseline d'audit figée** · version **1.0.0** · gel **2026-05-29** · branche `feat/ai-engine-langgraph-mvp`
> Instantané de référence **non réécrit** (cf. `decisions/adr-0001`). Évolutions via `CHANGELOG.md` + nouveaux ADR.

## Statut global

> 🔴 **Pipeline « générer → publier » non fonctionnel de bout en bout pour l'opérateur ; le signal de test masque l'état réel.**
>
> **68 findings confirmés** : **4 blocker · 8 critical · 35 major · 18 minor · 3 info** · 1 réfuté · 9 ajustés · 34 problèmes manqués relevés.
> Axes en **blocker** : backend, fiabilité, process, robustesse. **Seul le mode mock produit un résultat ; la génération live et la publication programmée sont cassées.**

**Commencer par** → [`01_audit/00_executive-summary.md`](01_audit/00_executive-summary.md) (synthèse direction).

## Comment lire ce dossier

| Si vous voulez… | Allez à |
|---|---|
| Le verdict et les priorités | `01_audit/00_executive-summary.md` |
| La méthode (vérité = réel, mock/live, réfutation) | `01_audit/01_methodology.md` |
| Le périmètre exact | `01_audit/02_scope.md` |
| **Tous les bugs** (registre) | `01_audit/bug-register.csv` |
| La matrice supposé vs réel vs écart | `01_audit/gap-matrix.csv` |
| Les divergences mock vs live | `01_audit/mock-live-parity.csv` |
| Les problèmes manqués (critique de complétude) | `01_audit/missed-issues.csv` |
| Le détail d'un bug majeur (preuve + réfutation) | `01_audit/findings/BUG-xxx-*.md` |
| Les preuves brutes (env, vitest exit-1, Playwright, ffmpeg) | `01_audit/evidence/` |
| L'architecture (C4, séquences, data-flow, registres) | `02_architecture/` |
| Le diagnostic par axe transversal | `03_axes/<axe>/state.md` + `metrics.json` |
| Une brique du pipeline (spec/état/contrat/scénarios) | `04_domaines/<domaine>/` |
| **La stratégie de test qui ferme le gap test↔réalité** | `05_test-strategy/strategy.md` |
| La traçabilité finding ↔ test ↔ statut mock/live | `05_test-strategy/traceability.csv` |
| **Le plan d'action priorisé** | `06_action-plan/action-plan.md` + `backlog.csv` |
| **Le runbook exécutable** | `07_runbook/runbook.md` |
| Les décisions d'architecture | `decisions/adr-*.md` |
| La terminologie | `GLOSSARY.md` |

## Arborescence

```
audit-generation-publication-2026-05-29/
├── README.md                      ← vous êtes ici
├── GLOSSARY.md                    terminologie
├── manifest.yaml                  version, date de gel, périmètre, empreinte
├── CHANGELOG.md
├── 01_audit/
│   ├── 00_executive-summary.md    synthèse direction
│   ├── 01_methodology.md          méthode + principe « vérité = réel », protocole mock/live
│   ├── 02_scope.md
│   ├── bug-register.csv           68 findings confirmés (id, sévérité, mock/live, verdict, repro, cause racine)
│   ├── gap-matrix.csv             supposé | réel vérifié | écart | cause racine
│   ├── mock-live-parity.csv       scénario | mock | live | divergence
│   ├── missed-issues.csv          34 problèmes relevés par les vérificateurs
│   ├── _consolidated.json         registre machine-lisible (findings + réfutés + manqués)
│   ├── findings/                  un .md par finding majeur+ (preuve + réfutation tentée) + transverses + _refuted.md
│   └── evidence/                  journaux/traces (vitest exit-1, parcours Playwright, env, contre-vérif ffmpeg)
├── 02_architecture/               7 .puml (C4 1-3, séquences, data-flow) + component-registry.json + dependencies.json
├── 03_axes/                       11 axes transversaux : <axe>/{state.md, metrics.json}
│   └── ui-ux design frontend backend fiabilite process robustesse maintenabilite evolutivite modularite debogabilite
├── 04_domaines/                   6 briques : <domaine>/{spec.md, current-state.md, contracts.yaml, test-scenarios.csv}
│   └── generation-image generation-video voix-off copywriting montage-composition publication-postiz
├── 05_test-strategy/              strategy.md, coverage-matrix.csv, traceability.csv, msw-contracts.md, playwright-journeys.md
├── 06_action-plan/                action-plan.md, backlog.csv (34 tâches), dependencies.puml
├── 07_runbook/                    runbook.md (boucle correction → re-test → vérif indépendante, DoD final)
└── decisions/                     adr-0001 … adr-0007
```

## Cohérence des références croisées (vérifiée)

- Chaque bug du registre → son finding (`findings/`), sa ligne de matrice (`gap-matrix.csv`), sa ligne de traçabilité (`traceability.csv`) et **au moins une tâche** du backlog. **Traçabilité = 100 %** (68/68 findings référencés dans le plan).
- `BUG-044` est **absent** du registre (seul finding **réfuté**, journalisé dans `findings/_refuted.md`).
- Diagrammes PlantUML : rendu hors-ligne (notation robuste sans `!include`). JSON/CSV validés.

## Définition de fin (DoD globale)

> **Système 100 % fonctionnel, prouvé par des tests orientés opérateur qui passent À L'IDENTIQUE en mode mock ET en mode live.** Toute fonctionnalité non vérifiée dans les deux modes est considérée **cassée par défaut**.
