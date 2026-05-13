# Pages légales — Dossier technique complet

> Système de gestion des pages légales FemiGlow : admin éditable, design
> cohérent, exclusion SEO automatique, vérification liens, **9 pages
> préconfigurées pour le contexte marocain** (e-commerce cosmétique).
>
> **Phase 1** : [`CONCEPTUAL-ANALYSIS.md`](./CONCEPTUAL-ANALYSIS.md) — 6 chantiers × 3 approches + reco
> **Phase 2** : sous-dossiers ci-dessous

## Index des sous-dossiers

| # | Dossier | Format(s) | Objet |
|---|---|---|---|
| 00 | [00-overview/](./00-overview/) | .md | Exec summary, glossaire, success criteria, stakeholders, **références légales Maroc** |
| 10 | [10-architecture/](./10-architecture/) | .md .puml | Diagrammes composants & séquences, ADRs |
| 20 | [20-data/](./20-data/) | .txt .csv .json .puml | Schémas DB, migrations, seed pages |
| 30 | [30-backend/](./30-backend/) | .md .yaml | API, MD rendering, SEO, link verification |
| 40 | [40-frontend/](./40-frontend/) | .md .json .yaml | Composants, wizards, editor design |
| 50 | [50-ui-ux-design/](./50-ui-ux-design/) | .md | Wireframes, design tokens, ergonomie, a11y |
| 60 | [60-content/](./60-content/) | .md | ★ **9 pages légales préconfigurées** + style guide |
| 70 | [70-tests/](./70-tests/) | .csv .md .json | Matrice Jest + MSW + Playwright + e2e ultime |
| 80 | [80-runbook/](./80-runbook/) | .md | Deploy, rollback, **process de revue légale** |
| 90 | [90-plan/](./90-plan/) | .csv .yaml .md | Dev plan, action plan, risks, decisions |

## Conventions

- `.md` : documentation humaine
- `.puml` : diagrammes UML (PlantUML)
- `.csv` : tables structurées (test matrix, dev plan)
- `.yaml` : config séquencée (action plan, API contracts)
- `.json` : config strictement typée (wizard steps, fixtures, seed)
- `.txt` : schémas DB en texte brut

## Périmètre

**In scope** :
- Système CRUD pages légales (admin)
- Éditeur MD avec preview live
- Placement multi-zones configurable
- SEO `noindex` par défaut + opt-in
- Vérification de liens (build + cron)
- 9 pages pré-rédigées contexte FemiGlow / Maroc
- Versioning DB + export git automatique
- Tests Jest + MSW + Playwright

**Out of scope V1** :
- Multi-langue (FR seulement en V1 ; AR en V2)
- WYSIWYG riche (resté en MD raw + preview)
- Workflow approbation multi-niveau (à 2 admins en V2)
- Notifications email aux co-admins (V2)
- Recherche full-text dans le contenu (V2)

## Disclaimer

⚠ Les contenus légaux dans `60-content/` sont des **templates fonctionnels**
rédigés sur la base des bonnes pratiques e-commerce marocain et de la
législation accessible publiquement. **Une validation par un juriste
qualifié est obligatoire** avant publication en production. Le templating
n'est pas un conseil juridique.

## Statut

🟢 **Dossier technique complet** — 75+ fichiers couvrant tous les aspects.
Prêt à servir de référence d'implémentation. Phase de développement
estimée : 35 jours (7 semaines), équipe de 3 (cf. `90-plan/action-plan.yaml`).

## Récapitulatif livraisons

- **Phase 1** : Analyse conceptuelle (`CONCEPTUAL-ANALYSIS.md`)
- **Phase 2** : 75+ fichiers répartis sur 10 sous-dossiers
- **★ Highlight** : `60-content/` contient les **9 pages légales prêtes à seeder** + style guide
- **Tests** : `70-tests/end-to-end-validation.md` propose un test ultimate en 16 étapes
- **Plan exécutable** : `90-plan/dev-plan.csv` détaille 50+ tâches avec dépendances
