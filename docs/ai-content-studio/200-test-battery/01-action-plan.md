# AI Engine Test Battery -- Detailed Action Plan

**Version:** 1.0
**Last updated:** 2026-05-27
**Total estimated test count:** 1,136 (635 unit + 116 contract + 161 component + 224 E2E)

---

## Phase 1: Documentation and Specification

### Objective

Create the complete test specification, scenario definitions, coverage matrix, architecture diagrams, and MSW handler inventory before writing any test code.

### Inputs

- Production codebase: `src/lib/ai-engine/` (56 service modules)
- API routes: `src/app/api/admin/ai-engine/` (24 route handlers)
- UI pages: `src/app/admin/content-studio-v2/ai-engine/` (7 pages)
- UI components: `src/components/admin/content-studio-v2/ai-engine/` (6 shared components)
- Existing MSW handlers: `src/test/msw/ai-engine-handlers.ts`

### Deliverables

| # | Deliverable | File | Status |
|---|------------|------|--------|
| D1.1 | Master runbook | `docs/.../200-test-battery/00-runbook.md` | Complete |
| D1.2 | Action plan (this document) | `docs/.../200-test-battery/01-action-plan.md` | Complete |
| D1.3 | Test matrix (400+ rows) | `docs/.../200-test-battery/02-test-matrix.csv` | Complete |
| D1.4 | Test architecture diagram | `docs/.../200-test-battery/03-test-architecture.puml` | Complete |
| D1.5 | MSW coverage inventory | `docs/.../200-test-battery/04-msw-coverage.yaml` | Complete |

### Acceptance criteria

- All 5 documentation files exist and contain production-quality content
- Test matrix has 400+ rows covering all features and scenarios
- MSW inventory maps all 24 routes with handler status
- Architecture diagram renders correctly in PlantUML

### Dependencies

- None (first phase)

### Risk items

- Feature additions during documentation phase may require matrix updates
- Route signatures may change before tests are written

---

## Phase 2: MSW Handler Extension

### Objective

Extend the MSW mock layer to cover all 24 API routes with success, error, and edge-case variants. Every contract test and component test depends on complete MSW coverage.

### Inputs

- Existing handlers: `src/test/msw/ai-engine-handlers.ts` (14 success + 4 error handlers)
- Existing knowledge-edit handlers: `knowledgeEditHandlers` (3 handlers)
- Existing API keys handlers: `apiKeysHandlers` (4 handlers) + `apiKeysErrorHandlers` (4 handlers)
- Route definitions: 24 route files

### Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| D2.1 | Success handlers | 1 handler per route (24 total, 14 already exist) |
| D2.2 | Error 4xx handlers | 401, 403, 404, 409, 422, 429 variants per applicable route |
| D2.3 | Error 5xx handlers | 500, 503 variants per applicable route |
| D2.4 | Edge-case handlers | Timeout, empty response, malformed JSON, large payload |
| D2.5 | Stream handlers | SSE success + SSE error for `/generate-stream` |

### Handler inventory (what needs to be created)

| Route | Success | Error variants | Status |
|-------|---------|---------------|--------|
| `POST /generate` | exists | 500, 429 exist; add 401, 422 | partial |
| `POST /generate-stream` | needs SSE handler | needs SSE error handler | missing |
| `GET /health` | exists | timeout, disabled exist; add 503 | partial |
| `GET /trends` | exists | add 500, empty | partial |
| `GET /knowledge` | exists | add 401, 500 | partial |
| `GET /knowledge/:slug` | needs handler | add 404, 500 | missing |
| `PATCH /knowledge/:slug` | exists (knowledgeEditHandlers) | add 404, 422 | partial |
| `GET /knowledge/:slug/documents` | needs handler | add 404 | missing |
| `GET /knowledge/:slug/documents/:docId` | exists (knowledgeEditHandlers) | add 404 | partial |
| `PATCH /knowledge/:slug/documents/:docId` | exists (knowledgeEditHandlers) | add 404, 422 | partial |
| `POST /knowledge/seed` | needs handler | add 500 | missing |
| `POST /knowledge/embed` | exists | add 500 | partial |
| `GET /jobs` | exists | add 401, 500 | partial |
| `POST /jobs/:id/review` | exists | add 404, 422 | partial |
| `GET /config/providers` | exists | add 500 | partial |
| `GET /config/providers/models` | needs handler | add 500 | missing |
| `GET /config/workflows` | exists | add 500 | partial |
| `POST /config/workflows` | needs handler | add 422 | missing |
| `GET /config/workflows/:id` | needs handler | add 404 | missing |
| `GET /config/prompts` | exists | add 500 | partial |
| `POST /config/prompts/:id` | needs handler | add 404, 422 | missing |
| `GET /config/api-keys` | exists | add 401 | partial |
| `POST /config/api-keys` | exists | 503 exists; add 422 | partial |
| `DELETE /config/api-keys/:id` | exists | 404 exists; complete | complete |
| `POST /config/api-keys/test` | exists | 429, invalid exist; complete | complete |
| `GET /analytics` | exists | add 500 | partial |
| `GET /integrations` | exists | add 500 | partial |
| `POST /publish` | exists | add 401, 500, 409 | partial |

