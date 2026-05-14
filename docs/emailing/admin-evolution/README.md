# M5 — Admin emailing evolution — Dossier technique

> **Phase 2** du chantier M5. La phase 1 (analyse conceptuelle) vit dans
> `docs/emailing/14-admin-ui-evolution-concept.md`. Ce dossier-ci est
> l'**implémentation blueprint** : data, backend, frontend, UX, design,
> tests, runbook.

## 🗺 Navigation

```
admin-evolution/
├── README.md                          ← tu es ici
├── 00-architecture/                   Vue système, ADRs, séquences
├── 01-data/                           Schémas SQL, migrations, indexes
├── 02-backend/                        APIs, server actions, engines
├── 03-frontend/                       Routes, composants, state, fetching
├── 04-ui-ux/                          ⭐ Wizard specs, mockups, états
├── 05-design/                         Tokens, typo, color, motion
├── 06-ergonomie/                      Raccourcis clavier, a11y, feedback
├── 07-analytics/                      Events admin à tracker
├── 08-plan-conception/                Décisions design, tradeoffs
├── 09-plan-developpement/             Phases M5.1-M5.6 (YAML par phase)
├── 10-plan-action/                    ⭐ Runbook maître, tickets, semaines
├── 11-tests/                          Jest, MSW, Playwright + test ultime
└── 12-runbook/                        Incidents, rollback, monitoring
```

## 🎯 Comment utiliser ce dossier

### Tu es développeur qui démarre une phase

1. Lire [10-plan-action/00-runbook-master.md](10-plan-action/00-runbook-master.md)
2. Repérer la phase courante (M5.x) dans
   [09-plan-developpement/](09-plan-developpement/)
3. Suivre la checklist du runbook pour cette phase — chaque étape pointe
   vers le fichier de référence (schéma data, spec API, composant, test)
4. Écrire le code en cochant les tests atomiques au fur et à mesure
5. Sortir de la phase quand le test ultime de la phase passe

### Tu es designer / PO qui veut comprendre le produit

1. [Le concept doc](../14-admin-ui-evolution-concept.md) (overview
   stratégique)
2. [04-ui-ux/01-wizard-spec-master.md](04-ui-ux/01-wizard-spec-master.md)
   (spec UX détaillée des wizards)
3. [04-ui-ux/02-mockups/](04-ui-ux/02-mockups/) (mockups ASCII pour
   chaque écran)
4. [06-ergonomie/](06-ergonomie/) (interactions clavier, a11y)

### Tu es ops qui dois déployer / dépanner

1. [12-runbook/](12-runbook/) (incidents probables, rollback, monitoring)
2. [10-plan-action/00-runbook-master.md](10-plan-action/00-runbook-master.md)
   §"Déploiement par phase"

## 🧱 Principes directeurs (à respecter dans toute contribution)

| Principe | Implication concrète |
|---|---|
| **Robuste** | Toute erreur backend logguée + remontée propre, fallback UI |
| **Maintenable** | Pas de magic numbers ; types Zod partagés client/serveur |
| **Debuggable** | Logs structurés (event, context), trace ID par request |
| **Ergonomique** | Cmd-K partout, raccourcis clavier, feedback < 100ms |
| **Élégant** | Tokens design centralisés, micro-copy soigné |
| **Structuré** | 1 composant = 1 fichier, 1 query = 1 fonction nommée |
| **Modulable** | Pas de couplage entre sections (transac / camp / auto) |
| **Évolutif** | Schémas extensibles (jsonb pour rules), versionning step |
| **Fonctionnel** | Pas de feature flag traînant, pas de TODO en prod |
| **Optimisé** | Index DB sur queries chaudes ; preview audience < 3s |

## 📋 Statut global

| Phase | Doc | Status |
|---|---|---|
| **M5.1** Inbox transactionnelle | [phase-m5.1](09-plan-developpement/01-phase-m5.1-transactional.yaml) | 📋 spec écrite |
| **M5.2** Events unifiés | [phase-m5.2](09-plan-developpement/02-phase-m5.2-user-events.yaml) | 📋 spec écrite |
| **M5.3** Audiences | [phase-m5.3](09-plan-developpement/03-phase-m5.3-audiences.yaml) | 📋 spec écrite |
| **M5.4** Campaigns intégrées | [phase-m5.4](09-plan-developpement/04-phase-m5.4-campaigns.yaml) | 📋 spec écrite |
| **M5.5** Automation studio | [phase-m5.5](09-plan-developpement/05-phase-m5.5-automation.yaml) | 📋 spec écrite |
| **M5.6** Polish ergonomie | [phase-m5.6](09-plan-developpement/06-phase-m5.6-polish.yaml) | 📋 spec écrite |
| **M5.7** Éditeur templates HTML + preview + variables | [phase-m5.7](09-plan-developpement/07-phase-m5.7-templates.yaml) | 📋 spec écrite |

## 🔗 Liens d'index

- **Architecture** : [00-overview](00-architecture/00-overview.md) · [ADRs](00-architecture/05-adr.md) · [séquences PUML](00-architecture/)
- **Data** : [tables](01-data/01-tables.md) · [migrations](01-data/03-migrations-plan.md) · [indexes](01-data/04-indexes.md) · [queries](01-data/05-queries-catalog.md)
- **Backend** : [endpoints](02-backend/01-api-endpoints.md) · [server actions](02-backend/02-server-actions.md) · [rules compiler](02-backend/03-rules-compiler.md) · [snapshot engine](02-backend/04-snapshot-engine.md) · [automation runner V2](02-backend/06-automation-runner-v2.md)
- **Frontend** : [routes](03-frontend/01-routes-map.md) · [composants](03-frontend/02-components-catalog.md) · [state](03-frontend/03-state-management.md) · [Cmd-K](03-frontend/04-cmd-k-palette.md)
- **UX** : [⭐ wizards](04-ui-ux/01-wizard-spec-master.md) · [empty states](04-ui-ux/03-empty-states.md) · [microcopy](04-ui-ux/05-microcopy.md)
- **Tests** : [stratégie](11-tests/00-strategy.md) · [test ultime](11-tests/03-playwright-e2e/00-ultimate-validation.spec.md)

## 📐 Conventions

| Type | Convention |
|---|---|
| Identifiants tables | `email_*` (cohérent avec l'existant) |
| Slugs (audiences, automations) | kebab-case, immutable une fois créé |
| Server actions | `verbObject()` ex `createAudience()`, `previewAudienceSize()` |
| Components | `PascalCase`, fichier = nom du composant exporté |
| Tests files | `*.test.ts` (Jest), `*.spec.ts` (Playwright) |
| MSW handlers | `mocks/handlers/<feature>.ts` |

## 🪜 Ordre recommandé de lecture

1. Le concept doc (déjà lu si tu es ici)
2. [10-plan-action/00-runbook-master.md](10-plan-action/00-runbook-master.md) — **le pilote**
3. [00-architecture/00-overview.md](00-architecture/00-overview.md) — vue système
4. [01-data/01-tables.md](01-data/01-tables.md) — modèle de données
5. [04-ui-ux/01-wizard-spec-master.md](04-ui-ux/01-wizard-spec-master.md) — UX
6. Tout le reste selon ton rôle.

---
_Dossier vivant — toute modif d'API/schéma doit mettre à jour son fichier._
