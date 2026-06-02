# OWBS — Optimistic Wizard & Background Lead Sync

> Dossier d'ingénierie pour découpler la saisie des formulaires lead (wizard de
> checkout + funnel chat) du réseau, afin que l'interaction frontend soit
> **instantanée** et que la persistance / les effets de bord (tracking, webhook,
> email) soient traités **en tâche de fond**, de façon **durable et sans perte**.

**Statut :** `DRAFT — prêt pour revue & implémentation`
**Date :** 2026-06-01 · **Auteur :** équipe FemiGlow · **Cible :** branche `feat/owbs-lead-background`
**Problème métier :** la latence par étape (1 RTT vers l'origine LiteSpeed mono-région, sans CDN, sur mobile/Maroc) gèle l'UI à chaque « Continuer » → friction → paniers abandonnés.

---

## Comment lire ce dossier

Ordre de lecture recommandé : **00 → 01 → 02 → 03 → 04 → 05**.

| # | Dossier | Livrable | Fichiers clés |
|---|---|---|---|
| 00 | [`00-conception/`](00-conception/) | Plan de conception + décisions | [`design.md`](00-conception/design.md), [`requirements.md`](00-conception/requirements.md), [`decisions/`](00-conception/decisions/) (ADR) |
| 01 | [`01-architecture/`](01-architecture/) | Architecture complète + diagrammes | [`architecture.md`](01-architecture/architecture.md), [`module-map.csv`](01-architecture/module-map.csv), [`diagrams/*.puml`](01-architecture/diagrams/) |
| 02 | [`02-data-flow/`](02-data-flow/) | Données & flux | [`data-model.md`](02-data-flow/data-model.md), [`data-dictionary.csv`](02-data-flow/data-dictionary.csv), [`flows.md`](02-data-flow/flows.md), [`schemas/*.schema.json`](02-data-flow/schemas/), [`api-contracts.json`](02-data-flow/api-contracts.json), [`state-transitions.csv`](02-data-flow/state-transitions.csv) |
| 03 | [`03-dev-plan/`](03-dev-plan/) | Plan de dev + plan d'action | [`dev-plan.md`](03-dev-plan/dev-plan.md), [`action-plan.md`](03-dev-plan/action-plan.md), [`tasks.csv`](03-dev-plan/tasks.csv), [`risks.csv`](03-dev-plan/risks.csv), [`definition-of-done.md`](03-dev-plan/definition-of-done.md) |
| 04 | [`04-tests/`](04-tests/) | Batterie de tests (Vitest/MSW/Playwright) | [`test-strategy.md`](04-tests/test-strategy.md), [`vitest-plan.md`](04-tests/vitest-plan.md), [`msw-plan.md`](04-tests/msw-plan.md), [`playwright-plan.md`](04-tests/playwright-plan.md), [`test-matrix.csv`](04-tests/test-matrix.csv), [`fixtures.json`](04-tests/fixtures.json) |
| 05 | [`05-runbook/`](05-runbook/) | Runbook d'exécution | [`runbook.md`](05-runbook/runbook.md), [`commands.txt`](05-runbook/commands.txt), [`rollout.md`](05-runbook/rollout.md), [`observability.md`](05-runbook/observability.md) |

Vocabulaire commun : [`glossary.md`](glossary.md).

---

## TL;DR de la solution

1. **`leadId` généré côté client** (`createId('cl')`) → les étapes ne dépendent plus d'attendre la création serveur.
2. **`goToStep()` optimiste** : l'UI avance **immédiatement** ; la mutation est poussée dans une **file de synchronisation** (`lead-sync-queue`) et envoyée en tâche de fond (non-awaited), avec `Idempotency-Key` (déjà géré) → retries sûrs.
3. **Endpoints serveur en `upsert`-by-`leadId`** → écritures dans le désordre / rejouées = idempotentes. Les rows `chat_lead` partielles continuent d'exister → **scanner « panier abandonné » + analytics de funnel préservés**.
4. **Flush de secours sur `pagehide`/`visibilitychange`** via `navigator.sendBeacon` → batch endpoint `/api/checkout/lead/sync` → aucune donnée saisie n'est perdue.
5. **Effets lourds durables** (tracking serveur, webhook) routés via un **`lead_event_outbox`** calqué sur le `email_outbox` existant + worker cron (retry, ordre, survie au restart) — hors du chemin requête.
6. **Conversion (`order`) reste synchrone** mais embarque le **snapshot complet** du lead → indépendante des écritures de fond.

Le tout derrière un flag `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (+ mirror `NEXT_PUBLIC_`), rollout progressif, kill-switch immédiat.

## Invariants non négociables

- **Aucune perte de lead** : toute donnée saisie et « validée » par l'utilisateur est persistée (au pire via beacon).
- **Idempotence de bout en bout** : rejouer une mutation N fois == 1 effet.
- **Préservation de l'abandon** : la détection panier abandonné + le funnel reposent sur les rows partielles → on continue d'écrire à chaque étape.
- **Conversion fiable** : la commande finale ne dépend jamais d'une écriture de fond encore en vol.