### Estimated new handler count

- New success handlers: 10
- New error variant handlers: ~35
- New edge-case handlers: ~8
- **Total new handlers: ~53**

### Acceptance criteria

- All 24 routes have at least 1 success handler
- All routes that accept user input (POST, PATCH, DELETE) have 422 error variants
- All authenticated routes have 401 error variants
- SSE stream route has both success and error handlers
- All handlers export clean mock data constants for reuse in assertions

### Dependencies

- Phase 1 complete (this plan documents what is needed)

### Risk items

- Route response shapes may change during parallel development
- SSE mock handlers require special MSW configuration (`HttpResponse` with `ReadableStream`)

---

## Phase 3: Vitest UI Tests

### Objective

Write 200+ component tests (combining existing 161 with new ones to fill gaps) covering all 17 features across 7 pages and 6 shared components.

### Inputs

- Existing page tests: 7 files, 98 tests
- Existing shared component tests: 6 files, 63 tests
- MSW handlers from Phase 2
- Feature specifications: F01-F17

### Test breakdown by feature

| Feature | Page/Component | Existing tests | New tests needed | Total target |
|---------|---------------|---------------|-----------------|-------------|
| F01 Navigation/Sidebar | dashboard, Sidebar | 12 | 5 (deep link, active state, collapse) | 17 |
| F02 Config Providers | config-page | 21 | 4 (edit, delete, health status) | 25 |
| F03 Config Workflows | config-page | (included in F02) | 5 (create, edit, validate) | 5 |
| F04 Config Prompts | config-page | (included in F02) | 5 (create, edit, preview) | 5 |
| F05 Config API Keys | config-page | (included in F02) | 5 (masked display, save, test) | 5 |
| F06 Model Selector | ModelSelector | 0 | 8 (dropdown, filter, cost display) | 8 |
| F07 Knowledge Collections | knowledge-page | 12 | 3 (empty state, pagination) | 15 |
| F08 Knowledge Documents | knowledge-page | (included in F07) | 5 (upload, preview, delete) | 5 |
| F09 Knowledge Embeddings | knowledge-page | (included in F07) | 3 (progress, status) | 3 |
| F10 Content Creation | create-page | 18 | 4 (validation, draft save) | 22 |
| F11 Generation Progress | GenerationProgress | 12 | 3 (SSE phases, cancel) | 15 |
| F12 HITL Review | ReviewPanel | 12 | 4 (approve, reject, edit, requeue) | 16 |
| F13 Publish Flow | PublishSection | 10 | 3 (schedule, platform select) | 13 |
| F14 Analytics Dashboard | analytics-page | 10 | 5 (chart render, date filter, export) | 15 |
| F15 Trends | trends-page | 10 | 3 (score filter, refresh) | 13 |
| F16 Graph Visualization | graph-page | 8 | 4 (zoom, node click, edge highlight) | 12 |
| F17 Cross-cutting | loading-states, ErrorBanners, ClipboardCopy | 21 | 5 (skeleton, toast, dark mode) | 26 |
| **Total** | | **161** | **~59** | **~220** |

### Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| D3.1 | Page test updates | Enhanced tests for all 7 page files |
| D3.2 | New ModelSelector tests | `ModelSelector.test.tsx` (new file) |
| D3.3 | Enhanced shared component tests | Extended coverage for all 6 shared components |
| D3.4 | Interaction tests | User event simulations (click, type, keyboard) |
| D3.5 | State management tests | Loading, error, empty, populated states |

### Acceptance criteria

- 220+ component tests pass
- All features F01-F17 have at least 3 component tests
- All user-facing error states are tested
- All loading/skeleton states are tested
- Accessibility (aria-label, role) assertions included in every page test

### Dependencies

- Phase 2 (MSW handlers must be complete)

### Risk items

- Server components cannot be tested in jsdom (use shallow rendering or test the client wrapper)
- Heavy use of `next/navigation` mocks required for page routing tests

---

## Phase 4: Contract API Tests

### Objective

Write 120+ contract tests validating all 24 AI Engine routes against their expected request/response shapes, status codes, headers, and error handling.

### Inputs

- Existing contract tests: 14 files, 116 tests
- MSW handlers from Phase 2
- Route source files: 24 `route.ts` files
- Type definitions: `src/lib/ai-engine/types/`

