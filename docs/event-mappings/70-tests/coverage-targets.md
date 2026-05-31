# 70.6 — Coverage targets

## Cibles par module

| Module | Lines | Branches | Functions | Statements |
|---|---|---|---|---|
| `lib/tracking/mappings/store.ts` | ≥ 90% | ≥ 85% | ≥ 95% | ≥ 90% |
| `lib/tracking/mappings/resolver.ts` | ≥ 95% | ≥ 90% | 100% | ≥ 95% |
| `lib/tracking/mappings/validator.ts` | ≥ 95% | ≥ 90% | 100% | ≥ 95% |
| `lib/tracking/mappings/gtm-export.ts` | ≥ 85% | ≥ 80% | ≥ 90% | ≥ 85% |
| `lib/tracking/mappings/audit.ts` | ≥ 90% | ≥ 85% | 100% | ≥ 90% |
| `app/api/admin/tracking/events/mappings/**/*.ts` | ≥ 80% | ≥ 75% | ≥ 85% | ≥ 80% |
| `components/admin/tracking/mappings/**/*.tsx` | ≥ 75% | ≥ 70% | ≥ 80% | ≥ 75% |
| **Global module** | **≥ 85%** | **≥ 80%** | **≥ 90%** | **≥ 85%** |

## Enforcement CI

```yaml
# .github/workflows/test-event-mappings.yml
- name: Vitest with coverage threshold
  run: pnpm --filter @femiglow/web exec vitest run \
       --coverage \
       --coverage.threshold.lines=85 \
       --coverage.threshold.branches=80 \
       --coverage.threshold.functions=90 \
       --coverage.include="src/lib/tracking/mappings/**" \
       --coverage.include="src/app/api/admin/tracking/events/mappings/**"
```

## Trous documentés acceptables

- **Code branches Drizzle vs memoryStore** : on teste l'un seulement, l'autre par induction. Couvert par l'integration test qui exerce la branche Drizzle.
- **Erreurs réseau dans gtm-export** : le code ne fait pas de réseau, donc pas applicable.
- **Code de bootstrap (seed)** : couvert par 1 test idempotent. Pas besoin de répéter.

## Sanity checks au-delà du coverage

- ✅ Le test ULTIMATE round-trip GTM passe (T54)
- ✅ Le test drift `check-default-mapping` passe (T60)
- ✅ Aucun `// @ts-ignore` ni `eslint-disable` non justifié
- ✅ Bundle size client < +30 KB par rapport à baseline avant ce module
