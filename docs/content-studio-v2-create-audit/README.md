# Audit Content Studio v2 — Page `/admin/content-studio-v2/create`

> **Version** : 1.0.0 — 2026-05-28
> **Auteur** : Audit UX/UI/Frontend/Backend exhaustif
> **Portée** : module `/admin/content-studio-v2/create` (ne couvre PAS `/admin/content-studio-v2/ai-engine/create` — module distinct)
> **Statut** : Audit + plan d'action validables — implémentation à exécuter via le runbook `00-runbook.md`

## 1. Pourquoi ce dossier existe

L'opérateur ne peut pas, depuis l'écran de création :

1. choisir le modèle de génération de texte (caption + variantes),
2. choisir le modèle de génération d'image / vidéo, avec une suggestion adaptée au format (post / story / reel / carousel),
3. atteindre l'étape 3 (Visuel) — le stepper reste verrouillé,
4. visualiser ou tester un mock vidéo pour valider le flux `reel`,
5. déclencher l'étape 4 (Valider) car le `postId` n'est jamais créé tant qu'un endpoint d'approbation explicite n'est pas appelé.

Le code backend, l'état React, le schéma DB et la batterie de tests sont incomplets pour adresser ces points. Le présent dossier formalise un audit, des propositions comparatives, un plan d'action phasé et un runbook reproductible.

## 2. Structure du dossier

```
docs/content-studio-v2-create-audit/
├── README.md                          # ce fichier
├── 00-runbook.md                      # pilote d'exécution du plan
├── 01-action-plan.md                  # plan phasé bout en bout
├── 02-architecture-overview.md        # carte du module (front + back + DB)
├── 03-current-state-audit.md          # ce qui existe aujourd'hui
├── 04-gaps-and-issues.md              # ce qui ne marche pas / manque
├── 05-test-strategy.md                # stratégie globale de tests
│
├── architecture/                      # diagrammes structurés
│   ├── flow-overview.puml             # séquence create end-to-end
│   ├── component-tree.puml            # hiérarchie React
│   ├── state-machine.puml             # transitions de ContentStatus
│   ├── data-model.md                  # tables Drizzle référencées
│   └── api-contracts.yaml             # catalogue des endpoints
│
├── features/                          # 19 sous-dossiers (F01-F19)
│   └── F<id>-<slug>/
│       ├── spec.md                    # comportement attendu
│       ├── current-state.md           # comportement actuel
│       ├── gaps.md                    # manques identifiés
│       ├── proposals.md               # 3 propositions comparatives + reco
│       ├── implementation-plan.md     # étapes d'implémentation
│       └── test-scenarios.yaml        # scénarios de test structurés
│
├── proposals/                         # propositions transverses
│   ├── P01-model-selector-pattern.md
│   ├── P02-step-unlock-logic.md
│   ├── P03-mock-mode-strategy.md
│   └── P04-autocomplete-per-format.md
│
├── data-contracts/                    # spécifications de contrats
│   ├── api-endpoint-catalog.yaml
│   ├── api-models-endpoint.yaml
│   ├── api-mock-video-endpoint.yaml
│   ├── draft-status-transitions.yaml
│   └── media-types.yaml
│
├── test-battery/                      # plan de tests dense
│   ├── 00-runbook.md
│   ├── 01-vitest-plan.md
│   ├── 02-playwright-plan.md
│   ├── 03-msw-handlers.yaml
│   ├── 04-test-matrix.csv
│   ├── 05-coverage-targets.md
│   ├── scenarios/
│   │   ├── S01-golden-path.md
│   │   ├── S02-model-switching.md
│   │   ├── S03-mock-video-flow.md
│   │   ├── S04-step-progression.md
│   │   ├── S05-budget-exhaustion.md
│   │   ├── S06-error-recovery.md
│   │   ├── S07-scheduling.md
│   │   └── S08-concurrent-edits.md
│   └── fixtures/
│       ├── mock-drafts.json
│       ├── mock-providers.json
│       └── mock-media.json
│
├── implementation/                    # exécution phasée
│   ├── phase-1-foundations.md
│   ├── phase-2-text-model-selector.md
│   ├── phase-3-media-model-selector.md
│   ├── phase-4-mock-video.md
│   ├── phase-5-step-progression.md
│   ├── phase-6-publish-validation.md
│   ├── phase-7-tests.md
│   └── rollback.md
│
└── ux-design/
    ├── interaction-spec.md
    ├── micro-copy.md
    ├── design-tokens.md
    └── wireframes/
        ├── current.puml
        ├── proposed-intention-with-model.puml
        ├── proposed-media-with-model.puml
        └── proposed-step-4-validate.puml
```

## 3. Comment l'utiliser

1. **Lire d'abord** `02-architecture-overview.md` → carte du module
2. **Comprendre les défauts** dans `03-current-state-audit.md` puis `04-gaps-and-issues.md`
3. **Choisir une approche** via `proposals/P0*` (propositions cross-cutting)
4. **Exécuter** via `00-runbook.md` qui orchestre `implementation/phase-*.md`
5. **Valider** via `test-battery/00-runbook.md`

## 4. Glossaire

| Terme | Sens dans ce dossier |
|-------|----------------------|
| **CS v2** | Content Studio v2 (par opposition à v1 `/admin/content-studio`) |
| **AI Engine** | Module distinct sous `/admin/content-studio-v2/ai-engine/*` — N'EST PAS dans la portée |
| **Draft** | Variante de contenu générée pour une idée (3 variantes par idée) |
| **Post** | Entité créée à l'approbation d'un draft, porteuse du `postId` et du planning |
| **Mock mode** | Mode où le backend retourne des réponses simulées sans appel LLM/image/vidéo réels |
| **Provider** | Fournisseur d'inférence (OpenAI, Anthropic, Google, etc.) |
| **Model registry** | Source de vérité des modèles disponibles par rôle (chat/image/video) |

## 5. Non-objectifs

Ce document n'aborde **pas** :
- L'AI Engine (`/admin/content-studio-v2/ai-engine/*`) — audit séparé existant
- Le calendrier Postiz au-delà de l'API `posts/[id]/schedule`
- Les analytics post-publication
- La gestion des comptes sociaux (intégrations OAuth)

Il aborde **exclusivement** les 5 problématiques opérateur listées en §1 sur la page `/admin/content-studio-v2/create`, du frontend au backend, avec sa batterie de tests et son runbook d'exécution.
