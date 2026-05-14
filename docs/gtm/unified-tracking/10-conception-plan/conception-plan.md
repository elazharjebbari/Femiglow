# Plan de conception

## 1. Vision

Faire de l'administration tracking de FemiGlow une expérience **simple, sûre et cohérente** : un seul endroit pour gérer tout le tracking (providers, IDs, événements, environnements), avec une UX adaptée au public (Amal — marketing, pas dev) tout en gardant un mode expert pour Younes.

## 2. Constat — pourquoi rebâtir

Le système actuel souffre de :
1. **Deux JSON GTM** divergents (`builders.ts` vs `gtm-export.ts`) produisant des duplicates de tags.
2. **Trois tables** indépendantes (`trackingProviders`, `eventMappingVersions`, `trackingSettings`) → désynchronisations.
3. **Routes admin éclatées** : `/admin/tracking`, `/admin/tracking/pixels`, `/admin/tracking/gtm`, `/admin/tracking/gtm/configurations`, `/admin/tracking/mappings`. Amal navigue 5 pages pour un changement.
4. **Aucune autocomplétion** : à chaque création de plan, ressaisie manuelle des IDs.
5. **Pas de validation pré-publish** : possibilité d'activer un plan avec `G-PROD0000` placeholder en prod.
6. **Drift detector** indique un problème mais ne propose pas de remédiation guidée.

## 3. Objectifs

### Objectifs primaires (must-have)

| # | Objectif | Mesure de succès |
|---|---|---|
| O1 | Unifier tracking en 1 source unique (TrackingPlan) | 0 divergence entre IDs admin et JSON GTM |
| O2 | Réduire le temps "changer un Pixel" de 15 min à < 5 min | Mesure user testing avec Amal |
| O3 | Éliminer les placeholders en production | 0 plan actif avec `G-PROD0000`, etc. |
| O4 | Wizard guidé pour 90% des cas | Adoption > 80% sur 60 jours |
| O5 | Mode expert pour cas avancés (Younes) | Réutilisation par dev pour debug |

### Objectifs secondaires (should-have)

| # | Objectif | Mesure |
|---|---|---|
| O6 | Auto-prefill IDs depuis last active plan | 100% des champs IDs prérenseignés sur edit |
| O7 | Diff avant activation | Modal diff visible, accepté par utilisateur |
| O8 | Audit complet append-only | Trigger DB testé, immuable |
| O9 | i18n fr + ar (RTL) | Tests Playwright passants sur les deux locales |
| O10 | Accessibilité WCAG 2.1 AA | axe-core CI : 0 violation |

### Objectifs tertiaires (could-have, post-MVP)

| # | Objectif |
|---|---|
| O11 | Test runner d'événements (mode debug) |
| O12 | OAuth GTM (auto-deploy du JSON dans GTM container) |
| O13 | Dark mode |
| O14 | Templates de plans (e.g. "E-commerce starter") |

## 4. Périmètre

### Inclus

- Refonte data model (TrackingPlan unifié).
- Refonte backend (TrackingPlanService, API REST, validation server).
- Refonte UI (wizard + expert + home + sync + history).
- Refonte UX (5 personas, 5 journeys principaux).
- Refonte design system (tokens tracking).
- i18n fr + structures pour ar (sans traduction complète en MVP).
- Tests Jest + Playwright + MSW + intégration ultime.
- Runbook deploy/rollback/incident.
- Documentation complète.

### Exclus (hors scope)

- Refonte du chat support (sauf intersections définies dans 09-ergonomics).
- Refonte du legal (séparé).
- OAuth automatique GTM (v2).
- Notion d'A/B test sur tracking plan.
- Multi-tenant (FemiGlow Maroc unique).

## 5. Hypothèses

1. Le volume de plans actifs simultanés est ≤ 5 (1 actif + 4 archivés/draft).
2. Le volume d'événements par plan est ≤ 30.
3. Le volume de providers est ≤ 10 (ga4, ads, meta, tiktok, snapchat, pinterest, gtm, et 3 réservés futurs).
4. La fréquence de modification d'un plan en prod est ≤ 5 fois par mois.
5. L'équipe technique acceptera la migration non destructive (legacy renommée, drop à T+90).

## 6. Contraintes

| Contrainte | Source |
|---|---|
| Continuité de service | Pas de downtime acceptable |
| Compatibilité GTM container existant | `GTM-M8K7V88D` ne change pas |
| Compliance Loi 09-08 Maroc | Audit + consent mode obligatoires |
| Budget : 1 dev sénior 6 sprints | Younes uniquement, pas de renfort |
| Pas de nouveau service externe | Pas d'ajout de dépendance lourde (Redis, etc.) |
| Stack imposée | Next.js 15, Drizzle, PostgreSQL, TanStack Query, Zustand |

## 7. Jalons de conception (M0–M5)

Voir [milestones.csv](milestones.csv) pour détail.

| Jalon | Livrable | Cible |
|---|---|---|
| M0 | Document conceptuel approuvé | Validation produit |
| M1 | Dossier technique complet | Cette présente documentation |
| M2 | Prototype Figma haute fidélité | Validation design |
| M3 | Backend + data migré sur staging | Tests fonctionnels API passants |
| M4 | Frontend wizard + expert intégrés | Tests E2E happy path passants |
| M5 | Tous tests passants + runbook prêt | Décision GO/NO-GO production |

## 8. Validation et acceptance

### Critères de succès (Definition of Done global)

- [ ] Tous les tests unitaires passent (≥ 80% couverture sur `lib/tracking/`).
- [ ] Tous les tests E2E passent (Playwright fr + ar).
- [ ] Test ultime d'intégration passe (cf. section 14).
- [ ] Migration testée en dry-run sur copie de prod.
- [ ] Rollback testé sur staging.
- [ ] Documentation à jour (cette présente folder).
- [ ] Runbook validé par lead dev.
- [ ] Onboarding session Amal réalisée + feedback positif.

### Validations intermédiaires

- **Design review** : Maquette Figma validée par Amal + Aïcha avant code.
- **API review** : OpenAPI 3.1 validé par Younes + lead avant impl.
- **Code review** : Chaque PR review par 2 personnes minimum (l'une senior).
- **Security review** : Audit endpoints admin + secrets handling.
- **Performance review** : Lighthouse + benchmark API (p95 < cibles).

## 9. Stakeholders

| Personne | Rôle | Implication |
|---|---|---|
| Amal | Marketing Manager | User testing + feedback UX (high) |
| Younes | Dev fullstack | Implémentation (very high) |
| Aïcha | CMO | Validation produit (low) |
| Lead dev | Architecte technique | Architecture review (high) |
| DPO / Legal | Conformité 09-08 | Validation consent (medium) |

## 10. Communication

- **Pendant conception** : revue hebdo de la doc avec lead.
- **Pendant dev** : standup quotidien Younes + lead.
- **Avant chaque release** : démo Amal + Aïcha.
- **Post-release** : feedback 7j post-launch.

## 11. Sortie

Une fois ce plan validé :
- Le **dev plan** (section 11) prend le relais avec tickets, estimations, planning.
- Le **plan d'action** (section 12) détaille les phases concrètes.
- Le **runbook** (section 13) est prêt avant la première mise en prod.
- La **batterie de tests** (section 14) est implémentée en parallèle du code.
