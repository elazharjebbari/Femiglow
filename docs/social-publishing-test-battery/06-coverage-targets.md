# Coverage Targets — Social Publishing

## Cibles globales

| Catégorie | Lignes | Branches | Functions | Statements |
|-----------|--------|----------|-----------|------------|
| Composants `create/PublishActionGroup` | ≥ 90% | ≥ 80% | ≥ 85% | ≥ 90% |
| Composants `plan/*` (Calendar, JobQueue, QuickEditDrawer, CalendarCard) | ≥ 85% | ≥ 75% | ≥ 80% | ≥ 85% |
| Composants `home/AccountHealthCard`, `library/LibraryClient` | ≥ 80% | ≥ 70% | ≥ 75% | ≥ 80% |
| Services `lib/social-publishing/*` | ≥ 85% | ≥ 75% | ≥ 80% | ≥ 85% |
| Adapters `lib/social-publishing/adapters/*` | ≥ 90% | ≥ 80% | ≥ 90% | ≥ 90% |
| Routes API `app/api/admin/content-studio/posts/*` + `publish-jobs/*` + `postiz/*` | ≥ 80% | ≥ 70% | ≥ 75% | ≥ 80% |
| Services `lib/content-studio/postiz.ts` | ≥ 85% | ≥ 75% | ≥ 85% | ≥ 85% |
| **Global module** | **≥ 80%** | **≥ 70%** | **≥ 75%** | **≥ 80%** |

## Exclusions justifiées

- Types only (`*.d.ts`)
- Fixtures statiques (`fixtures/*`)
- Mocks (`__mocks__/*`)
- Génération code (`drizzle/*` migrations)
- Stories (`*.stories.tsx`) si présentes

## Configuration vitest.config.ts (extrait)

```ts
coverage: {
  provider: 'v8',
  reporter: ['html', 'lcov', 'text-summary'],
  reportsDirectory: './coverage',
  include: [
    'src/app/api/admin/content-studio/posts/**/*.ts',
    'src/app/api/admin/content-studio/publish-jobs/**/*.ts',
    'src/app/api/admin/content-studio/postiz/**/*.ts',
    'src/components/admin/content-studio-v2/create/PublishActionGroup.tsx',
    'src/components/admin/content-studio-v2/plan/**/*.tsx',
    'src/components/admin/content-studio-v2/home/AccountHealthCard.tsx',
    'src/components/admin/content-studio-v2/library/LibraryClient.tsx',
    'src/lib/social-publishing/**/*.ts',
    'src/lib/content-studio/postiz.ts',
  ],
  exclude: [
    '**/*.d.ts',
    '**/*.stories.tsx',
    '**/fixtures/**',
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/test-helpers/**',
  ],
  thresholds: {
    global: {
      lines: 80, branches: 70, functions: 75, statements: 80,
    },
    'src/components/admin/content-studio-v2/create/PublishActionGroup.tsx': {
      lines: 90, branches: 80, functions: 85, statements: 90,
    },
    'src/lib/social-publishing/adapters/**': {
      lines: 90, branches: 80, functions: 90, statements: 90,
    },
  },
},
```

## Suivi par fichier (post-implémentation)

| Fichier | Cible | Réelle | Δ |
|---------|-------|--------|---|
| `PublishActionGroup.tsx` | 90% | TBD | TBD |
| `JobQueue.tsx` | 85% | TBD | TBD |
| `QuickEditDrawer.tsx` | 85% | TBD | TBD |
| `Calendar.tsx` | 85% | TBD | TBD |
| `CalendarCard.tsx` | 85% | TBD | TBD |
| `AccountHealthCard.tsx` | 80% | TBD | TBD |
| `LibraryClient.tsx` | 80% | TBD | TBD |
| `social-publishing/admin-service.ts` | 85% | TBD | TBD |
| `social-publishing/repository.ts` | 85% | TBD | TBD |
| `social-publishing/worker.ts` | 85% | TBD | TBD |
| `social-publishing/state-machine.ts` | 95% | TBD | TBD |
| `social-publishing/retry.ts` | 95% | TBD | TBD |
| `social-publishing/errors.ts` | 95% | TBD | TBD |
| `adapters/postiz.ts` | 90% | TBD | TBD |
| `adapters/dry-run.ts` | 95% | TBD | TBD |
| `content-studio/postiz.ts` | 85% | TBD | TBD |

À remplir après run initial.

## Exécution

```bash
pnpm vitest run --coverage \
  src/components/admin/content-studio-v2/create/PublishActionGroup.test.tsx \
  src/components/admin/content-studio-v2/plan \
  src/components/admin/content-studio-v2/home/AccountHealthCard.test.tsx \
  src/components/admin/content-studio-v2/library/LibraryClient.test.tsx \
  src/lib/social-publishing \
  src/lib/content-studio/postiz.test.ts \
  src/test/api-contracts/social-publishing-*.contract.test.ts

# HTML report :
xdg-open coverage/index.html
```

## Cas spéciaux

### `worker.ts` — branches lock acquisition
La concurrence acquisition de lock a 3 branches (success, already locked, conflict) — toutes doivent être testées.

### `errors.ts` — table HTTP → code
Tableau exhaustif :
- 401 → `token_expired`
- 403 → `permission_denied`
- 404 → `not_found`
- 408 → `provider_timeout`
- 409 → `conflict`
- 422 → `invalid_payload`
- 425 → `provider_temporarily_unavailable`
- 429 → `provider_rate_limited`
- 5xx → `provider_unavailable`

Tester chaque ligne.

### `state-machine.ts` — matrix 8×8
8 statuts × 8 transitions = 64 cas. La majorité sont invalides (return false). Tester :
- 12 cas valides explicites
- 8 cas mêmes statut (idempotent valide)
- 44 cas invalides

## Anti-pattern coverage

- ❌ Ne pas viser 100% lignes sur les composants UI — quelques branches de style (CSS-in-JS) ne valent pas la peine
- ❌ Ne pas écrire des tests "couvre la ligne" sans valeur métier
- ❌ Ne pas baisser le threshold pour faire passer une PR ; corriger le code OU justifier l'exclusion
