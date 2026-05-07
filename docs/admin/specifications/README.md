# Spécifications — Interface d'administration FemiGlow

> **Statut.** Dossier de spécifications complètes, livré à la manière d'un
> cabinet d'ingénierie : un dossier par discipline, avec ses propres
> formats (Markdown, CSV, PlantUML, JSON, YAML, SQL, .env). Conçu pour
> servir de **référence unique** pendant l'implémentation, la revue
> qualité et la mise en production.
>
> Tous les choix structurants sont issus de la **recommandation finale**
> consolidée dans [`../recommandation-finale.md`](../recommandation-finale.md).
> Aucune décision n'est rouverte ici : ce dossier précise *comment* mettre
> en œuvre, pas *quoi* construire.

---

## 0. Conventions

| Convention | Détail |
|---|---|
| Langue | français pour la prose, anglais pour les identifiants techniques (`leadStatus`, `webhookEndpoint`) |
| Diagrammes | PlantUML (`.puml`) — rendu via VS Code PlantUML, IntelliJ, ou `plantuml.jar` |
| Tableaux à exploiter | CSV (`.csv`) — importables dans Notion / Linear / Excel pour pilotage |
| API contracts | OpenAPI 3.1 (`.yaml`) — source de vérité pour le SDK et les mocks MSW |
| Données structurées | JSON pour tokens design, YAML pour l'API |
| Schéma DB | SQL `CREATE TABLE` annoté + ERD PlantUML |
| Variables d'env | `.env.example` versionné, jamais de valeurs réelles |
| Commits référencés | format `[ADM-NN] type: titre` (NN = numéro de tâche atomique du plan d'action) |

---

## 1. Plan du dossier

```
docs/admin/specifications/
├── README.md                                ← ce fichier
│
├── 00-vue-ensemble/                         vision globale, glossaire
│   ├── executive-summary.md
│   ├── glossaire.md
│   ├── invariants.md
│   └── parties-prenantes.md
│
├── 01-architecture/                         vue tech globale
│   ├── README.md
│   ├── architecture-globale.puml            ← C4 niveau Container
│   ├── architecture-deploiement.puml        ← Vercel + Neon
│   ├── flux-authentification.puml
│   ├── flux-creation-lead.puml
│   ├── flux-webhook-tick.puml
│   ├── modele-conteneurs.puml
│   ├── decisions-techniques.md
│   └── adr/
│       ├── adr-001-iron-session.md
│       ├── adr-002-postgres-drizzle.md
│       ├── adr-003-queue-cron-webhook.md
│       ├── adr-004-route-group-admin.md
│       ├── adr-005-server-components.md
│       └── adr-006-msw-pour-tests.md
│
├── 02-design-system/                        UI fondations
│   ├── README.md
│   ├── tokens.json                          ← design tokens (W3C-like)
│   ├── palette.csv                          ← couleurs sémantiques admin
│   ├── typographie.md
│   ├── spacing-grid.md
│   ├── composants-admin.md                  ← inventaire composants
│   ├── etats-interactifs.md
│   ├── iconographie.md
│   └── voix-redactionnelle.md
│
├── 03-ux-navigation/                        UX
│   ├── README.md
│   ├── personas.md
│   ├── parcours-utilisateur.md
│   ├── arborescence.txt                     ← sitemap textuel
│   ├── sitemap-admin.puml
│   ├── wireframes-textuels.md               ← ASCII wireframes
│   ├── ergonomie.md
│   └── accessibilite.md
│
├── 04-frontend/                             specs frontend
│   ├── README.md
│   ├── structure-fichiers.txt
│   ├── routing.md
│   ├── components-tree.puml
│   ├── state-management.md
│   ├── form-handling.md
│   ├── data-fetching.md
│   ├── rendering-strategy.md
│   ├── error-boundaries.md
│   └── pages/
│       ├── login.md
│       ├── dashboard.md
│       ├── leads-list.md
│       ├── leads-detail.md
│       ├── webhooks-list.md
│       ├── webhook-form.md
│       └── webhook-deliveries.md
│
├── 05-backend/                              specs backend
│   ├── README.md
│   ├── structure-fichiers.txt
│   ├── api-endpoints.md
│   ├── api-openapi.yaml                     ← contrat API complet
│   ├── middleware.md
│   ├── auth-flow.md
│   ├── webhook-engine.md
│   ├── cron-jobs.md
│   ├── error-handling.md
│   ├── rate-limiting.md
│   ├── validation-zod.md
│   └── logging-observabilite.md
│
├── 06-data/                                 schéma & migrations
│   ├── README.md
│   ├── schema.sql                           ← DDL complet annoté
│   ├── schema-erd.puml
│   ├── tables.csv                           ← inventaire tables/colonnes
│   ├── indexes.md
│   ├── relations.md
│   ├── migrations-strategy.md
│   ├── seeds.md
│   └── retention-policy.md
│
├── 07-securite/                             sécurité & conformité
│   ├── README.md
│   ├── threat-model.md                      ← STRIDE
│   ├── controles.csv
│   ├── chiffrement.md
│   ├── rgpd-loi-09-08.md
│   ├── headers-csp.md
│   ├── audit-trail.md
│   └── incident-response.md
│
├── 08-tests/                                stratégie qualité
│   ├── README.md
│   ├── strategie.md
│   ├── matrice-couverture.csv
│   ├── definition-of-done-tests.md
│   ├── lint/
│   │   ├── eslint-config.md
│   │   ├── prettier.md
│   │   └── typecheck.md
│   ├── unit-vitest/
│   │   ├── README.md
│   │   ├── liste-tests.csv
│   │   ├── auth-password.spec.md
│   │   ├── auth-session.spec.md
│   │   ├── auth-rate-limit.spec.md
│   │   ├── webhook-mapper.spec.md
│   │   ├── webhook-signer.spec.md
│   │   ├── webhook-backoff.spec.md
│   │   ├── lead-projection.spec.md
│   │   └── env-validation.spec.md
│   ├── integration-msw/
│   │   ├── README.md
│   │   ├── handlers-architecture.md
│   │   ├── scenarios.csv
│   │   ├── scenario-login-success.md
│   │   ├── scenario-login-failure.md
│   │   ├── scenario-login-rate-limit.md
│   │   ├── scenario-session-expired.md
│   │   ├── scenario-leads-list.md
│   │   ├── scenario-leads-filters.md
│   │   ├── scenario-leads-pagination.md
│   │   ├── scenario-leads-detail.md
│   │   ├── scenario-leads-status-change.md
│   │   ├── scenario-leads-note-add.md
│   │   ├── scenario-leads-export-csv.md
│   │   ├── scenario-webhook-create.md
│   │   ├── scenario-webhook-update.md
│   │   ├── scenario-webhook-delete.md
│   │   ├── scenario-webhook-toggle.md
│   │   ├── scenario-webhook-delivery-success.md
│   │   ├── scenario-webhook-delivery-retry.md
│   │   ├── scenario-webhook-delivery-final-fail.md
│   │   ├── scenario-webhook-replay.md
│   │   ├── scenario-cron-tick-batch.md
│   │   ├── scenario-cron-tick-empty.md
│   │   ├── scenario-cron-unauthorized.md
│   │   ├── scenario-public-form-contact.md
│   │   ├── scenario-public-form-checkout.md
│   │   └── scenario-public-form-newsletter.md
│   ├── e2e-playwright/
│   │   ├── README.md
│   │   ├── playwright-config.md
│   │   ├── scenarios.csv
│   │   ├── e2e-login-flow.md
│   │   ├── e2e-leads-management.md
│   │   ├── e2e-webhook-management.md
│   │   └── e2e-end-to-end-lead.md
│   └── accessibilite/
│       ├── README.md
│       ├── jest-axe-checklist.md
│       └── manuel-keyboard-screenreader.md
│
├── 09-environnement/                        env & déploiement
│   ├── README.md
│   ├── env-variables.csv
│   ├── env.example
│   ├── deploiement-vercel.md
│   ├── neon-postgres.md
│   ├── secrets-rotation.md
│   ├── monitoring.md
│   └── runbook-incident.md
│
└── 10-plan-action/                          exécution
    ├── README.md
    ├── roadmap.md
    ├── phases.md
    ├── taches-atomiques.csv                 ← backlog référentiel
    ├── dependencies.puml
    ├── definition-of-done.md
    ├── criteres-acceptation.md
    ├── checklist-go-live.md
    └── plan-rollback.md
```

---

## 2. Comment lire ce dossier selon votre rôle

| Rôle | Entrée recommandée |
|---|---|
| Décideur / sponsor | [`00-vue-ensemble/executive-summary.md`](./00-vue-ensemble/executive-summary.md) puis [`10-plan-action/roadmap.md`](./10-plan-action/roadmap.md) |
| Architecte | [`01-architecture/`](./01-architecture/) puis [`05-backend/api-openapi.yaml`](./05-backend/api-openapi.yaml) et [`06-data/schema.sql`](./06-data/schema.sql) |
| Développeur frontend | [`04-frontend/`](./04-frontend/) + [`02-design-system/`](./02-design-system/) + [`03-ux-navigation/`](./03-ux-navigation/) |
| Développeur backend | [`05-backend/`](./05-backend/) + [`06-data/`](./06-data/) + [`07-securite/`](./07-securite/) |
| QA / Test engineer | [`08-tests/`](./08-tests/) — stratégie + scénarios MSW |
| DevOps / SRE | [`09-environnement/`](./09-environnement/) + [`07-securite/incident-response.md`](./07-securite/incident-response.md) |
| Product / PM | [`03-ux-navigation/parcours-utilisateur.md`](./03-ux-navigation/parcours-utilisateur.md) + [`10-plan-action/`](./10-plan-action/) |
| DPO / juridique | [`07-securite/rgpd-loi-09-08.md`](./07-securite/rgpd-loi-09-08.md) + [`06-data/retention-policy.md`](./06-data/retention-policy.md) |

---

## 3. Statut et versionnement

| Champ | Valeur |
|---|---|
| Version du dossier | `1.0.0` |
| Date d'établissement | 2026-05-03 |
| Auteur principal | équipe technique FemiGlow |
| Cible d'implémentation | Q2/Q3 2026 |
| Référentiel de décision | [`../recommandation-finale.md`](../recommandation-finale.md) |
| Pré-requis lecture | audit + 4 docs faisabilité (`01` à `04`) |

Toute modification structurante (ajout d'un service externe, changement
d'ORM, nouveau provider d'auth) doit être actée par un nouvel **ADR** dans
[`01-architecture/adr/`](./01-architecture/adr/) avec incrément du numéro.

---

## 4. Engagements de qualité

Ce dossier est **livré complet** avant qu'une seule ligne de code admin ne
soit écrite. Il est conçu pour permettre :

- **Découpage en tâches atomiques** : chaque feature = N tâches < 4 h dans
  [`10-plan-action/taches-atomiques.csv`](./10-plan-action/taches-atomiques.csv).
- **Couverture test exhaustive** : chaque endpoint, chaque transition de
  statut, chaque cas d'erreur ont leur scénario MSW et leur test Vitest
  (voir [`08-tests/matrice-couverture.csv`](./08-tests/matrice-couverture.csv)).
- **Revue indépendante** : un ingénieur extérieur peut auditer
  l'implémentation contre ces specs sans avoir lu une ligne du code.
- **Reproductibilité** : tout l'environnement (env vars, migrations,
  seeds, cron) est documenté pour onboarding < 1 jour.
