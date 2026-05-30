# Social Publishing — Test Battery (Enterprise-grade)

> **Version** : 1.0.0 — 2026-05-28
> **Auteur** : Plan d'audit + batterie de tests dense pour le pipeline de publication sociale
> **Portée** : tout ce qui touche à publier, programmer, déposer en brouillon Postiz, suivre l'état d'un job, retry/cancel, account sync, brand review, idempotency, audit log, alerts, calendar, library, dry-run, real-Postiz, **live Instagram (AlFenna Beauty)**
> **Cible qualité** : niveau Capgemini / Accenture / Sogeti — tests UI-first, MSW + Vitest robustes, Playwright pour les flows opérateur, opt-in live test sécurisé

## 1. Pourquoi ce dossier

Le pipeline de publication touche 5 réseaux sociaux potentiels (Instagram, Facebook, X, LinkedIn, TikTok via Postiz), 6 endpoints API, 8 composants UI, 5 tables DB, 3 cron jobs, 2 adapters (Postiz + dry-run), et une dizaine de chemins d'erreur. Un trou de test ici se traduit par :
- **Posts non publiés silencieusement** sur le compte client (réputation)
- **Posts dupliqués** si idempotency casse (réputation × 2)
- **Posts publiés au mauvais moment** si la timezone est mal gérée (réputation × 3)
- **Tokens OAuth expirés non détectés** → blocage massif (incident ops)
- **Budgets dépassés** non flaggués → facture imprévue

L'objectif : une batterie de tests qui couvre **tous les chemins** vus depuis le poste opérateur (UI), avec MSW comme couche d'isolation et un **live test opt-in** pour valider que la chaîne réelle marche bout en bout.

## 2. Principes directeurs

1. **UI-first** — les tests modélisent ce que l'opérateur **voit et clique**. Le backend est exercé par effet de bord.
2. **MSW comme source de vérité** — un seul catalogue de handlers, partagé entre Vitest et Playwright, garantit que les composants reçoivent le même contrat que la prod.
3. **Pyramide inversée acceptée** — beaucoup de tests composant + E2E mockés (rapides, déterministes), moins de unit, **un seul** live test (opt-in).
4. **Scénarios métiers réels** — pas seulement "cas heureux" ; tous les chemins d'erreur, race conditions, états dégradés.
5. **Anti-flake** — chaque test doit passer 3× consécutifs. Pas de `setTimeout` arbitraire. Tous les `waitFor` avec timeouts explicites.
6. **Cible qualité ≥ 85%** sur les composants publish, ≥ 80% sur les services, **100% des scénarios S01..S20 passent**.
7. **Live test = guardé** — `E2E_LIVE_POSTIZ=1` requis ; cleanup automatique du post test ; jamais lancé en CI par défaut.

## 3. Structure du dossier

