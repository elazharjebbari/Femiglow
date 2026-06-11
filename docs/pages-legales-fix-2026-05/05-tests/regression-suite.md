# Suite de non-régression

## Baseline actuelle

- Vitest : 7159 / 7171 tests verts
- Playwright : 41 specs (pas tous run récemment)

## Tests critiques à valider

| Fichier | Pourquoi critique |
|---|---|
| `src/lib/legal/vars.test.ts` | Existing : valide `presetVars`, `substituteVars`, `detectMissingVars` |
| `src/lib/legal/publish.test.ts` | Existing : valide le flow publish complet |
| `src/lib/legal/repository-search.test.ts` | Existing : valide les filtres list |
| `src/lib/legal/fuzz.test.ts` | Existing : fuzz random pour edge cases |
| `src/test/integration/legal-lifecycle.test.ts` | Existing : full lifecycle E2E avec DB |
| `src/test/integration/legal-api-admin.test.ts` | Existing : endpoints admin |

## Vérification

```bash
# Avant fix
pnpm vitest run 2>&1 | tail -5 > /tmp/baseline.txt

# Après fix
pnpm vitest run 2>&1 | tail -5 > /tmp/after.txt

# Diff
diff /tmp/baseline.txt /tmp/after.txt
# Attendu : Tests count idem ou plus
```

## Tests à mettre à jour (optionnel)

Si `legal-lifecycle.test.ts` utilise `COMPANY_EMAIL` dans ses fixtures, le mettre à jour pour utiliser `CONTACT_EMAIL` :

```diff
- await createTemplateVar({ key: 'COMPANY_EMAIL', value: 'test@x.com' });
+ await createTemplateVar({ key: 'CONTACT_EMAIL', value: 'test@x.com' });
```

Vérification : grep dans les tests existants

```bash
grep -rn "COMPANY_EMAIL\|HOSTING_NAME\|CNDP_DECLARATION[^_]" apps/web/src/lib/legal apps/web/src/test/integration 2>&1 | grep "\.test\."
```

Si occurrences trouvées : à mettre à jour pour matcher le nouveau naming.

## Tests Playwright legal existants

```bash
ls apps/web/e2e/ | grep -i legal
# legal-redirects.spec.ts, legal-public.spec.ts, etc. ?
```

À vérifier qu'ils ne s'appuient pas sur le legacy naming.

## Anti-patterns à éviter

- ❌ Modifier les tests existants sans raison (juste pour les faire passer)
- ❌ Mocker `isLegalVarsV2Enabled` pour le forcer à `true` partout (mock seulement quand pertinent)
- ❌ Casser un test existant et l'ajouter à un "ignore list"
- ❌ Test qui dépend de `Date.now()` sans `vi.useFakeTimers()`

## Validation finale avant ship

- [ ] `pnpm vitest run` : Tests >= baseline
- [ ] `pnpm typecheck` : 0 nouvelle erreur sur fichiers touchés
- [ ] `pnpm lint` : 0 nouvelle warning sur fichiers touchés
- [ ] `pnpm playwright test --grep @legal-purity` : 7/7 verts
- [ ] `pnpm tsx scripts/smoke-legal-purity.ts` : exit 0
- [ ] Manual smoke admin : créer + publier une page test
