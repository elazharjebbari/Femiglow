# Setup Jest

## Fichiers de config

### jest.config.js

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customJestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': '<rootDir>/__mocks__/style.ts',
  },
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
  ],
  collectCoverageFrom: [
    'src/lib/tracking/plan/**/*.{ts,tsx}',
    'src/components/tracking/**/*.{ts,tsx}',
    'src/app/api/admin/tracking/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    './src/lib/tracking/plan/validator.ts': {
      statements: 95,
      branches: 90,
      functions: 100,
      lines: 95,
    },
    './src/lib/tracking/plan/exporter.ts': {
      statements: 90,
      branches: 85,
      functions: 95,
      lines: 90,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

### jest.setup.ts

```typescript
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

// Stub crypto for Node tests (used in bundle hash)
import { webcrypto } from 'crypto'
global.crypto = webcrypto as any

// Set default timezone (UTC) for deterministic date tests
process.env.TZ = 'UTC'

// Default locale fr-MA for i18n tests
process.env.NEXT_PUBLIC_DEFAULT_LOCALE = 'fr-MA'

// Mock Next.js router globally
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/admin/tracking',
    query: {},
    asPath: '/admin/tracking',
  }),
}))
```

### __mocks__/style.ts

```typescript
module.exports = {}
```

## Fixtures helpers

### tests/helpers/build-plan.ts

```typescript
import type { TrackingPlan } from '@/lib/tracking/plan/types'

export function buildPlan(overrides: Partial<TrackingPlan> = {}): TrackingPlan {
  return {
    id: 'plan-test-001',
    name: 'Test Plan',
    status: 'draft',
    version: 1,
    providers: [
      { id: 'ga4', active: true },
    ],
    envProfiles: [
      {
        env: 'production',
        config: { ga4MeasurementId: 'G-VALID1234' },
      },
    ],
    events: [],
    settings: { consentMode: 'v2' },
    createdBy: 'test@femiglow.ma',
    createdAt: new Date('2026-05-14T10:00:00Z'),
    updatedAt: new Date('2026-05-14T10:00:00Z'),
    ...overrides,
  }
}
```

### tests/helpers/load-fixture.ts

```typescript
import { readFileSync } from 'fs'
import { join } from 'path'
import type { TrackingPlan } from '@/lib/tracking/plan/types'

const FIXTURES_DIR = join(__dirname, '../../tests/fixtures/tracking-plans')

export function loadFixture(name: string): TrackingPlan {
  const path = join(FIXTURES_DIR, name)
  const content = readFileSync(path, 'utf-8')
  const parsed = JSON.parse(content)
  
  // Revive dates
  parsed.createdAt = new Date(parsed.createdAt)
  parsed.updatedAt = new Date(parsed.updatedAt)
  
  return parsed
}
```

## Fixtures de base

### tests/fixtures/tracking-plans/valid-production-v8.json

```json
{
  "id": "plan-prod-v8",
  "name": "Production v8",
  "status": "active",
  "version": 8,
  "providers": [
    { "id": "ga4", "active": true },
    { "id": "googleAds", "active": true },
    { "id": "meta", "active": true }
  ],
  "envProfiles": [
    {
      "env": "production",
      "config": {
        "ga4MeasurementId": "G-5VHP17SDZM",
        "googleAdsConversionId": "AW-987654321",
        "metaPixelId": "1234567890123456",
        "gtmContainerId": "GTM-M8K7V88D"
      }
    }
  ],
  "events": [
    {
      "key": "page_view",
      "label": "Page vue",
      "providers": { "ga4": true, "meta": true }
    },
    {
      "key": "purchase",
      "label": "Achat",
      "providers": { "ga4": true, "googleAds": true, "meta": true }
    }
  ],
  "settings": {
    "consentMode": "v2",
    "consentDefaults": {
      "ad_storage": "denied",
      "analytics_storage": "denied"
    }
  },
  "createdBy": "amal@femiglow.ma",
  "createdAt": "2026-05-12T14:21:00Z",
  "updatedAt": "2026-05-12T14:21:00Z"
}
```

### tests/fixtures/tracking-plans/invalid-placeholder.json

```json
{
  "id": "plan-invalid-001",
  "name": "Plan avec placeholder",
  "status": "draft",
  "version": 1,
  "providers": [{ "id": "ga4", "active": true }],
  "envProfiles": [
    {
      "env": "production",
      "config": { "ga4MeasurementId": "G-PROD0000" }
    }
  ],
  "events": [],
  "settings": {},
  "createdBy": "test@test.com",
  "createdAt": "2026-05-14T10:00:00Z",
  "updatedAt": "2026-05-14T10:00:00Z"
}
```

### tests/fixtures/tracking-plans/multi-env-staging.json

```json
{
  "id": "plan-multienv-001",
  "name": "Plan multi-env",
  "status": "draft",
  "version": 1,
  "providers": [{ "id": "ga4", "active": true }],
  "envProfiles": [
    {
      "env": "production",
      "config": { "ga4MeasurementId": "G-PROD123ABC" }
    },
    {
      "env": "staging",
      "config": { "ga4MeasurementId": "G-STAGING456" }
    },
    {
      "env": "local",
      "config": { "ga4MeasurementId": "G-LOCAL789" }
    }
  ],
  "events": [
    { "key": "page_view", "providers": { "ga4": true } }
  ],
  "settings": {},
  "createdBy": "younes@femiglow.ma",
  "createdAt": "2026-05-14T10:00:00Z",
  "updatedAt": "2026-05-14T10:00:00Z"
}
```

## Mocks Drizzle (optionnel pg-mem)

```typescript
// tests/helpers/setup-test-db.ts
import { newDb } from 'pg-mem'
import { drizzle } from 'drizzle-orm/pg-mem'
import { readFileSync } from 'fs'
import * as schema from '@/lib/db/schema/tracking-plan'

export async function setupTestDb() {
  const pgMem = newDb()
  
  // Apply migration
  const migrationSql = readFileSync('drizzle/migrations/0001_tracking_plan.sql', 'utf-8')
  pgMem.public.query(migrationSql)
  
  const adapter = pgMem.adapters.createPg()
  return drizzle(adapter as any, { schema })
}
```

## Mock MSW pour Jest

```typescript
// tests/helpers/setup-msw.ts
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers/tracking'

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Commandes utiles

```bash
# Tous les tests
npm test

# Mode watch
npm test -- --watch

# Un fichier spécifique
npm test src/lib/tracking/plan/validator.test.ts

# Par nom de test
npm test -- --testNamePattern "R-001"

# Avec couverture
npm test -- --coverage

# Mode CI (no watch, max workers)
CI=1 npm test

# Update snapshots
npm test -- -u
```

## Performance tests

Pour mesurer la perf en Jest :
```typescript
it('exportPlan completes in < 50ms for 30 events', () => {
  const plan = buildPlan({
    events: Array.from({ length: 30 }, (_, i) => ({
      key: `event_${i}`,
      providers: { ga4: true },
    })),
  })
  
  const start = performance.now()
  exportPlan(plan, 'production')
  const elapsed = performance.now() - start
  
  expect(elapsed).toBeLessThan(50)
})
```

⚠ Sur CI, les latences peuvent être plus élevées. Marges de sécurité × 2-3.
