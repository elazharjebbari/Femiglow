# Plan d'action — Production média opérateur (voix-off · montage · sous-titres)

> Dossier d'action complet et intégral pour combler **BUG-004** : faire remonter
> dans l'UI opérateur (`/admin/content-studio-v2/create`) les trois capacités de
> production média qui existent dans le pipeline LangGraph mais ne sont exposées
> nulle part : **génération de voix-off**, **montage/édition vidéo (compose)** et
> **sous-titres / script sur la vidéo**.
>
> **Périmètre :** design + plan d'action + plan de tests + runbook. **Aucun code
> applicatif n'est modifié par ce dossier** — c'est le plan d'exécution. La
> publication reste en `dry_run` (jamais de live).
>
> Daté du 2026-05-30. Ancré au merge `deecc53` (branche `master`, staging).

---

## 0. Par où commencer

1. **Lire d'abord** [`00_global/ground-truth-codebase.md`](00_global/ground-truth-codebase.md) — la **source de vérité unique** (architecture réelle, décisions D1–D6, schéma d'IDs de tâches, barre de qualité). Tout le reste s'y aligne.
2. Vue d'ensemble : [`00_global/overview.md`](00_global/overview.md) et [`00_global/scope-and-outcomes.md`](00_global/scope-and-outcomes.md).
3. Comprendre le trou actuel : [`00_global/architecture-current.md`](00_global/architecture-current.md) ; la cible : [`00_global/architecture-target.md`](00_global/architecture-target.md).
4. Exécuter : [`05_runbook/runbook.md`](05_runbook/runbook.md) (piloté par [`05_runbook/pilot.md`](05_runbook/pilot.md)).

---

## 1. Structure du dossier

| Dossier | Rôle | Fichiers clés |
|---|---|---|
| [`00_global/`](00_global/) | **Backbone** : architecture, modèle de données, DTO+bridge, migration DB, décisions, risques, glossaire | `ground-truth-codebase.md`, `architecture-target.{md,puml}`, `data-model.{md,puml}`, `dto-bridge-changes.md`, `db-migration.md`, `decision-log.md`, `risks.csv` |
| [`01_voiceover/`](01_voiceover/) | **Voix-off** (TTS) — `MP-VO-*` | spec fonctionnelle, backend/frontend/ux, contrats API, plans de tests vitest/playwright/MSW, checklists |
| [`02_compose/`](02_compose/) | **Montage / compose** (ffmpeg) — `MP-CO-*` | idem |
| [`03_subtitles/`](03_subtitles/) | **Sous-titres / script** (SRT + burn-in) — `MP-SU-*` | idem |
| [`04_test-battery/`](04_test-battery/) | **Batterie de tests dense + boucle de correction** — `MP-TB-*` | `strategy.md`, `robustness-principles.md`, `correction-loop.{md,puml}`, `test-matrix.csv` (273 tests), `coverage-map.csv`, `ci-integration.yaml` |
| [`05_runbook/`](05_runbook/) | **Runbook de pilotage** de l'exécution — `MP-RB-*` | `runbook.md`, `runbook-test-battery.md`, `preflight.md`, `go-no-go.md`, `rollback.md`, `commands.sh`, `execution-checklist.csv`, `pilot.md` |

Chaque dossier de fonctionnalité (`01`/`02`/`03`) suit **le même gabarit de 16
fichiers** (voir `ground-truth-codebase.md` §5) : description du fonctionnement
optimal + éléments à vérifier/tester sous **tous** les angles
(backend / frontend / data / UI-UX / a11y / perf / sécurité / non-régression).

---

## 2. Le modèle mental en une image

```
                         AUJOURD'HUI (cassé — BUG-004)
  Pipeline A (LangGraph)                         Pipeline B (create-flow)
  video→voiceover→music→subtitles→compose   ──┐   UI /create : 1 image OU 1 clip
  →transcode→quality…                         │   (MediaStudio kind toggle)
        artefacts riches produits             │
                                              ▼
                       bridgeToContentStudio (A→B, UNIDIRECTIONNEL)
                       ne recopie que script/caption/hashtags/IMAGES
                       → voix-off / musique / sous-titres / montage  ✗ JETÉS
                       GenerationResult DTO n'a aucun champ pour eux  ✗

                         CIBLE (ce plan)
  D2 : DTO + bridge étendus (upsertBundleAssets) ── portent les 5 artefacts
  D1 : draft = bundle d'assets par rôle (primary_video|voiceover|music|subtitles|composed_video)
  D3 : services + routes per-draft (pipeline B) qui RÉUTILISENT les nœuds A
  D4 : panneau « Studio média » dans l'étape Visuel (pistes + Composer)
  D6 : additif, derrière flag CONTENT_STUDIO_MEDIA_STUDIO_ENABLED, zéro régression
```

---

## 3. Ordre d'exécution (résumé — détail dans le runbook)

`P0` Architecture/migration (`MP-AR-*`, **prérequis bloquant**) → `P1` Voix-off
(`MP-VO-*`) → `P2` Sous-titres (`MP-SU-*`) → `P3` Montage (`MP-CO-*`, consomme
P1+P2) → `P4` Intégration UI + bascule du flag → `P5` E2E + durcissement.
Entre chaque phase : la **boucle de correction-vérification**
([`04_test-battery/correction-loop.md`](04_test-battery/correction-loop.md)) jusqu'à
**vert deux fois de suite**, avec le gate **`tsc --noEmit`** (vitest ne typecheck
pas — deux casses de build l'ont prouvé cette semaine).

---

## 4. Invariants non négociables

- **`tsc --noEmit` est un gate de CI** (avant vitest). Voir `04_test-battery/ci-integration.yaml`.
- **MSW** pour tout HTTP provider (jamais `vi.stubGlobal('fetch')`) ; `onUnhandledRequest:'error'` prouve que les chemins `mock`/sans-clé ne font **aucun** appel réseau.
- **`dry_run` sacro-saint** : aucune publication réelle. `SOCIAL_PUBLISHING_MODE` jamais mis à `live`.
- **Additif + flaggé** : `generateVisualForDraft` et le flux 4 étapes restent intacts (prouvé par des tests de non-régression).
- **Réutilisation** : on enveloppe les nœuds ffmpeg/TTS/SRT existants, on ne les réimplémente pas.

---

## 5. Conventions

IDs de tâches : `MP-AR-*` (archi) · `MP-VO-*` (voix-off) · `MP-CO-*` (compose) ·
`MP-SU-*` (sous-titres) · `MP-TB-*` (tests) · `MP-RB-*` (runbook). Détail :
[`00_global/naming-conventions.md`](00_global/naming-conventions.md). Décisions
D1–D6 : [`00_global/decision-log.md`](00_global/decision-log.md). Inventaire
machine-lisible : [`manifest.yaml`](manifest.yaml).
