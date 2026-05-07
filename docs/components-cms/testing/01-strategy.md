# T1 — Stratégie de test

> Pyramide, cibles de couverture, conventions, gates CI. Cadre commun
> aux 5 docs suivants (T2 → T6).

## Pyramide

```
                          ┌──────────────┐
                          │  Playwright  │   ~10–15 specs
                          │     E2E      │   parcours admin
                          └──────────────┘
                       ┌──────────────────────┐
                       │  RTL Component       │   ~40 specs
                       │  (éditeurs + engine) │   en isolation
                       └──────────────────────┘
                  ┌────────────────────────────────┐
                  │  Vitest + MSW (intégration)    │   ~25 specs
                  │  (routes API admin, mocks DB)   │
                  └────────────────────────────────┘
            ┌─────────────────────────────────────────────┐
            │  Vitest unit                                 │   ~80–120 specs
            │  (resolver, cascade, encoders, validators)   │
            └─────────────────────────────────────────────┘
```

| Couche | Outil | Quoi | Vitesse | Cible |
|---|---|---|---|---|
| Unit | Vitest | logique pure, encoders, validators, resolver | < 50 ms / fichier | majorité des tests |
| Intégration | Vitest + MSW + node | route handlers `/api/admin/components/**` avec store in-memory | < 200 ms / fichier | un fichier par endpoint |
| Component | RTL | éditeurs F1, form-engine F3, panneau d'édition | < 100 ms / fichier | un fichier par éditeur |
| E2E | Playwright | parcours bout en bout admin + preview RSC | 5–30 s / spec | 1 nominal + 3 erreurs par page-group |

## Pourquoi cette répartition

- **D4** (cf. A1) : pas de Server Actions, donc tout passe par REST.
  MSW intercepte ces flux côté Node (intégration) ET côté navigateur
  (RTL), ce qui rend la couche intégration moins coûteuse à écrire
  qu'une vraie DB Postgres en CI.
- **A3 cascade** (8 EC) et **A4 versioning** (5 erreurs E1–E5) sont
  testables en pur unitaire sur le resolver et le service de
  publication. C'est là qu'on absorbe la majorité de la couverture.
- **A6 RBAC** est binaire : 5–6 tests d'intégration suffisent.

## Cibles de couverture

> Mesurées par `vitest --coverage` (V8). CI bloque si le seuil baisse.

| Chemin | Branches | Lines | Functions |
|---|---|---|---|
| `apps/web/src/lib/components/fields/**` | ≥ 85 % | ≥ 85 % | ≥ 90 % |
| `apps/web/src/components/admin/components/fields/**` | ≥ 85 % | ≥ 85 % | ≥ 85 % |
| `apps/web/src/app/api/admin/components/[key]/fields/**` | ≥ 85 % | ≥ 85 % | ≥ 85 % |
| `apps/web/src/lib/db/queries/component-fields.ts` | ≥ 90 % | ≥ 90 % | ≥ 90 % |
| Reste du repo | inchangé (pas de régression) | | |

Les fichiers `*.test.ts(x)` et `*.fixtures.ts` sont exclus du calcul.

## Convention de nommage

```
src/lib/components/fields/resolver.ts             ─► resolver.test.ts
src/lib/components/fields/encoders.ts             ─► encoders.test.ts
src/lib/components/fields/validators.ts           ─► validators.test.ts
src/lib/components/fields/cascade.ts              ─► cascade.test.ts
src/components/admin/components/fields/TextEditor.tsx ─► TextEditor.test.tsx
src/test/integration/admin-component-fields.test.ts   (route handler)
src/test/integration/admin-component-fields-publish.test.ts
e2e/admin-components-fields.spec.ts               (Playwright)
e2e/admin-components-fields-conflict.spec.ts
```

- Tests unitaires et RTL **colocalisés** avec la source (`foo.test.ts`).
- Tests d'intégration MSW dans `src/test/integration/` (suit
  l'existant, cf. `admin-component-binding-mutations.test.ts`).
- Specs E2E dans `apps/web/e2e/`.

## Gates CI

| Étape | Commande | Bloque ? |
|---|---|---|
| Lint | `pnpm --filter @femiglow/web lint` | ✅ |
| Typecheck | `pnpm --filter @femiglow/web typecheck` | ✅ |
| Unit + intégration | `pnpm --filter @femiglow/web test` | ✅ |
| Coverage threshold | `pnpm --filter @femiglow/web test:coverage` | ✅ |
| Build | `pnpm --filter @femiglow/web build` | ✅ |
| Playwright (PR) | `pnpm --filter @femiglow/web test:e2e --grep @cms` | ✅ |
| Playwright complet | nightly main | informatif |
| axe-core (RTL) | inclus dans test | ✅ |

## Politique flaky-test

1. **Aucun test flaky merger sur `main`**. Si un test échoue
   intermittemment en CI, il est **quarantiné** (`test.skip`) avec un
   ticket associé sous 24 h.
