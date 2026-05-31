# Phases détaillées T0 → T6

## T0 — Préparation (0.5 j-h, J+0)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T0.1 | Lire audit + ce dossier | Dev + Lead | 30 min |
| T0.2 | Créer branche `fix/legal-pages-pollution-and-privacy` | Dev | 5 min |
| T0.3 | Ajouter `LEGAL_VARS_V2=false` dans `.env.example` + Vercel | Dev | 10 min |
| T0.4 | Étendre `src/lib/env.ts` + créer `src/lib/legal/feature-flag.ts` | Dev | 10 min |
| T0.5 | Snapshot pré-fix (`04-data-strategy/backfill-historique.md` §1) | Dev | 5 min |
| T0.6 | **Contact juriste** : soumettre wording anonymisation | Lead | 30 min |
| T0.7 | Créer email `legal@femiglow-maroc.com` (Google Workspace) | DevOps | 30 min |

### DoD T0
- [ ] Branch pushée
- [ ] Flag `LEGAL_VARS_V2` opérationnel (false partout)
- [ ] Snapshot DB stocké
- [ ] Juriste contacté avec brief
- [ ] Email `legal@femiglow-maroc.com` actif

---

## T1 — Backend (1 j-h, J+1)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T1.1 | Migration SQL `0075_legal_vars_rename_and_add.sql` | Dev | 30 min |
| T1.2 | Appliquer migration local | Dev | 10 min |
| T1.3 | Audit SQL post-migration | Dev | 15 min |
| T1.4 | Étendre `vars.ts` avec `presetVarsForPage` | Dev | 20 min |
| T1.5 | Créer `cleanup.ts` (cleanupLegalE2E) | Dev | 20 min |
| T1.6 | Étendre `repository.ts` avec `createTemplateVar` | Dev | 20 min |
| T1.7 | Créer `template-vars-helpers.ts` (suggestions) | Dev | 15 min |
| T1.8 | Endpoint POST `/api/admin/legal/template-vars` | Dev | 30 min |
| T1.9 | Endpoint DELETE `/api/admin/legal/cleanup-e2e` | Dev | 20 min |
| T1.10 | Smoke local + typecheck | Dev | 15 min |

### DoD T1
- [ ] Migration appliquée
- [ ] Audit : 0 drift, 6 renames + 6 inserts confirmés
- [ ] Endpoints OK via curl
- [ ] Type check passe

---

## T2 — Templates refonte anonymisée (1 j-h, J+2)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T2.0 | **Validation juriste** reçue | Lead | passive |
| T2.1 | Refonte `docs/legal-pages/60-content/mentions-legales.md` | Dev + Lead | 30 min |
| T2.2 | Refonte `cgv.md` | Dev + Lead | 30 min |
| T2.3 | Refonte `confidentialite.md` | Dev + Lead | 30 min |
| T2.4 | Refonte `retours-remboursements.md` | Dev | 15 min |
| T2.5 | Republish 4 pages via admin (manuel) | Lead | 30 min |
| T2.6 | Smoke local : grep ICE/RC sur HTML public | Dev | 10 min |

### DoD T2
- [ ] 4 templates refondus + juriste OK
- [ ] 4 pages republier en staging/local
- [ ] Smoke : `/legal/mentions-legales` ne contient ni ICE ni RC en clair
- [ ] Smoke : contient `legal@femiglow-maroc.com`

---

## T3 — Anonymisation prénom + cleanup (0.5 j-h, J+3 matin)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T3.1 | Diff 6 fichiers marketing (cf. `03-frontend-ui-ux/anonymisation-marketing.md`) | Dev | 30 min |
| T3.2 | Test invariant `no-founder-name.test.ts` | Dev | 15 min |
| T3.3 | Cleanup pages E2E orphelines (DELETE SQL) | Dev | 10 min |
| T3.4 | Fix test Playwright fautif (afterAll cleanup) | Dev | 30 min |
| T3.5 | Run grep final | Dev | 5 min |

### DoD T3
- [ ] `grep -ri "souheila" src/app/(marketing)/` retourne 0
- [ ] Test invariant passe
- [ ] 5 pages E2E orphelines supprimées
- [ ] Test Playwright incriminé a un cleanup

