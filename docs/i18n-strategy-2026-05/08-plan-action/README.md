# 08 — Plan d'action i18n FemiGlow

> Index et TL;DR du plan d'action pour exécuter l'internationalisation FemiGlow sur **11 semaines** (Phase 0 → Phase 8) avec rollback, feature flags, et matrice de risques.

## TL;DR

- **Cible V1** : 3 locales (`fr` default, `ar` RTL, `en`)
- **Stack** : `next-intl` + path-based routing + JSON statique + DB CMS hybride
- **Wizard** : `WizardDictionary` CHA-231 conservé (pas de régression)
- **Durée totale** : 11 semaines (~75 JH effort + 540h cumulé toutes ressources)
- **Stratégie deploy** : feature flag `I18N_ENABLED` + canary 10% → 50% → 100%
- **Rollback** : ≤ 5 min via `I18N_ENABLED=false` Vercel env var

## Phases en 1 ligne

| # | Phase | Sem | But | Livrable clé |
|---|---|---|---|---|
| 0 | Étude validée | S0 | ADRs signés + GO/NO-GO | 8 ADRs + branche `feat/i18n-foundation` |
| 1 | Foundation | S1-S2 | Setup next-intl + routing + 1 page pilote | `/contact` en 3 locales |
| 2 | Content extraction | S3-S4 | Externaliser 600-800 strings | 6 routes × 3 locales + ESLint rule |
| 3 | CMS multilingue | S5 | UI admin onglets locale + repo | Composants CMS multilangues |
| 4 | RTL + AR | S6 | Logical properties + font Cairo | Site rendu correct en `/ar/*` |
| 5 | Workflow translateur | S7 | Export/import + doc + 1er round AR | `messages/ar.json` complet |
| 6 | Tests denses | S8-S9 | Pyramide complète + coverage gates | ~250 tests verts |
| 7 | Deploy + obs | S10 | Canary 10→50→100% + monitoring | i18n en prod stable |
| 8 | Stabilisation | S11 | Bug bash + a11y + perf + doc | Post-mortem signé |

## Documents du dossier

| Fichier | Contenu | Volume |
|---|---|---|
| [`README.md`](./README.md) | **Ce fichier** — Index et TL;DR | ~150 lignes |
| [`phases.md`](./phases.md) | **Plan détaillé pas-à-pas** des 9 phases avec tâches T<phase>.<n>, DoD, durées, dépendances, pièges | ~1100 lignes |
| [`checklist.md`](./checklist.md) | **Checklists exhaustives** par phase (200+ items vérifiables) | ~500 lignes |
| [`rollback.md`](./rollback.md) | **Procédures rollback** : triggers, commandes, snapshot DB, comm équipe, post-mortem template | ~450 lignes |
| [`feature-flags.md`](./feature-flags.md) | **Stratégie feature flags** : I18N_ENABLED, I18N_LOCALES_ACTIVE, I18N_RTL_ENABLED, I18N_CMS_BINDINGS_ENABLED | ~400 lignes |
| [`gantt.puml`](./gantt.puml) | **Gantt PlantUML** 11 semaines avec dépendances + milestones | ~120 lignes |
| [`risk-matrix.csv`](./risk-matrix.csv) | **Matrice de risques** 30+ lignes (tech, perf, UX, content, SEO, ops) | 30+ lignes |

## Ressources mobilisables

| Rôle | Allocation totale | Pic de charge |
|---|---|---|
| **Fondatrice** | ~30h | Phase 2 (validation voix FR), Phase 5 (validation AR), Phase 8 (bug bash) |
| **Lead technique** | ~108h | Phase 1 (foundation), Phase 6 (tests), Phase 7 (deploy) |
| **Dev** | ~248h | Phase 2 (extraction), Phase 6 (tests) |
| **Translateur AR** | ~32h | Phase 5 |
| **Translateur EN** | ~8h | Phase 2 |
| **QA** | ~112h | Phase 6 (tests), Phase 8 (a11y) |

## Milestones

- **M1** (fin S2) — Foundation OK : routing `/[locale]` opérationnel
- **M2** (fin S4) — Content extracted : ~700 strings externalisées
- **M3** (fin S5) — CMS multilingue : admin onglets locale
- **M4** (fin S6) — RTL ready : `/ar/*` rendu sans régression LTR
- **M5** (fin S9) — Tests pass : ~250 tests verts, 0 flaky
- **M6** (fin S10) — Deploy 100% : i18n en prod, monitoring vert
- **M7** (fin S11) — Stable : bug bash exécuté, post-mortem signé

## Conditions critiques de succès

### Techniques

1. **Ne PAS toucher au wizard CHA-231** : `WizardDictionary` reste tel quel
2. **Pas de plugin Tailwind RTL** : logical properties only (cf. ADR-005)
3. **Migration progressive route par route** : pas de big-bang
4. **Feature flag `I18N_ENABLED`** : rollback en moins de 5 min
5. **Canary obligatoire** : 10% → 50% → 100% avec observation

### Process

1. **ADRs avant code** : 8 décisions tracées avant phase 1
2. **Glossaire FR-AR** : avant traduction phase 5
3. **Validation native speaker AR-MA** : avant deploy
4. **Bug bash final** : avant clôture projet

### KPIs à monitorer en deploy

- Conversion FR stable (±5%)
- Locale distribution attendue (~80% FR, ~10% AR, ~10% EN initial)
- Error rate Sentry < baseline + 10%
- LCP < 2.5s sur 3 locales
- WCAG ≥ 95% sur 3 locales

## Risques top 5

(détails complets dans [`risk-matrix.csv`](./risk-matrix.csv))

| Risque | Sévérité | Mitigation principale |
|---|---|---|
| Drift de clés FR↔AR↔EN | Élevée | TS module augmentation + ESLint rule + tests automatiques de complétude |
| RTL casse layout existant | Élevée | Logical properties + visual regression complète |
| Bundle size +30% | Moyenne | Lazy load messages par route, audit Lighthouse CI |
| Translator AR retourne junk | Moyenne | Glossaire détaillé + review native speaker obligatoire |
| SEO penalty (duplicate content) | Élevée | hreflang + canonicals + sitemap multilangue |

## Points de décision critiques (Go/No-Go)

Voir [`phases.md` § Conditions de Go / No-Go entre phases](./phases.md#conditions-de-go--no-go-entre-phases).

Chaque transition de phase nécessite :
- Tous critères verts (aucun rouge)
- Signoff lead technique
- Signoff fondatrice pour phases 0, 2, 5, 7, 8

## Workflow de mise à jour de ce plan

1. **Avant kickoff** : étude validée par fondatrice + lead, plan signé
2. **Pendant exécution** : tracking dans outil PM (Linear/JIRA) avec IDs `T<phase>.<n>`
3. **À chaque fin de phase** : checklist `checklist.md` cochée + retro phase courte
4. **À la fin** : post-mortem dans `docs/i18n-strategy-2026-05/00-context/post-mortem.md`

## Liens externes

- [`../README.md`](../README.md) — Étude i18n complète
- [`../00-context/etat-actuel.md`](../00-context/etat-actuel.md) — Audit état actuel
- [`../01-options-techniques/recommendation.md`](../01-options-techniques/recommendation.md) — Recommandation `next-intl`
- [`../11-test-execution/`](../11-test-execution/) — Boucle correction tests
- [`../09-runbook/`](../09-runbook/) — Runbooks opérationnels

## Statut

- ⏳ **Draft** — En attente validation fondatrice + lead technique
- Une fois validé, basculer en `Validé` et démarrer Phase 1

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
