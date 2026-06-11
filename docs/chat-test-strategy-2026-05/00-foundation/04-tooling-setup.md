# Tooling setup — installation & configuration

Liste exhaustive des outils, versions, configs, et commandes pour démarrer le harnais de
tests **proprement** sur ce repo.

## 1. Stack outils

| Outil | Rôle | Version pinnée |
|-------|------|----------------|
| **node** | Runtime | 22.x (nvm-managed) |
| **pnpm** | Package manager | 9.15.x |
| **vitest** | Test runner unit / int / comp | ^1.6 |
| **@vitest/coverage-v8** | Coverage | ^1.6 |
| **@testing-library/react** | Composants | ^16 |
| **@testing-library/user-event** | Interactions | ^14 |
| **@testing-library/jest-dom** | Matchers DOM | ^6 |
| **jest-axe** | A11y component-level | ^9 |
| **MSW** | Mock HTTP + WS | ^2.4 |
| **msw/node** | MSW pour vitest | inclus |
| **Playwright** | E2E browser | ^1.46 |
| **@playwright/test** | Test runner | ^1.46 |
| **@axe-core/playwright** | A11y E2E | ^4.10 |
| **@faker-js/faker** | Factories | ^9 |
| **drizzle-orm** | ORM (déjà installé) | latest |
| **@testcontainers/postgresql** | DB test isolée | ^10 |
| **postgres** | Driver pg (déjà installé) | latest |
| **k6** | Load testing | latest (binaire CLI) |
| **plantuml** | Diagrammes | server local ou cli |

## 2. Installation

### 2.1 Premières dépendances dev (à ajouter)

```bash
# depuis apps/web/
pnpm add -D \
  @testcontainers/postgresql@^10 \
  @axe-core/playwright@^4.10 \
  jest-axe@^9 \
  @types/jest-axe@^3
```

Note : vitest, @testing-library/*, MSW, Playwright, @faker-js/faker sont déjà
installés (voir `apps/web/package.json`).

### 2.2 Binaires externes (CI + dev)

```bash
# Playwright browsers (déjà fait normalement)
pnpm exec playwright install --with-deps chromium firefox webkit

# k6 (load test) — macOS Homebrew
brew install k6

# PlantUML — pour diagrammes (rendu local)
brew install plantuml
```

## 3. Configuration vitest

### 3.1 `apps/web/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup/vitest.setup.ts',          // jest-dom + faker seed
      './src/test/setup/msw.setup.ts',              // MSW server lifecycle
      './src/test/setup/matchers.setup.ts',         // matchers custom
    ],
    globals: true,
    css: false,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: false, useAtomics: true },
    },
    testTimeout: 15_000,
    hookTimeout: 30_000,
    sequence: { shuffle: true, seed: 42 }, // 🎲 randomize order, deterministic seed
    reporters: ['default', 'html', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
      html: './test-results/index.html',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.config.ts',
        '**/__tests__/**',
        '**/types.ts',
        'src/lib/db/migrations/**',
        '**/node_modules/**',
        '**/*.d.ts',
      ],
      thresholds: { /* voir 03-quality-gates.md */ },
    },
  },
});
```

### 3.2 Setup files

**`src/test/setup/vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
import { faker } from '@faker-js/faker';
import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeAll(() => {
  faker.seed(42);
  // Pin Date.now to a deterministic value if needed
  // vi.useFakeTimers({ now: new Date('2026-05-25T10:00:00Z') });
});