### Test breakdown by route group

| Route group | Routes | Existing tests | New tests needed | Total target |
|-------------|--------|---------------|-----------------|-------------|
| Generation | `/generate`, `/generate-stream` | 16 | 4 (stream abort, stream error, payload validation) | 20 |
| Health | `/health` | 6 | 2 (cache headers, degraded state) | 8 |
| Configuration | `/config/providers`, `/models`, `/workflows`, `/prompts` | 8 | 8 (CRUD on each config resource) | 16 |
| API Keys | `/config/api-keys`, `/test` | 21 | 2 (concurrent saves, provider validation) | 23 |
| Knowledge | `/knowledge`, `/:slug`, `/documents`, `/seed`, `/embed` | 31 | 4 (large document, encoding, re-chunking) | 35 |
| Jobs | `/jobs`, `/:id/review` | 6 | 4 (pagination, filter, review transitions) | 10 |
| Publish | `/publish` | 12 | 2 (schedule validation, platform check) | 14 |
| Analytics | `/analytics` | 6 | 2 (date range, aggregation) | 8 |
| Integrations | `/integrations` | 4 | 2 (platform filter, disabled state) | 6 |
| Trends | `/trends` | 6 | 2 (score threshold, source filter) | 8 |
| **Total** | **24 routes** | **116** | **~32** | **~148** |

### Test patterns for every route

Each route must have:

1. **Happy path:** Valid request returns expected status and shape
2. **Auth guard:** Request without session returns 401
3. **Validation:** Invalid body returns 422 with structured error
4. **Server error:** Upstream failure returns 500 with safe error message
5. **Rate limit (where applicable):** Returns 429 with retry-after header

### Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| D4.1 | Extended existing contract files | Add missing test cases to 14 existing files |
| D4.2 | New config CRUD contract tests | Tests for workflow/prompt create/update |
| D4.3 | Stream contract tests | SSE event shape validation |
| D4.4 | Security contract tests | Auth, CORS, rate limit per route |
| D4.5 | Edge-case contract tests | Large payloads, unicode, empty collections |

### Acceptance criteria

- 148+ contract tests pass
- Every route has at minimum happy-path + auth-guard tests
- All POST/PATCH routes validate request body shape
- Response schemas are asserted structurally (not just status code)
- No test depends on database state (MSW only)

### Dependencies

- Phase 2 (MSW handlers)

### Risk items

- Next.js route handlers may require special test setup (NextRequest mocking)
- Streaming routes need ReadableStream assertion utilities

---

## Phase 5: E2E Playwright Tests

### Objective

Write 80+ E2E tests (on top of the existing 224) covering 6 business scenarios and cross-cutting concerns against a running Next.js instance.

### Inputs

- Existing E2E tests: 29 spec files, 224 tests
- Running application at `http://127.0.0.1:3000`
- Auth state from `global.setup.ts`

### Scenario breakdown

| Scenario | Spec file(s) | Existing tests | Description |
|----------|-------------|---------------|-------------|
| S01 Golden Path | `ai-engine-scenario-golden-path.spec.ts` | 15 | Brief -> Generate -> Library: complete happy path |
| S02 Error Recovery | `ai-engine-scenario-error-recovery.spec.ts` | 10 | Fail -> Retry -> Succeed with UI feedback |
| S03 Knowledge Flow | `ai-engine-knowledge-flow.spec.ts`, `ai-engine-knowledge-edit.spec.ts` | 21 | Seed -> Upload -> Edit -> Embed -> Verify |
| S04 Review Cycle | `ai-engine-hitl-review.spec.ts`, `ai-engine-review-edit-cycle.spec.ts` | 18 | Generate -> Review -> Edit -> Approve -> Publish |
| S05 Budget Guard | `ai-engine-budget-guard.spec.ts` | 6 | Approach limit -> Warning -> Block -> Reset |
| S06 Multi-platform | `ai-engine-multi-format.spec.ts`, `ai-engine-publish.spec.ts` | 14 | Generate for Instagram, TikTok, LinkedIn -> publish each |

### Feature coverage by E2E

| Feature | Covered by spec(s) | Test count |
|---------|-------------------|-----------|
| F01 Navigation | `navigation`, `sidebar-subnav`, `dashboard` | 16 |
| F02-F05 Configuration | `config`, `api-keys` | 25 |
| F07-F09 Knowledge | `knowledge`, `knowledge-edit`, `knowledge-flow` | 29 |
| F10 Content Creation | `create` | 12 |
| F11 Generation | `sse-streaming`, `golden-path` | 23 |
| F12 HITL Review | `hitl-review`, `review-edit-cycle` | 18 |
| F13 Publish | `publish` | 8 |
| F14 Analytics | `analytics` | 6 |
| F15 Trends | `trends` | 8 |
| F16 Graph | `graph` | 8 |
| F17 Cross-cutting | `a11y`, `dark-mode`, `keyboard`, `responsive`, `concurrent`, `session-expired`, `refresh-recovery`, `provider-fallback` | 71 |

### Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| D5.1 | All 29 spec files passing | Fix any failures in existing tests |
| D5.2 | S01-S06 scenarios complete | Serial test chains for each business scenario |
| D5.3 | Cross-browser check | Chromium passes; Firefox/WebKit pass on PLAYWRIGHT_CROSS=1 |
| D5.4 | Responsive viewport tests | 375px, 768px, 1280px breakpoints |
| D5.5 | Accessibility audit | axe-core integration in `ai-engine-a11y.spec.ts` |

### Acceptance criteria

- 224+ E2E tests pass on Chromium
- Zero flaky tests over 3 consecutive runs
- All 6 business scenarios (S01-S06) execute end-to-end
- HTML report generated and inspectable
- Trace files generated for any failure (retain-on-failure configured)

### Dependencies

- Phase 4 (contract tests validate API shapes first)
- Running dev server
- Auth setup via `global.setup.ts`

### Risk items

- Flaky selectors due to animation timing (mitigate with `waitForLoadState`, explicit waits)
- SSE streaming tests may time out on slow CI (increase per-test timeout to 60s)
- Dark mode tests depend on CSS custom properties being applied synchronously

---

## Phase 6: Execution and Correction Loop

### Objective

Execute all test phases sequentially, fix all failures, and achieve 100% pass rate with no skipped tests.

### Inputs

- All tests from Phases 3-5
- Runbook from Phase 1

### Process

```
+------------------+     +------------------+     +------------------+
| Run Phase 1-5    | --> | Analyze failures | --> | Classify root    |
| sequentially     |     | from output      |     | cause            |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
+------------------+     +------------------+     +------------------+
| Verify 0         | <-- | Re-run failing   | <-- | Apply minimal    |
| failures         |     | phase            |     | fix              |
+------------------+     +------------------+     +------------------+
        |
        v
+------------------+     +------------------+
| Cross-phase      | --> | Generate final   |
| regression check |     | reports          |
+------------------+     +------------------+
```

### Iteration limits

| Phase | Max iterations | Escalation |
|-------|---------------|------------|
| Unit | 5 | If >5 iterations, refactor the service module |
| Contract | 3 | If >3 iterations, review route implementation |
| Component | 5 | If >5 iterations, simplify the component |
| Build | 2 | If >2 iterations, address type system issues globally |
| E2E | 10 | Flaky tests allowed up to 10 retries before marking as known issue |

### Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| D6.1 | All phases green | 0 failures across all 1,136+ tests |
| D6.2 | Coverage report | HTML + JSON summary meeting thresholds |
| D6.3 | Signed-off checklist | Phase 8 checklist from runbook completed |
| D6.4 | Correction log | List of every fix applied during correction loop |

### Acceptance criteria

- Total test count: 1,136+ tests
- Pass rate: 100% (0 failures, 0 skipped)
- Coverage: 80%+ statements, 80%+ lines, 80%+ functions, 70%+ branches
- Build: 0 TypeScript errors
- E2E: stable over 3 consecutive runs

### Dependencies

- All previous phases complete

### Risk items

- Circular fixes: fixing one test breaks another (mitigate with cross-phase regression check)
- Diminishing returns on last 1-2 failures (may require production code fixes)
- CI environment differences (timezone, locale, font rendering for screenshot tests)

---

## Summary -- Total Test Inventory

| Layer | Files | Test count | Location |
|-------|-------|-----------|----------|
| Unit (services) | 56 | 635 | `src/lib/ai-engine/**/*.test.ts` |
| Contract (API) | 14 | 116 | `src/test/api-contracts/ai-engine*.test.ts` |
| Component (UI) | 14 | 161 | Pages + shared components `*.test.tsx` |
| E2E (Playwright) | 29 | 224 | `e2e/content-studio-v2/ai-engine*.spec.ts` |
| **Grand total** | **113** | **1,136** | |

### Timeline estimate

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| Phase 1: Documentation | 1 day | Day 1 |
| Phase 2: MSW Handlers | 1 day | Day 2 |
| Phase 3: Vitest UI Tests | 2 days | Day 4 |
| Phase 4: Contract API Tests | 1.5 days | Day 5.5 |
| Phase 5: E2E Playwright | 2 days | Day 7.5 |
| Phase 6: Execution + Correction | 2.5 days | Day 10 |
| **Total** | **10 working days** | |