```
docs/social-publishing-test-battery/
├── README.md                            ← ce fichier
├── 00-runbook.md                        ← pilote d'exécution
├── 01-action-plan.md                    ← plan phasé (8 phases)
├── 02-overview.md                       ← carte du système
├── 03-test-strategy.md                  ← stratégie globale
├── 04-msw-and-fixtures-strategy.md      ← stratégie mocks + fixtures
├── 05-live-testing-protocol.md          ← protocole live AlFenna Beauty
├── 06-coverage-targets.md
│
├── architecture/                        ← diagrammes + contrats
│   ├── system-overview.puml
│   ├── publish-flow.puml
│   ├── job-state-machine.puml
│   ├── error-paths.puml
│   ├── component-tree.puml
│   └── api-surface.yaml
│
├── features/                            ← 43 fonctionnalités testables
│   ├── F01-publish-now-direct/
│   ├── F02-schedule-post/
│   ├── F03-draft-on-postiz/
│   ├── F04-publish-action-group-ui/
│   ├── F05-confirm-dialog-preview/
│   ├── F06-schedule-presets-tz/
│   ├── F07-reschedule-via-calendar/
│   ├── F08-cancel-scheduled/
│   ├── F09-publish-jobs-queue-ui/
│   ├── F10-retry-failed-job/
│   ├── F11-cancel-running-job/
│   ├── F12-idempotency/
│   ├── F13-account-sync-postiz/
│   ├── F14-account-health-card/
│   ├── F15-account-selection/
│   ├── F16-brand-review-gate/
│   ├── F17-publishability-validation/
│   ├── F18-error-mapping-ui/
│   ├── F19-postiz-adapter/
│   ├── F20-dry-run-adapter/
│   ├── F21-state-machine-transitions/
│   ├── F22-worker-cron/
│   ├── F23-retry-backoff/
│   ├── F24-postiz-payload-mapping/
│   ├── F25-postiz-media-upload/
│   ├── F26-postiz-analytics-fetch/
│   ├── F27-audit-log-events/
│   ├── F28-alerts-webhook/
│   ├── F29-weekly-failure-digest/
│   ├── F30-calendar-view/
│   ├── F31-library-status-badges/
│   ├── F32-multi-account-publish/
│   ├── F33-concurrent-publish-locks/
│   ├── F34-quick-edit-drawer/
│   ├── F35-mock-mode-badge/
│   ├── F36-toast-feedback/
│   ├── F37-keyboard-shortcuts/
│   ├── F38-a11y-publish-ui/
│   ├── F39-responsive-publish-ui/
│   ├── F40-dark-mode-publish-ui/
│   ├── F41-live-instagram-test/
│   ├── F42-rate-limit-handling/
│   └── F43-token-expiry-handling/
│
├── scenarios/                            ← 20 scénarios métiers
│   ├── S01-golden-path-publish-now.md
│   ├── S02-golden-path-schedule.md
│   ├── S03-golden-path-postiz-draft.md
│   ├── S04-account-disconnect-recovery.md
│   ├── S05-multi-platform-bulk.md
│   ├── S06-failed-then-retried.md
│   ├── S07-scheduled-cancelled.md
│   ├── S08-network-blackout.md
│   ├── S09-budget-exhaustion-mid-publish.md
│   ├── S10-postiz-rate-limit.md
│   ├── S11-idempotency-race.md
│   ├── S12-week-of-content-calendar.md
│   ├── S13-live-instagram-alfenna.md       ← live test scénario
│   ├── S14-rollback-from-failed.md
│   ├── S15-week-of-content-bulk-schedule.md
│   ├── S16-operator-typo-recovery.md
│   ├── S17-token-expiry-mid-publish.md
│   ├── S18-mock-vs-real-comparison.md
│   ├── S19-content-policy-violation.md
│   └── S20-end-of-day-digest.md
│
├── data-contracts/                       ← contrats API + erreurs
│   ├── publish-now-endpoint.yaml
│   ├── schedule-endpoint.yaml
│   ├── draft-on-provider-endpoint.yaml
│   ├── publish-jobs-list-endpoint.yaml
│   ├── retry-endpoint.yaml
│   ├── cancel-endpoint.yaml
│   ├── reschedule-endpoint.yaml
│   ├── postiz-integrations-sync-endpoint.yaml
│   ├── postiz-api-mapping.yaml
│   ├── error-codes-catalog.yaml
│   └── job-status-transitions.yaml
│
├── test-battery/                         ← plan dense
│   ├── 00-runbook.md
│   ├── 01-vitest-component-plan.md
│   ├── 02-vitest-contract-plan.md
│   ├── 03-vitest-unit-plan.md
│   ├── 04-playwright-mocked-plan.md
│   ├── 05-playwright-live-plan.md
│   ├── 06-msw-handlers-catalog.yaml
│   ├── 07-fixtures-catalog.yaml
│   ├── 08-test-matrix.csv
│   ├── 09-coverage-targets.md
│   ├── 10-flake-budget.md
│   ├── fixtures/
│   │   ├── posts/
│   │   ├── accounts/
│   │   ├── jobs/
│   │   ├── postiz-responses/
│   │   └── media/
│   └── scenarios/
│
├── implementation/                       ← exécution
│   ├── phase-1-foundations.md
│   ├── phase-2-component-tests.md
│   ├── phase-3-contract-tests.md
│   ├── phase-4-unit-tests.md
│   ├── phase-5-e2e-mocked.md
│   ├── phase-6-cross-cutting.md
│   ├── phase-7-live-instagram.md
│   ├── phase-8-correction-loop.md
│   └── rollback.md
│
└── ux-design/
    ├── interaction-spec.md
    ├── micro-copy.md
    ├── error-states.md
    └── wireframes/
        ├── publish-flow.puml
        ├── job-queue-states.puml
        └── error-recovery.puml
```

## 4. Comment l'utiliser

1. **Lire d'abord** `02-overview.md` (carte du système) + `03-test-strategy.md` (philosophie)
2. **Planification** : `01-action-plan.md` orchestre les 8 phases
3. **Exécution** : `00-runbook.md` est le pilote pas-à-pas (build → tests → boucle de correction)
4. **Mock vs Live** :
   - `test-battery/04-playwright-mocked-plan.md` pour les E2E déterministes (CI)
   - `05-live-testing-protocol.md` + `test-battery/05-playwright-live-plan.md` pour le test réel sur AlFenna Beauty
5. **Trouver un test pour X** : `features/F<id>-<slug>/test-scenarios.yaml` ou `test-battery/08-test-matrix.csv`

## 5. Définitions

| Terme | Sens |
|-------|------|
| **Publish job** | Row dans `social_publish_job`, représente une intention de publication (mode now/schedule/draft) |
| **Provider** | Postiz (SaaS gateway) OU dry-run (mock interne). Pas d'appel direct Meta Graph aujourd'hui. |
| **Account** | `social_account` row, représente un compte social connecté via Postiz |
| **Brand review** | Validation auto + manuelle du contenu vs règles de marque |
| **Mock mode** | Env `CONTENT_STUDIO_V2_MOCK_MODE=true` — force toutes les inférences en mock (cf audit precedent) |
| **Live test** | E2E qui poste réellement sur Instagram via Postiz — opt-in via `E2E_LIVE_POSTIZ=1` |
| **AlFenna Beauty** | Compte Instagram cible du live test ; doit être connecté à Postiz au préalable |

## 6. Non-objectifs

- **Pas de tests de charge** (load tests) — outsourced (k6/Artillery) hors scope
- **Pas de tests de sécurité penetration** — outsourced (security review)
- **Pas de tests Meta Graph direct** — adapter pas encore implémenté ; tracé en backlog
- **Pas de tests des autres modules** (chat, emails, kit) — hors scope

## 7. Validation finale

Le plan est considéré **livré** quand :
- [ ] Toutes les phases du runbook sont passées
- [ ] 100% des scénarios S01..S20 passent (mock)
- [ ] Le live test S13 passe avec un post Instagram réel sur AlFenna Beauty + cleanup OK
- [ ] Couverture composants ≥ 85%
- [ ] Aucun test flaky (3 runs consécutifs identiques)
- [ ] La PR est ouverte avec lien vers ce dossier