afterEach(() => {
  cleanup();
});
```

**`src/test/setup/msw.setup.ts`**

```typescript
import { server } from '@/test/msw/server';
import { afterAll, afterEach, beforeAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**`src/test/setup/matchers.setup.ts`**

```typescript
import { expect } from 'vitest';
import { customMatchers } from '@/test/matchers';

expect.extend(customMatchers);
```

## 4. Configuration Playwright

### 4.1 `apps/web/playwright.config.ts` (augmenter l'existant)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,             // ⚠️ 1 retry pour CI (network only)
  workers: process.env.CI ? 4 : '50%',
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'retain-on-failure',                 // 👈 traces pour debug
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'] } },
    { name: 'chromium-rtl-ar', use: { ...devices['Desktop Chrome'], locale: 'ar-MA' } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 4.2 Tags / projects spécifiques

- `pnpm exec playwright test --grep @smoke` — smoke seul
- `pnpm exec playwright test --grep @critical` — critiques
- `pnpm exec playwright test --project=chromium-mobile` — mobile uniquement
- `pnpm exec playwright test --project=chromium-rtl-ar` — locale arabe

## 5. Configuration DB test (testcontainers)

### 5.1 `src/test/db/test-db.ts`

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

let container: StartedPostgreSqlContainer | null = null;
let sql: postgres.Sql | null = null;

export async function getTestDb() {
  if (!container) {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('femiglow_test')
      .withUsername('test')
      .withPassword('test')
      .start();
  }
  if (!sql) {
    const url = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/femiglow_test`;
    sql = postgres(url, { max: 5 });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
  }
  return { db: drizzle(sql), sql, url: sql.options.host };
}

export async function teardownTestDb() {
  await sql?.end();
  await container?.stop();
  sql = null;
  container = null;
}

export async function resetTestDb() {
  if (!sql) return;
  // TRUNCATE toutes les tables `chat_*` + tables critiques
  await sql`
    TRUNCATE TABLE chat_message, chat_lead, chat_session, chat_conversation_event,
      chat_canned_pair, chat_canned_pair_version, chat_faq_entry, chat_provider_config,
      chat_instruction_version, chat_intent_centroid, chat_intent_example,
      chat_knowledge_source, chat_knowledge_chunk, chat_knowledge_embedding,
      chat_feedback, chat_rate_limit_bucket, chat_runtime_setting, chat_theme_preset
    RESTART IDENTITY CASCADE;
  `;
}
```

### 5.2 Pattern utilisation

```typescript
// dans une suite integration
import { getTestDb, resetTestDb, teardownTestDb } from '@/test/db/test-db';

beforeAll(async () => { await getTestDb(); });
afterAll(async () => { await teardownTestDb(); });
beforeEach(async () => { await resetTestDb(); });
```

## 6. Configuration k6 (load test)

### 6.1 `apps/web/k6/chat-message.js`

Voir [04-execution-plan/05-phase-5-perf-load.md](../04-execution-plan/05-phase-5-perf-load.md).

### 6.2 Lancement

```bash
# local
k6 run apps/web/k6/chat-message.js --env BASE_URL=http://localhost:3001

# CI cron hebdo
k6 cloud apps/web/k6/chat-message.js  # ou self-hosted
```

## 7. Scripts npm à ajouter

À ajouter dans `apps/web/package.json` :

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --reporter dot src/lib",
    "test:int": "vitest run --reporter verbose --testNamePattern '.*integration'",
    "test:components": "vitest run --reporter dot src/components",
    "test:e2e": "playwright test",
    "test:e2e:smoke": "playwright test --grep @smoke",
    "test:e2e:critical": "playwright test --grep @critical",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "PWDEBUG=1 playwright test",
    "test:e2e:report": "playwright show-report",
    "test:a11y": "vitest run --reporter verbose --testNamePattern '@a11y'",
    "test:visual": "playwright test --grep @visual",
    "test:load": "k6 run k6/chat-message.js",
    "test:all": "pnpm test && pnpm test:e2e:critical"
  }
}
```

## 8. Hooks Git (déjà configurés)

`.husky/pre-commit` (à augmenter) :

```bash
# Linting (existant)
pnpm exec lint-staged

# Tests rapides sur fichiers modifiés
pnpm exec vitest related --run $(git diff --cached --name-only | grep -E '\.(ts|tsx)$')

# Pas de .only / .focus dans les tests
if grep -RE "(test|it|describe)\.(only|focus)" apps/web/src apps/web/e2e --include="*.test.ts*" --include="*.spec.ts"; then
  echo "❌ test.only / test.focus interdit"; exit 1
fi
```

## 9. CI workflow (.github/workflows/test.yml)

Voir [05-runbook/02-ci-pipeline.md](../05-runbook/02-ci-pipeline.md).

## 10. Validation setup

Une fois tout installé, valider via :

```bash
cd apps/web
pnpm test              # unit + int + comp → doit passer
pnpm test:e2e:smoke    # smoke E2E → doit passer
pnpm test:coverage     # → coverage report généré dans ./coverage/
open coverage/index.html
```

Si tout est vert : **setup OK**.
