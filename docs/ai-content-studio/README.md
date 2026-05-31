# AI Content Studio FemiGlow

> Dossier de cadrage pour un studio IA intégré à FemiGlow : génération, validation, orchestration, publication Postiz et boucle d’amélioration.
> Statut : prototype à concevoir, aucun code applicatif implémenté dans ce dossier.
> Date : 2026-05-14.

## Objectif

Créer un module admin robuste qui permet à FemiGlow de produire du contenu social fidèle à la maison : textes, images, variations de posts, carrousels, calendriers éditoriaux, validations humaines, programmation via Postiz, puis suivi des performances.

La direction retenue pour le prototype est volontairement prudente : **l’IA propose, la fondatrice valide, Postiz publie**. Le système ne doit pas publier automatiquement du contenu généré sans contrôle humain tant que les garde-fous de marque, conformité et qualité média ne sont pas prouvés.

## Structure du dossier

| Dossier | Rôle |
| --- | --- |
| `00-overview/` | Résumé, vision, sources et décision finale |
| `10-brainstorming/` | Brainstorming comparatif large, options et scoring |
| `20-product/` | Fonctionnalités, user stories, périmètre prototype |
| `30-architecture/` | Architecture cible, diagrammes, ADR |
| `40-data/` | Modèle de données, dictionnaire, schémas JSON |
| `50-backend/` | APIs, services, jobs, erreurs |
| `60-frontend/` | Routes admin, composants, états |
| `70-ui-ux-design/` | UI/UX, wireframes, design tokens spécifiques |
| `80-brand-safety/` | Charte IA, garde-fous, scoring éditorial et visuel |
| `90-integrations/` | Postiz, OpenAI, média FemiGlow, analytics, webhooks |
| `100-automation/` | Orchestration, files, planification, feedback loop |
| `110-tests/` | Stratégie tests et matrices |
| `120-plan/` | Plan de conception, développement et action |
| `130-runbook/` | Runbook d’exécution prototype et opérations |
| `annexes/` | Fichiers structurés : JSON, YAML, CSV, PUML, TXT |

## Lecture recommandée

1. [Résumé exécutif](00-overview/executive-summary.md)
2. [Brainstorming comparatif](10-brainstorming/brainstorming-comparatif.md)
3. [Décision finale stabilisée](00-overview/decision-finale.md)
4. [Architecture](30-architecture/architecture.md)
5. [Plan d’action](120-plan/action-plan.yaml)
6. [Runbook prototype](130-runbook/prototype-runbook.md)

