# Tests Jest

Cette section décrit les tests unitaires et d'intégration via Jest.

## Structure

```
apps/web/
├── __tests__/
│   └── lib/
│       └── tracking/
│           └── plan/
│               ├── types.test.ts
│               ├── validator.test.ts
│               ├── exporter.test.ts
│               ├── differ.test.ts
│               ├── cache.test.ts
│               ├── defaults.test.ts
│               ├── repository.test.ts        ← intégration DB
│               ├── service.test.ts            ← intégration
│               └── audit.test.ts              ← intégration DB
└── src/
    └── components/
        └── tracking/
            └── __tests__/
                ├── IdInput.test.tsx
                ├── Stepper.test.tsx
                ├── EventMatrixRow.test.tsx
                ├── JsonPreview.test.tsx
                ├── StatusCard.test.tsx
                └── TrackingPlanWizard.test.tsx
```

## Fichiers de spécification dans cette folder

| Fichier | Description |
|---|---|
| [validator.spec.md](validator.spec.md) | Spec des tests validator |
| [exporter.spec.md](exporter.spec.md) | Spec des tests exporter (déterminisme) |
| [repository.spec.md](repository.spec.md) | Spec des tests repository (DB) |
| [components.spec.md](components.spec.md) | Spec des tests composants |
| [setup.md](setup.md) | Setup Jest, mocks globaux |

## Configuration Jest

`jest.config.js` :
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': '<rootDir>/__mocks__/style.ts',
  },
  collectCoverageFrom: [
    'src/lib/tracking/plan/**/*.{ts,tsx}',
    'src/components/tracking/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
}
```

## Commandes

```bash
npm test                              # tous les tests
npm test -- --watch                    # mode watch
npm test -- --coverage                 # avec couverture
npm test path/to/file.test.ts          # un seul fichier
npm test -- --testNamePattern "valid"  # par nom
```