---

## T4 — Tests vitest + Playwright (1 j-h, J+3 après-midi + J+4)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T4.1 | `vars.presetVarsForPage.test.ts` | Dev | 15 min |
| T4.2 | `feature-flag.test.ts` | Dev | 15 min |
| T4.3 | `cleanup.test.ts` | Dev | 20 min |
| T4.4 | `repository.createTemplateVar.test.ts` | Dev | 20 min |
| T4.5 | `template-vars-helpers.test.ts` | Dev | 15 min |
| T4.6 | `invariants.test.ts` | Dev | 20 min |
| T4.7 | Routes endpoints tests (2 fichiers) | Dev | 30 min |
| T4.8 | MSW intégration tests (4 fichiers) | Dev | 60 min |
| T4.9 | Playwright `e2e/legal-purity.spec.ts` | Dev | 60 min |
| T4.10 | `scripts/smoke-legal-purity.ts` | Dev | 30 min |
| T4.11 | UI `<CreateVarForm />` + tests | Dev | 60 min |
| T4.12 | Page admin modifs | Dev | 30 min |

### DoD T4
- [ ] 12 tests vitest verts
- [ ] 5 tests MSW verts
- [ ] 7 specs Playwright `@legal-purity` verts
- [ ] Smoke local exit 0
- [ ] Suite globale vitest non régressive

---

## T5 — Backfill data + monitoring (0.5 j-h, J+5)

| # | Tâche | Owner | Durée |
|---|---|---|---|
| T5.1 | Snapshot pré-fix local | Dev | 10 min |
| T5.2 | Run migration local (si pas déjà fait) | Dev | 5 min |
| T5.3 | Audit SQL post-migration | Dev | 15 min |
| T5.4 | Snapshot post-fix local | Dev | 10 min |
| T5.5 | Configurer Sentry rules (L1, L2, L3) | Lead | 30 min |
| T5.6 | Configurer Plausible events | Lead | 20 min |
| T5.7 | Setup cron weekly cleanup-e2e | DevOps | 20 min |

### DoD T5
- [ ] Snapshots archivés
- [ ] Sentry rules OK
- [ ] Cron OK
- [ ] Audit pollution = 0

---

## T6 — Ship + obs 48h (0.5 j-h, J+6 + J+7)

### Phase A — Staging (J+6 matin, 1h)

- T6.A.1 — Merge PRs (3 PRs séquentielles)
- T6.A.2 — Deploy staging
- T6.A.3 — Migration DB staging
- T6.A.4 — Backfill staging
- T6.A.5 — Smoke staging avec flag OFF
- T6.A.6 — Activer flag en staging
- T6.A.7 — Smoke avec flag ON
- T6.A.8 — Republish 4 pages manuel staging
- T6.A.9 — Validation manuelle Lead

### Phase B — Prod (J+6 après-midi, 1h)

- T6.B.1 — Backup DB prod
- T6.B.2 — Migration DB prod
- T6.B.3 — Deploy prod avec flag OFF
- T6.B.4 — Smoke flag OFF (legacy)
- T6.B.5 — Activer flag prod
- T6.B.6 — Smoke flag ON
- T6.B.7 — Republish 4 pages manuel prod
- T6.B.8 — Validation Lead + fondatrice

### Phase C — Observation 48h (J+6 soir → J+7 soir)

- Monitoring Sentry toutes 2-4h
- Vérifier dashboard `/admin/legal/audit`
- Vérifier KPIs business stable
- Décision J+2 : maintenir flag ON ou rollback

---

## Récap effort total

| Phase | Effort | Calendrier | Owner |
|---|---|---|---|
| T0 | 0.5 j-h | J+0 | Dev + Lead |
| T1 | 1.0 j-h | J+1 | Dev |
| T2 | 1.0 j-h | J+2 | Dev + Lead (+ juriste passif) |
| T3 | 0.5 j-h | J+3 matin | Dev |
| T4 | 1.0 j-h | J+3-J+4 | Dev |
| T5 | 0.5 j-h | J+5 | Dev + Lead |
| T6 | 0.5 j-h | J+6 + obs J+7 | DevOps + Lead |
| **Total** | **5 j-h** | **7 jours** | |
