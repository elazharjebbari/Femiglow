# Coverage Targets — Content Studio v2 Create

## Cibles globales

| Catégorie | Lignes | Branches | Functions | Statements |
|-----------|--------|----------|-----------|------------|
| Composants `/create/*` | ≥ 85% | ≥ 75% | ≥ 80% | ≥ 85% |
| Services `lib/content-studio/services/*` | ≥ 80% | ≥ 70% | ≥ 75% | ≥ 80% |
| Hooks + state `lib/content-studio-v2/state/*` | ≥ 90% | ≥ 80% | ≥ 85% | ≥ 90% |
| Models registry `lib/content-studio-v2/models/*` | ≥ 95% | ≥ 90% | ≥ 95% | ≥ 95% |
| Routes API `app/api/admin/content-studio/*` | ≥ 80% | ≥ 70% | ≥ 75% | ≥ 80% |
| **Global** | **≥ 75%** | **≥ 65%** | **≥ 70%** | **≥ 75%** |

## Exclusions justifiées

- Types only (`*.d.ts`) — pas de runtime
- Fixtures statiques (`fixtures/*`) — données de test
- Mocks (`__mocks__/*`)
- Stories (`*.stories.tsx`) si présentes
- Génération code automatique (`drizzle/*` migrations)

## Configuration vitest.config.ts

```ts
coverage: {
  provider: 'v8',
  reporter: ['html', 'lcov', 'text-summary'],
  reportsDirectory: './coverage',
  include: [
    'src/app/api/admin/content-studio/**/*.ts',
    'src/components/admin/content-studio-v2/**/*.{ts,tsx}',
    'src/lib/content-studio-v2/**/*.{ts,tsx}',
    'src/lib/content-studio/services/**/*.ts',
    'src/lib/content-studio/state-machine.ts',
  ],
  exclude: [
    '**/*.d.ts',
    '**/*.stories.tsx',
    '**/fixtures/**',
    '**/__tests__/**',
    '**/__mocks__/**',
  ],
  thresholds: {
    global: {
      lines: 75,
      branches: 65,
      functions: 70,
      statements: 75,
    },
    'src/components/admin/content-studio-v2/create/**': {
      lines: 85, branches: 75, functions: 80, statements: 85,
    },
    'src/lib/content-studio-v2/state/**': {
      lines: 90, branches: 80, functions: 85, statements: 90,
    },
  },
},
```

## Exécution

```bash
pnpm vitest run --coverage \
  src/components/admin/content-studio-v2/create \
  src/lib/content-studio-v2 \
  src/lib/content-studio \
  src/app/api/admin/content-studio

# Rapport
xdg-open coverage/index.html
```

## Suivi par fichier (post-implémentation)

| Fichier | Cible | Réelle | Δ |
|---------|-------|--------|---|
| `Stepper.tsx` | 90% | TBD | TBD |
| `ModelPicker.tsx` | 90% | TBD | TBD |
| `IntentionForm.tsx` | 85% | TBD | TBD |
| `MediaStudio.tsx` | 85% | TBD | TBD |
| `VariantsCompare.tsx` | 85% | TBD | TBD |
| `ApproveButton.tsx` | 95% | TBD | TBD |
| `PublishActionGroup.tsx` | 85% | TBD | TBD |
| `StudioContext.tsx` | 90% | TBD | TBD |
| `registry.ts` | 95% | TBD | TBD |
| `generation.ts` | 80% | TBD | TBD |
| `image-generation.ts` | 80% | TBD | TBD |
| `video-generation.ts` | 80% | TBD | TBD |

À remplir après run coverage initial.
