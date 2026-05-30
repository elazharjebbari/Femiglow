# CHANGELOG — Baseline d'audit génération + publication

Format inspiré de [Keep a Changelog](https://keepachangelog.com/). La baseline est **figée** : toute évolution après le gel est consignée ici (et, si structurante, via un nouvel ADR), sans réécriture silencieuse des fichiers gelés.

## [1.0.0] — 2026-05-29 — Gel initial de la baseline

### Ajouté
- Arborescence complète de l'audit sous `docs/audit-generation-publication-2026-05-29/` (cf. ADR-0001).
- **`01_audit/`** : méthodologie, périmètre, registres (`bug-register.csv`, `gap-matrix.csv`, `mock-live-parity.csv`, `missed-issues.csv`), `findings/*.md` (un fichier par finding blocker/critical/major, avec preuve + réfutation tentée), `evidence/` (état env runtime, résumé vitest exit-1, parcours Playwright, contre-vérification ffmpeg), `_consolidated.json`.
- **`02_architecture/`** : 7 diagrammes PlantUML (C4 niveaux 1-3, séquences génération & publication, data-flow) + `component-registry.json` (62 composants) + `dependencies.json`.
- **`03_axes/`** : 11 diagnostics transversaux (`state.md` + `metrics.json`).
- **`04_domaines/`** : 6 briques (`spec.md`, `current-state.md`, `contracts.yaml`, `test-scenarios.csv`).
- **`05_test-strategy/`** : stratégie orientée opérateur, matrice de couverture, traçabilité, contrats MSW, parcours Playwright.
- **`06_action-plan/`** : plan priorisé, backlog tracé, graphe de dépendances.
- **`07_runbook/`** : runbook exécutable avec boucle correction → re-test → vérification indépendante.
- **`decisions/`** : ADR-0001 à 0007.

### Méthode
- Audit conduit sous le **principe directeur** « vérité = comportement réel » (ADR-0002), exercice réel mock+live, et **vérification adversariale** indépendante de chaque finding.
- Bilan : **68 findings confirmés** (4 blocker, 8 critical, 35 major, 18 minor, 3 info), **1 réfuté**, **34 problèmes manqués** relevés par les vérificateurs.

### Corrections post-passe (intégrées au gel)
- `BUG-012` / `BUG-013` (voix-off/musique « cassées car lavfi indisponible ») **reclassés `minor` + `root-cause-refuted`** après contre-exécution du binaire `ffmpeg-static` réel (lavfi fonctionne, exit 0). Cf. `evidence/ffmpeg-binary-verification.md`.
- `evidence/runtime-env-state.md` corrigé : `OPENAI_API_KEY` valide **présent** mais non mappé dans `env.ts` / non lu par le flux create (split d'env), et non « clé absente ».

---

> Entrées futures : ajouter ici les changements d'état des findings (résolu/vérifié mock+live), nouveaux ADR, et nouvelles baselines datées.
