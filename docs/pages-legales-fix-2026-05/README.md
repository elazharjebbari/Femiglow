# Plan de fix complet — Module Pages légales (2026-05)

> **Objectif** : résoudre définitivement les 5 dysfonctionnements identifiés dans [`docs/pages-legales-audit-2026-05/`](../pages-legales-audit-2026-05/) — drift naming, vars manquantes, exposition données sensibles, pages orphelines, prénom fondatrice.
> **Date cible ship** : J+7 (1 semaine bout-en-bout, T0→T6).
> **Niveau d'exigence** : robuste, non-régressif, modulaire, testé à 4 niveaux (vitest + MSW + Playwright + smoke).

## Sommaire des 9 sous-dossiers

| # | Dossier | Aspect | Lecture |
|---|---|---|---|
| 0 | [`00-context/`](./00-context/) | Récap audit + glossaire + ADRs | 10 min |
| 1 | [`01-design-conception/`](./01-design-conception/) | Architecture cible + data model + contrats + flow diagrams | 20 min |
| 2 | [`02-backend/`](./02-backend/) | Migration SQL + queries Drizzle + helpers + endpoints | 30 min |
| 3 | [`03-frontend-ui-ux/`](./03-frontend-ui-ux/) | Pages admin modifiées + composants + design tokens + a11y | 20 min |
| 4 | [`04-data-strategy/`](./04-data-strategy/) | Backfill + audit SQL + monitoring | 15 min |
| 5 | [`05-tests/`](./05-tests/) | Unit + MSW + Playwright + suite non-régressive | 30 min |
| 6 | [`06-plan-action/`](./06-plan-action/) | Phases T0→T6 + checklist DoD + rollback | 15 min |
| 7 | [`07-runbook/`](./07-runbook/) | Exécution + vérifications staging + déploiement prod | 20 min |
| 8 | [`08-monitoring-post-deploy/`](./08-monitoring-post-deploy/) | Dashboards + alertes + KPIs | 10 min |

## Vision en 4 phrases

1. **Backend** : migration SQL renommant 6 vars + ajoutant 7 vars manquantes + cleanup E2E orphelins. Helper `presetVarsForPage` pour `VERSION` auto. Endpoint `/api/admin/legal/template-vars` étendu (create).
2. **Frontend** : refonte templates 4 pages (mentions-legales, cgv, confidentialite, retours) en mode "info sur demande email". Anonymisation prénom fondatrice dans 9 fichiers marketing.
3. **Data** : backfill historique (rename vars sans perte de valeur), cleanup pages orphelines, cron weekly anti-pollution E2E.
4. **Tests** : 15 tests vitest + 5 specs Playwright `@legal-purity` + smoke staging.

## Critères de réussite (Definition of Done globale)

- [ ] Les 3 drafts (CGU, retours-remboursements, sécurité-produits) peuvent être publiés sans erreur "missing_required_vars"
- [ ] `/legal/mentions-legales` HTML ne contient ni ICE (15 chiffres) ni RC (`Casablanca-NNNN`) ni adresse en clair
- [ ] `/legal/*` contient bien le contact `legal@femiglow-maroc.com` pour les demandes
- [ ] `grep -ri "souheila" apps/web/src/` retourne 0 (sauf opt-in docs internes)
- [ ] `/admin/legal` n'affiche plus les 5 pages E2E orphelines
- [ ] `/admin/legal/template-vars` permet d'ajouter de nouvelles variables (+ bouton)
- [ ] Migration SQL réversible (rollback documenté)
- [ ] Feature flag `LEGAL_VARS_V2` opérationnel (rollback safe)
- [ ] Tests vitest passent à 100% (15 nouveaux + baseline maintenue)
- [ ] Tests Playwright `@legal-purity` passent (5/5)
- [ ] Smoke staging exit 0
- [ ] Monitoring 48h post-deploy : 0 erreur Sentry
- [ ] Documentation `docs/legal-pages/` mise à jour (templates source synchronisés)

## Estimation effort