2. **Pas de `retry()` Playwright** sur les specs CMS. Si on doit
   retry, c'est une race condition à corriger (cf. EC6, E1).
3. **`vi.useFakeTimers()`** pour tout test impliquant un timer
   (debounce, scheduling, cron). Pas de `setTimeout` réels.
4. **`vi.setSystemTime()`** pour les tests qui dépendent de `now()`
   (scheduledAt, publishedAt).
5. **MSW `onUnhandledRequest: 'error'`** force la déclaration de
   chaque endpoint utilisé. Pas de fetch réel qui passe.
6. **Reset complet entre tests** :
   - `resetMemoryStore()` (DB in-memory),
   - `server.resetHandlers()` (MSW),
   - `vi.clearAllMocks()`.

## AAA — Arrange / Act / Assert

Chaque test suit la structure :

```ts
it('publie un draft et archive l\'ancien published', async () => {
  // Arrange
  const seed = makeSeed({ key: 'home-hero', fields: [{ key: 'title', type: 'text', required: true }] });
  const component = await upsertSiteComponentFromSeed(seed);
  await upsertFieldBinding({ componentId: component.id, fieldKey: 'title', status: 'published', value: { v: 'V1' }, version: 1 });
  const draft = await upsertFieldBinding({ componentId: component.id, fieldKey: 'title', status: 'draft', value: { v: 'V2' } });

  // Act
  const published = await publishFieldBinding(draft.id, { actorId: 'adm_1' });

  // Assert
  expect(published.status).toBe('published');
  expect(published.version).toBe(2);
  const old = await getBindingByVersion(component.id, 'title', 1);
  expect(old?.status).toBe('archived');
});
```

## Ce qu'on ne teste pas

- **Le code Drizzle généré** (migrations, schema). On teste les
  query helpers, pas l'ORM.
- **Le DOM exact d'un éditeur** (snapshots HTML). On teste des
  comportements (rôles ARIA, valeurs, callbacks), pas du markup.
- **Le rendu visuel** des composants admin (couleurs, espacements).
  Couvert par Storybook si besoin, pas par les tests fonctionnels.
- **`unstable_cache`** lui-même : on le mocke (cf. T2). On teste
  qu'on appelle `revalidateTag` aux bons endroits.
- **Les erreurs réseau Postgres** en intégration : couvert par les
  tests Drizzle existants. Notre store in-memory simule la sémantique
  (UNIQUE, CASCADE).

## Scénarios obligatoires (cross-ref)

> Chacun de ces scénarios doit avoir **au moins un test** avant la
> mise en production.

| Source | Scénario | Couche | Doc |
|---|---|---|---|
| A3 EC1 | Champ supprimé du registre | Unit | T2 §Cascade |
| A3 EC2 | Champ ajouté au registre | Unit | T2 §Cascade |
| A3 EC3 | Type changé (interdit) | Unit | T2 §Cascade |
| A3 EC4 | Locale absente → fallback | Unit | T2 §Cascade |
| A3 EC5 | Cache stale après publish | Intégration | T3 §publish |
| A3 EC6 | Race deux drafts simultanés | Intégration + RTL | T3 §conflict, T4 |
| A3 EC7 | Binding orphelin (CASCADE) | Unit query | T2 |
| A3 EC8 | Fuseau horaire `scheduledAt` | Unit | T2 §Scheduling |
| A4 E1 | Publish d'un draft modifié entre temps | Intégration | T3 §publish |
| A4 E2 | Publish d'un champ supprimé | Intégration | T3 §publish |
| A4 E3 | Schedule dans le passé | Intégration | T3 §schedule |
| A4 E4 | Restore d'un champ supprimé | Intégration | T3 §restore |
| A4 E5 | Race cron de promotion | Unit | T2 §cron |
| A6 | PATCH sans auth (401) | Intégration | T3 |
| A6 | PATCH user inactif (403) | Intégration | T3 |
| A6 | XSS rich-text | Unit (sanitize) | T2 |
| A6 | Open redirect cta.href | Unit (Zod) | T2 |
| A6 | CSRF sans header | Intégration | T3 |
| A6 | Rate-limit | Intégration | T3 |
| F1 | Chaque éditeur (text, cta, icon, …) en isolation | RTL | T4 |
| F3 | Form-engine dirty-tracking | RTL | T4 |
| F4 | Live preview iframe postMessage | RTL + E2E | T4 + T5 |
| Tous | Parcours nominal par page-group | E2E | T5 |

## Cross-références

- A1 §Qualité (cibles), A3 §Edge cases, A4 §Erreurs, A6 §Tests sécurité.
- F1 (registry d'éditeurs), F2 (RSC helpers), F3 (form-engine), F4 (preview).
- B1 (routes), B2 (Zod), B3 (cache).
- T2 → T6 pour le détail par couche.
