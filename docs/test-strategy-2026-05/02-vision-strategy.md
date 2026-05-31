# 02 — Vision & Stratégie de tests

## Principes directeurs

### Principe #1 — Pyramide de tests rigoureuse

Mike Cohn's test pyramid adaptée FemiGlow :

```
                  ┌─────────────────────────────────┐
                  │    🎭 E2E (5%)                  │ ~150 specs
                  │    Playwright + smoke runners   │ Critical user paths
                  │    Cible : < 10 min CI total    │
                  ├─────────────────────────────────┤
                  │    🔗 Integration (15%)         │ ~450 tests
                  │    MSW + DB + API contracts     │
                  │    Cible : < 5 min CI total     │
                  ├─────────────────────────────────┤
                  │    🧩 Component (20%)           │ ~600 tests
                  │    React Testing Library + a11y │
                  │    Cible : < 2 min CI total     │
                  ├─────────────────────────────────┤
                  │    ⚙️ Unit (60%)                │ ~3000 tests
                  │    Vitest pure + Zod + lib      │
                  │    Cible : < 1 min CI total     │
                  └─────────────────────────────────┘
```

Pourquoi pas plus d'E2E ? Coût × 100 : un test E2E maintient + run = 10-30 sec, un unit = 1-50 ms. Pour la même confiance, on préfère pousser les invariants au plus bas niveau de la pyramide.

### Principe #2 — Test naming + scoping

Convention :
```ts
describe('moduleName', () => {
  describe('functionName', () => {
    it('arrange — when [condition] → assert [outcome]', () => {...});
  });
});
```

Exemples :
- `classifyTraffic` → `'utm_medium=cpc → paid_search'`
- `enrichEvent` → `'DB attribution + request signals conflict → DB wins'`
- `<KitStickyMobileCta>` → `'sticky bottom < lg, hidden ≥ lg'`

### Principe #3 — Tests déterministes

**Anti-patterns à éviter** :
- ❌ `Date.now()` direct → utiliser `vi.useFakeTimers() + vi.setSystemTime()`
- ❌ `Math.random()` → utiliser un seed fixe via `vi.spyOn(Math, 'random')`
- ❌ Network sans mock → MSW server pour tous les fetch
- ❌ `setTimeout` réels → `vi.advanceTimersByTime(N)`
- ❌ Lecture FS sans `tmp` dir → utiliser `os.tmpdir() + cleanup`

### Principe #4 — Isolation totale

Chaque test doit pouvoir tourner :
- Dans n'importe quel ordre (`--shuffle`)
- En parallèle (pas de state global partagé)
- Avec `--retries=0` (pas de flaky toléré)

Pour cela :
- `beforeEach()` reset DB + Redis + MSW handlers
- Pas de variables module-level mutables
- Pas de side effects dans imports

### Principe #5 — Factories > Fixtures inline

**Avant (anti-pattern)** :
```ts
it('test', () => {
  const order = { id: '1', items: [{...}], total: 199, ... }; // ❌ 30 lignes
});
```

**Après** :
```ts
it('test', () => {
  const order = orderFactory.build({ total: 199 }); // ✅ 1 ligne
});
```

Factories typées, overrides partiels, defaults sensés. Cf. `03-data-strategy.md`.

### Principe #6 — Couverture mesurable mais pas dogmatique

Objectif : **≥ 85% coverage `lib/`**, **≥ 75% coverage `app/`**, mais sans tests "for coverage's sake".

Pour chaque fichier :
- Tests des happy paths (essentiel)
- Tests des edge cases (validation Zod, null, empty)
- Tests des error paths (try/catch, timeout, retry)
- 1-2 tests d'intégration si le module est consommateur d'API

### Principe #7 — CI gates non-bypassables

Aucun merge sur `master` sans :
- ✅ Tous tests unitaires verts
- ✅ Tous tests integration verts
- ✅ Smoke E2E critical path vert
- ✅ Lighthouse perf score ≥ baseline - 2 points
- ✅ axe a11y : 0 violation `critical` ou `serious`
- ✅ `pnpm audit` : 0 vulnérabilité `critical`

## Architecture du dossier `src/test/`

```
src/test/
├── factories/                # Builder typés pour générer données test
│   ├── index.ts                  # Re-exports
│   ├── user.factory.ts
│   ├── order.factory.ts
│   ├── chat-session.factory.ts
│   ├── tracking-event.factory.ts
│   ├── publishing-job.factory.ts
│   └── lead.factory.ts
├── fixtures/                 # Fichiers statiques (PNG, SVG, JSON snapshots)
│   ├── images/
│   ├── payloads/
│   └── responses/
├── msw/                      # Handlers MSW par provider externe
│   ├── handlers.ts               # Aggregator
│   ├── openai-handlers.ts
│   ├── anthropic-handlers.ts
│   ├── meta-capi-handlers.ts
│   ├── tiktok-handlers.ts
│   ├── snap-handlers.ts
│   ├── pinterest-handlers.ts
│   └── (existants conservés)
├── matchers/                 # Custom matchers Vitest
│   ├── index.ts
│   ├── to-be-valid-zod.ts
│   ├── to-match-event-shape.ts
│   └── to-have-attribution.ts
├── helpers/                  # Utilitaires partagés
│   ├── render-with-providers.tsx # RTL render avec providers
│   ├── playwright-fixtures.ts    # Playwright custom fixtures
│   ├── api-client.ts             # Wrapper fetch typé pour tests
│   ├── db-helpers.ts             # Reset/seed DB test
│   └── redis-helpers.ts          # Reset Redis test
└── setup.ts                  # Setup global vitest
```