| Phase | Durée | Owner |
|---|---|---|
| T0 — Prep (branch + flag + analyse juridique) | 0.5 j-h | Dev + Lead |
| T1 — Backend (migration + helpers + endpoints) | 1.0 j-h | Dev |
| T2 — Templates refonte anonymisée | 1.0 j-h | Dev + Lead |
| T3 — Anonymisation prénom + cleanup | 0.5 j-h | Dev |
| T4 — Tests (vitest + Playwright + smoke) | 1.0 j-h | Dev |
| T5 — Backfill data + audit + monitoring | 0.5 j-h | Dev + Lead |
| T6 — Staging + prod + obs 48h | 0.5 j-h | DevOps + Lead |
| **Total** | **~5 j-h** | |

## Inventaire des livrables code

### Backend (5 fichiers modifiés + 2 nouveaux)

- `apps/web/src/lib/legal/vars.ts` (+ `presetVarsForPage`)
- `apps/web/src/lib/legal/publish.ts` (rendu cohérent avec nouveau set de vars)
- `apps/web/src/lib/legal/repository.ts` (template-vars create endpoint helper)
- `apps/web/src/lib/legal/template-vars-helpers.ts` (nouveau)
- `apps/web/drizzle/migrations/0075_legal_vars_rename_and_add.sql` (nouveau)
- `apps/web/src/app/api/admin/legal/template-vars/route.ts` (+ POST/PUT)
- `apps/web/src/lib/legal/feature-flag.ts` (nouveau, `LEGAL_VARS_V2`)

### Frontend (3 fichiers modifiés)

- `apps/web/src/app/admin/legal/template-vars/page.tsx` (+ form create var)
- `apps/web/src/components/admin/legal/CreateVarForm.tsx` (nouveau)
- Pages marketing : `maison`, `contact`, `kit`, `rituel` (anonymisation)

### Templates DB (4 markdown drafts)

- `docs/legal-pages/60-content/mentions-legales.md` (refonte)
- `docs/legal-pages/60-content/cgv.md` (suppression ICE/RC visibles)
- `docs/legal-pages/60-content/confidentialite.md` (suppression ICE/RC visibles)
- `docs/legal-pages/60-content/retours-remboursements.md` (suppression ICE/RC visibles)

### Tests (8 fichiers nouveaux)

- 4 vitest unit (presetVarsForPage, publish, migration, repository create-var)
- 2 MSW intégration (admin/legal POST var + edit page)
- 1 Playwright spec (`e2e/legal-purity.spec.ts` — 5 tests)
- 1 smoke (`scripts/smoke-legal-purity.ts`)

### Scripts (2 nouveaux)

- `apps/web/scripts/backfill-legal-vars-rename.ts` (alternative TS au SQL)
- `apps/web/scripts/cleanup-legal-e2e-orphans.ts`

## Liens rapides

- 📊 **Audit source** : [`../pages-legales-audit-2026-05/`](../pages-legales-audit-2026-05/)
- 🛠 **Plan d'action détaillé** : [`06-plan-action/phases.md`](./06-plan-action/phases.md)
- 📖 **Runbook exécution** : [`07-runbook/execution-pas-a-pas.md`](./07-runbook/execution-pas-a-pas.md)
- ✅ **Checklist DoD** : [`06-plan-action/checklist.md`](./06-plan-action/checklist.md)
- 🚨 **Rollback strategy** : [`06-plan-action/rollback.md`](./06-plan-action/rollback.md)

## Conventions du dossier

- **Code blocks** : TypeScript / SQL / shell / TSX directement copiables
- **Diff format** : `+`/`-` standard
- **Citations** : `fichier:ligne` exact
- **Naming** : `LEGAL-V2-XX` pour commits / branches
- **Branch suggérée** : `fix/legal-pages-pollution-and-privacy`
- **Feature flag env var** : `LEGAL_VARS_V2=true|false` (default `false`)

## Risques majeurs

- **R1** : juriste rejette l'approche "info sur demande" → Plan B : page dédiée `/legal/contact-juridique` séparée
- **R2** : migration rename vars perd des valeurs → Test sur dump complet avant prod
- **R3** : pages publiées affichent du contenu cassé pendant migration → Feature flag rollback-safe
- **R4** : 6 pages publiées à republier manuellement après refonte → Script de republish batch

## Notes

- Cohérent avec pattern `chat-conversations-leads-fix-2026-05/`.
- Memory rappelle : ne pas mentionner le prénom de la fondatrice dans le code futur.
- L'approche feature flag permet de shipper le backend en safe mode (queries v2 désactivées) puis activer progressivement.
