# Plan de fix complet — Pollution conversations & leads chat (2026-05)

> **Objectif** : éliminer définitivement la pollution des vues admin chat (conversations vides + leads wizard mélangés) identifiée dans [`docs/chat-conversations-leads-audit-2026-05/`](../chat-conversations-leads-audit-2026-05/).
> **Date cible ship** : J+7 (1 semaine de bout en bout, T0 à T6).
> **Niveau d'exigence** : robuste, non-régressif, modulaire, testé à 4 niveaux (vitest unit + MSW intégration + Playwright E2E + smoke staging).

## Sommaire des 9 sous-dossiers

| # | Dossier | Aspect | Lecture |
|---|---|---|---|
| 0 | [`00-context/`](./00-context/) | Récap audit + glossaire + ADRs | 10 min |
| 1 | [`01-design-conception/`](./01-design-conception/) | Architecture cible + data model + contrats API + flow diagrams | 20 min |
| 2 | [`02-backend/`](./02-backend/) | Specs queries Drizzle + repos + routes API + migrations | 30 min |
| 3 | [`03-frontend-ui-ux/`](./03-frontend-ui-ux/) | Pages admin modifiées + composants + design tokens + a11y | 20 min |
| 4 | [`04-data-strategy/`](./04-data-strategy/) | Backfill historique + audit SQL + monitoring | 15 min |
| 5 | [`05-tests/`](./05-tests/) | Tests vitest unit + MSW intégration + Playwright E2E + suite non-régressive | 30 min |
| 6 | [`06-plan-action/`](./06-plan-action/) | Phases T0→T6 + checklist DoD + rollback strategy | 15 min |
| 7 | [`07-runbook/`](./07-runbook/) | Exécution pas-à-pas + vérifications staging + déploiement prod | 20 min |
| 8 | [`08-monitoring-post-deploy/`](./08-monitoring-post-deploy/) | Dashboards + alertes + KPIs | 10 min |

## Vision en 4 phrases

1. **Backend** : ajouter une colonne `chat_session.kind` (`'chat' | 'wizard_pivot' | 'system'`) + filtrer `listChatLeads` par `source` + filtrer `listConversations` par présence de messages.
2. **Frontend** : badge "via wizard" sur les leads, toggle "Inclure sessions sans messages (debug)" sur conversations, copy header explicite.
3. **Data** : migration ajoutant la colonne + backfill historique (préfixe `s_` → kind=`wizard_pivot`) + cleanup orphelins > 30j.
4. **Tests** : 18 tests vitest unit + 6 tests MSW intégration + 4 specs Playwright `@chat-purity` + smoke staging Node 20.

## Critères de réussite (Definition of Done globale)

- [ ] `/admin/chat/conversations` n'affiche QUE des sessions avec ≥1 `chat_message` role=`user` status=`sent` (sauf override debug `?debug=ghosts`)
- [ ] `/admin/chat/leads` n'affiche QUE les leads `source IN ('chat_widget', 'inline')`
- [ ] `/admin/leads` (global) continue d'afficher TOUT (chat + wizard, sans régression)
- [ ] Compteur "Conversion rate" `/admin/chat/kpis` reflète le ratio chat pur (numérateur et dénominateur cohérents)
- [ ] Migration Drizzle backward-compatible (rollback possible via `DROP COLUMN`)
- [ ] Backfill historique exécuté + audit SQL comparant counts before/after
- [ ] Suite de tests passe à 100 % : `pnpm vitest run` + `pnpm playwright test --grep @chat-purity` + smoke staging
- [ ] Feature flag `CHAT_ADMIN_FILTERS_V2` opérationnel (toggle on/off sans redéploiement)
- [ ] Monitoring 48h post-deploy : aucune alerte Sentry, KPIs chat stables
- [ ] Documentation `docs/chat-assistant/03-backend.md` mise à jour avec section "Table partagée chat_session — kind discriminator"

## Estimation effort

| Phase | Durée | Owner |
|---|---|---|
| T0 — Prep (feature flag, branch, doc) | 0.5 j-h | Dev |
| T1 — Backend (queries + repo + migration) | 1.0 j-h | Dev |
| T2 — Tests vitest + MSW | 1.0 j-h | Dev |
| T3 — Frontend (pages + badges + toggle) | 0.5 j-h | Dev |
| T4 — Tests Playwright E2E | 0.5 j-h | Dev |
| T5 — Backfill + audit data + monitoring | 0.5 j-h | Dev + Lead |
| T6 — Staging + prod + obs 48h | 1.0 j-h | DevOps + Lead |
| **Total** | **~5 j-h** | |

## Inventaire des livrables code attendus

### Backend (8 fichiers modifiés + 1 nouveau)

- `src/lib/chat/db/schema.ts` (+ colonne `kind`)
- `src/lib/chat/admin/queries.ts` (+ filtres `source`, `withMessagesOnly`, `kind`)
- `src/lib/chat/repos/session.ts` (insert `kind: 'chat'` par défaut)
- `src/lib/checkout/repos/session-repo.ts` (insert `kind: 'wizard_pivot'`)
- `src/lib/chat/feature-flag.ts` (+ flag `CHAT_ADMIN_FILTERS_V2`)
- `drizzle/migrations/0XYZ_chat_session_kind.sql` (nouveau)
- `src/app/api/admin/chat/cleanup-ghosts/route.ts` (nouveau, admin-only)
- `src/lib/chat/admin/cleanup.ts` (nouveau, logique cleanup)

### Frontend (3 fichiers modifiés + 1 nouveau)

- `src/app/admin/chat/conversations/page.tsx` (+ toggle debug)
- `src/app/admin/chat/leads/page.tsx` (+ badge source)
- `src/components/admin/chat/SourceBadge.tsx` (nouveau)
- `src/components/admin/chat/ChatAdminNav.tsx` (annotation visuelle pollution)

### Tests (12 fichiers nouveaux)

- 6 tests vitest unit (queries, repos, cleanup, feature flag, schema, kind)
- 3 tests MSW intégration (admin/chat/conversations, admin/chat/leads, admin/leads)
- 3 specs Playwright (`@chat-purity` × 3 scénarios)

## Liens rapides

- 📊 **Audit source** : [`../chat-conversations-leads-audit-2026-05/`](../chat-conversations-leads-audit-2026-05/)
- 🛠 **Plan d'action détaillé** : [`06-plan-action/phases.md`](./06-plan-action/phases.md)
- 📖 **Runbook exécution** : [`07-runbook/execution-pas-a-pas.md`](./07-runbook/execution-pas-a-pas.md)
- ✅ **Checklist DoD** : [`06-plan-action/checklist.md`](./06-plan-action/checklist.md)
- 🚨 **Rollback strategy** : [`06-plan-action/rollback.md`](./06-plan-action/rollback.md)

## Conventions du dossier

- **Code blocks** : TypeScript / SQL / shell / TSX directement copiables (pas de pseudo-code).
- **Diff format** : `+`/`-` standard pour montrer les changements précis sur les fichiers existants.
- **Citations** : `fichier:ligne` exact (validé contre HEAD).
- **Naming** : `CHA-LEAD-V2-XX` pour les commits / branches (cohérent avec sprints précédents `CHA-XXX`).
- **Branch suggérée** : `fix/chat-conversations-leads-pollution`.
- **Feature flag env var** : `CHAT_ADMIN_FILTERS_V2=true|false` (default `false` pour rollback safe).
