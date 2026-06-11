# Phase 0 + 1 — Setup harnais + couverture P0 services

**Durée combinée** : 3 semaines (1 sem setup + 2 sem coverage P0)

## Phase 0 — Setup (5 jours)

### Jour 1 — Installation outils
- [ ] Pinner Node 22 dans `.nvmrc`
- [ ] Installer `@testcontainers/postgresql`, `@axe-core/playwright`, `jest-axe`
- [ ] Vérifier que `vitest`, `@testing-library/*`, MSW, Playwright sont up-to-date
- [ ] Mettre à jour `vitest.config.ts` selon [04-tooling-setup.md](../00-foundation/04-tooling-setup.md)
- [ ] Mettre à jour `playwright.config.ts` (projects browsers + locales)
- [ ] Ajouter scripts npm (`test:unit`, `test:int`, `test:e2e:smoke`, etc.)

**Gate** : `pnpm test` lance vitest avec 0 test mais sans erreur. `pnpm test:e2e:smoke`
idem pour Playwright.

### Jour 2 — Setup files vitest
- [ ] Créer `src/test/setup/vitest.setup.ts` (jest-dom + faker seed)
- [ ] Créer `src/test/setup/msw.setup.ts` (server lifecycle)
- [ ] Créer `src/test/setup/matchers.setup.ts` (custom matchers)
- [ ] Créer `src/test/db/test-db.ts` (testcontainers init)

**Gate** : `pnpm test` reconnaît les setup files (un test trivial qui utilise un matcher
custom passe).

### Jour 3 — Factories de base
- [ ] Créer `src/test/factories/base.ts` (`defineFactory`, `testId`, `createCounter`)
- [ ] Créer 5 factories prioritaires :
  - `chatSessionFactory`
  - `chatMessageFactory`
  - `chatProviderFactory`
  - `chatLeadFactory`
  - `chatInstructionFactory`
- [ ] Tester chaque factory (méta-test) — validation Zod
- [ ] Helper `ma-aligned.ts` (prénoms / villes / téléphones)

**Gate** : factories prêtes à être utilisées, méta-tests verts.

### Jour 4 — MSW handlers de base
- [ ] Créer `src/test/msw/server.ts`
- [ ] Handlers OpenAI (chat + embed + moderations) + variantes erreur
- [ ] Handlers webhooks internes (`/test/webhook-sink`, slack mock)
- [ ] Handler internal `/api/chat/*` pour component tests
- [ ] Helper `makeSseStream`

**Gate** : un test component qui utilise MSW pour mocker `/api/chat/message` passe.

### Jour 5 — Custom matchers + POM Playwright
- [ ] Implémenter 8 matchers prioritaires :
  - `toBeFromLanguage`, `toBeStreamedEventOf`, `toRespectBudget`,
  - `toBeRedacted`, `toHaveOfferedLeadFormWithReason`, `toFallbackToProvider`,
  - `toMatchIntent`, `toServeFromCanned`
- [ ] Créer POM de base :
  - `ChatWidgetPOM`, `LeadFormPOM`, `KitPagePOM`
  - `AdminLoginPOM`
- [ ] Helpers Playwright : `auth-admin.ts`, `seed-conversation.ts`, `wait-for-stream.ts`

**Gate sortie Phase 0** :
- Premier test Playwright `smoke-chat.spec.ts` passe
- CI workflow `.github/workflows/test.yml` configuré + premier run vert
- Coverage report HTML généré

---

## Phase 1 — Couverture P0 services + repos (10 jours)

### Semaine 2 — Services orchestrator

| Jour | Tickets | Couvre |
|------|---------|--------|
| 6 | F23 sanitize (15 cas) + I7 régression | sécurité PII |
| 7 | F25 intent (regex + vector, ~22 cas) | détection intent |
| 8 | F26 charter (in + out, ~12 cas) | sécurité éditoriale |
| 9 | F27 moderation (15 cas) + C2 régression | sécurité éditoriale |
| 10 | F28 FAQ gateway (15 cas) + I3 / R2 régression | économie LLM |

**Gate semaine 2** : Coverage services orchestrator P0 ≥ 95 %.

### Semaine 3 — Services secondaires + repos

| Jour | Tickets | Couvre |
|------|---------|--------|
| 11 | F29 RAG retrieve + minScore régression I6 | qualité réponse |
| 12 | F31 provider router (20 cas) — I5 résolu, C6 régression | résilience |
| 13 | F33 lead decision (10 règles, ~18 cas) — M6 régression | conversion |
| 14 | F34 persist + KPI events + I1 régression | observabilité |
| 15 | F35 budget guard + F36 rate limit — C4 + I4 régression | sécurité fin/réseau |

**Gate sortie Phase 1** :
- Coverage **statement ≥ 95 %** sur orchestrator + intent + charter + sanitize + lead-decision
- 0 flaky en CI sur 7 jours consécutifs
- Tous les `it.fails(...)` documentés (tools framework, fallback levels 2-4, etc.)

## Livrables

- Suite vitest unit : ~120 tests
- Suite vitest integration : ~50 tests
- Coverage report public (codecov)
- Rapport tests de régression bugs audit (lien aux tickets CHA-AUD-*)

## Risques + mitigations

| Risque | Mitigation |
|--------|------------|
| Découverte de bug bloquant pendant test (ex C2) | Ticket immédiat + test marqué `it.fails(...)` jusqu'à fix |
| Pas de DB testcontainers disponible | Pré-installer Docker dev + CI runners |
| Effort sous-estimé sur orchestrator | Time-box 2 jours par sous-pipeline ; quoi qu'il arrive on passe à la suite |

## Outil — coverage delta

À chaque PR : `vitest --coverage --changed` + CI commente le delta.

```yaml
# .github/workflows/test.yml extract
- run: pnpm test:coverage
- uses: codecov/codecov-action@v4
  with: { token: ${{ secrets.CODECOV_TOKEN }}, fail_ci_if_error: true }
```
