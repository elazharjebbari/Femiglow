# Suite de non-régression — tests à NE PAS casser

> Liste des tests existants qui doivent continuer à passer après le merge.

## 1. Baseline actuelle

Avant les changements :
- **Vitest** : 7159 / 7171 tests verts (99.83%)
- **Playwright** : 41 specs créées (à exécuter pour baseline)

Après les changements, on doit avoir **autant ou plus** de tests verts. Aucun test précédemment vert ne doit devenir rouge.

## 2. Tests critiques à valider en priorité

### 2.1 chat_session insert paths

| Fichier | Pourquoi critique |
|---|---|
| `src/lib/chat/repos/session.test.ts` | Vérifie `create()` génère bien un ID + insert |
| `src/lib/checkout/repos/session-repo.test.ts` | Vérifie `ensureForWizard()` idempotence |
| `src/lib/checkout/repos/session-repo.live-db.test.ts` (si présent) | Tests live-DB |

### 2.2 Routes API

| Fichier | Pourquoi critique |
|---|---|
| `src/app/api/checkout/lead/route.test.ts` (à créer s'absent) | Smoke POST /api/checkout/lead |
| `src/app/api/chat/session/route.test.ts` | Smoke GET /api/chat/session |
| `src/app/api/chat/message/route.test.ts` | Smoke POST /api/chat/message |

### 2.3 Admin queries

| Fichier | Pourquoi critique |
|---|---|
| `src/lib/chat/admin/queries.test.ts` | Test existant — doit toujours passer (modifie le mock pour kind) |
| `src/lib/db/queries/leads.union.test.ts` | Union admin leads (chat + wizard) — doit rester unchanged |

### 2.4 Pages admin

| Fichier | Pourquoi critique |
|---|---|
| `src/app/admin/chat/conversations/page.test.tsx` (si présent) | Pas casser le RSC |
| `src/app/admin/chat/leads/page.test.tsx` (si présent) | Pas casser le RSC |
| `src/app/admin/leads/page.test.tsx` (si présent) | Pas casser la vue globale |

## 3. Stratégie de vérification

### 3.1 Avant chaque commit

```bash
# Quick check (1-2 min)
pnpm vitest run --reporter=verbose src/lib/chat/admin/ src/lib/chat/repos/ src/lib/checkout/repos/
```

### 3.2 Avant chaque PR

```bash
# Full check (3-5 min)
pnpm vitest run
pnpm typecheck
pnpm lint
```

### 3.3 Avant chaque merge

```bash
# Playwright complet (10-15 min)
pnpm playwright test
```

### 3.4 Avant deploy prod

```bash
# Smoke + audit final
pnpm tsx scripts/smoke-chat-purity.ts --url https://staging.femiglow-maroc.com
pnpm vitest run --coverage
```

## 4. Tests à mettre à jour (pas casser)

Certains tests existants utilisent des fixtures `chatSession` ou `chatLead` sans préciser `kind`/`source`. Ils continueront à fonctionner grâce au default DB, MAIS on peut explicitement les enrichir pour clarté :

**Fichier** : `src/lib/chat/admin/queries.test.ts`

```diff
 const makeChatSession = (overrides: Partial<ChatSessionRow> = {}): ChatSessionRow => ({
   id: 'cs_default',
+  kind: 'chat',
   visitorId: 'v_default',
   // ...
   ...overrides,
 });
```

C'est **optionnel** mais améliore la lisibilité. Aucune cassure de test sans ça.

## 5. Liste des tests existants à exécuter pour baseline

```bash
# Baseline avant fix
pnpm vitest run 2>&1 | tail -10 > /tmp/baseline-before.txt

# Exemple expected output:
# Test Files  732 passed (739)
#      Tests  7159 passed | 11 skipped (7171)

# Après fix
pnpm vitest run 2>&1 | tail -10 > /tmp/baseline-after.txt

# Diff
diff /tmp/baseline-before.txt /tmp/baseline-after.txt
# Attendu : Tests counts identiques ou supérieurs après fix
```

## 6. Tests à archiver / déprécier (aucun)

Aucun test existant n'est rendu obsolète par ce fix. Tous restent valides.

## 7. Tests à enrichir (recommandé)

| Fichier | Enrichissement |
|---|---|
| `src/lib/chat/admin/queries.test.ts` | Ajouter cas `kind=wizard_pivot` dans fixtures |
| `src/lib/checkout/repos/session-repo.test.ts` | Vérifier `kind='wizard_pivot'` explicitement |
| `src/lib/db/queries/leads.union.test.ts` | Ajouter cas avec mix `source` valeurs |

## 8. Tests interdiction

Tests à NE PAS ajouter (pour éviter la sur-complexité) :

- ❌ Test qui hardcode l'ordre des rows dans la table (fragile)
- ❌ Test qui dépend du contenu exact du `/admin/chat/audit` SSR (UI peut évoluer)
- ❌ Test qui s'appuie sur `Math.random()` ou `Date.now()` sans `vi.useFakeTimers()`
- ❌ Test qui réutilise une row DB entre 2 tests (fuite d'état)

## 9. Validation finale avant ship

Checklist :

- [ ] `pnpm vitest run` → Tests >= 7159 verts (idem ou +)
- [ ] `pnpm typecheck` → 0 erreur dans les fichiers touchés (le reste = legacy)
- [ ] `pnpm lint` → 0 nouvelle warning sur fichiers touchés
- [ ] `pnpm playwright test --grep @chat-purity` → 4 specs vertes
- [ ] `pnpm playwright test --grep @a11y` → 6 spec a11y vertes
- [ ] `pnpm tsx scripts/smoke-chat-purity.ts` → exit 0

## 10. Que faire si un test régresse

1. **STOP** — ne pas merge.
2. Identifier le test : `pnpm vitest run --reporter=verbose <path>`.
3. Analyser :
   - Est-ce une vraie régression (fix casse quelque chose) ?
   - Ou un test fragile (timing, ordre, fixture obsolète) ?
4. Si vraie régression : revert le commit fautif, ré-analyser le fix.
5. Si test fragile : ajuster le test (commit séparé) + ajouter à `regression-suite.md` la note.

## 11. Tests post-shipping (J+30)

Une fois le flag passé en default `true` (sprint suivant), on pourra :
- Retirer les conditions `if (isChatAdminFiltersV2Enabled())` (simplifier le code)
- Mettre à jour les tests pour assumer toujours filtres ON
- Archiver `feature-flag.test.ts` (plus de flag à tester)