## Catégories de tests par couche

### Backend (Vitest + MSW)

| Couche | Tests | Outils |
|---|---|---|
| **Schemas Zod** | Validation entrée/sortie | vitest pur |
| **Helpers purs** | Logic métier (classifyTraffic, decideRetry, etc.) | vitest pur |
| **Repos / queries** | Drizzle ORM + memory fallback | vitest + memoryStore |
| **Services** | Orchestrateurs (orchestrator chat, executeJob publishing) | vitest + MSW |
| **Routes API** | Endpoints `/api/*` POST/GET | vitest + supertest-like fetch |
| **Middleware** | `middleware.ts` Next.js | vitest avec mock NextRequest |
| **Crons** | `/api/cron/*` handlers | vitest + MSW |

### Frontend (Vitest + RTL + axe)

| Couche | Tests | Outils |
|---|---|---|
| **Pure components** | Rendering + props variants | RTL + vitest |
| **Stateful components** | Interactions (click, type, focus) | RTL + userEvent |
| **Forms** | Validation Zod + RHF | RTL + vi.fn() callbacks |
| **A11y** | WCAG AA compliance | axe-core/playwright |
| **Responsive** | Breakpoints sm/md/lg | RTL + viewport mocks |
| **Server Components** | Async + props serialization | vitest + render avec wrapper |

### E2E (Playwright)

| Couche | Tests | Outils |
|---|---|---|
| **Smoke critical path** | Visite → conversion → confirmation | Playwright + tag `@critical` |
| **User journeys** | Multi-étapes (chat, wizard, publish) | Playwright |
| **Admin flows** | Auth → dashboards → CRUD | Playwright + cookie session |
| **Cross-browser** | Chrome + Firefox + Safari (mobile) | Playwright projects |
| **Cross-device** | Desktop 1280, Tablet 768, Mobile 375 | Playwright viewports |
| **Visual regression** | Screenshot diff | Playwright `toHaveScreenshot()` |

### Perf (Lighthouse CI + k6)

| Couche | Tests | Outils |
|---|---|---|
| **Web vitals** | LCP, CLS, FID/INP, TBT | Lighthouse CI |
| **Page speed** | Performance score ≥ 85 mobile | Lighthouse |
| **Load API** | /api/track 500 req/s | k6 |
| **Stress test** | /api/chat/message 50 concurrent | k6 |
| **Cron throughput** | capi-flush avec 10k events | k6 |

### Sécurité (axe + custom + dependency)

| Couche | Tests | Outils |
|---|---|---|
| **A11y WCAG AA** | 0 violation serious/critical | axe-core |
| **XSS** | Inputs malicieux dans chat/forms | Playwright |
| **SQLi / NoSQL injection** | Strings malformés dans API | vitest custom |
| **Dependency scan** | `pnpm audit` | CI |
| **Secrets scan** | `gitleaks` pre-commit | Git hook |
| **CSP headers** | Validation headers HTTP | Playwright |

## Ratios cibles par projet

| Module | Unit | Integration | Component | E2E | Total |
|---|---|---|---|---|---|
| `lib/tracking/` | 800 | 50 | — | 20 | 870 |
| `lib/chat/` | 500 | 80 | — | 15 | 595 |
| `lib/checkout/` | 600 | 80 | — | 25 | 705 |
| `lib/redis/` | 100 | 40 | — | — | 140 |
| `lib/social-publishing/` | 250 | 50 | — | 15 | 315 |
| `components/sections/` | — | — | 300 | 10 | 310 |
| `components/checkout/` | — | — | 150 | 15 | 165 |
| `components/admin/` | — | — | 200 | 20 | 220 |
| `app/api/*/route.ts` | — | 200 | — | — | 200 |
| `app/admin/*/page.tsx` | — | — | 100 | 30 | 130 |
| **Total cible** | **2 250** | **500** | **750** | **150** | **3 650+** |

## Non-objectifs

❌ **100% coverage** — diminishing returns, certains modules ne le méritent pas (dead code, fixtures, etc.)
❌ **Tests qui dupliquent les types** — TypeScript fait son job
❌ **Tests qui valident l'implémentation** — tester le comportement, pas le détail
❌ **Tests E2E pour valider chaque composant** — la pyramide explose
❌ **Tests "to feel safe"** sans valeur d'assertion réelle

## Critères "test bien écrit"

✅ **A**rrange-**A**ct-**A**ssert structure claire
✅ **F**ast (< 100 ms unit, < 1 s integration)
✅ **I**ndependent (peut tourner seul + parallèle)
✅ **R**epeatable (déterministe, pas de flaky)
✅ **S**elf-validating (assertions explicites, pas de logs)
✅ **T**imely (écrit AVANT ou EN MÊME TEMPS que le code, pas après "if I have time")

(Acronyme **FIRST** + AAA, classique du domaine.)
