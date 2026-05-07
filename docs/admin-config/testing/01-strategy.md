# Testing — Stratégie

## Pyramide

```
                  ┌─────────────────┐
                  │   Playwright    │   ~5 scénarios
                  │   (e2e admin)   │
                  └─────────────────┘
              ┌──────────────────────────┐
              │   RTL composants admin    │   ~7 fichiers
              │   (NavEditor, RbacEditor) │
              └──────────────────────────┘
        ┌───────────────────────────────────┐
        │   Vitest unit                      │   ~20 fichiers
        │   (cascade, Zod, helpers)          │
        └───────────────────────────────────┘
```

Cible coverage : **90%** sur `apps/web/src/lib/admin-config/**`
(critique, beaucoup de logique de fallback) et **70%** sur les
composants admin.

## Couches testées

### 1. Cascade `getAppConfig()` (unit, Vitest)

Cas critiques :

- Pas de ligne DB → default codé
- Ligne DB valide → deepMerge avec defaults
- Ligne DB invalide (Zod fail) → fallback default + warn loggué
- Ligne DB legacy → migrator → schéma courant
- Ligne DB avec champ inconnu → strip extras (mode permissive en read)

### 2. Schémas Zod (unit, Vitest)

Pour chaque section : 30+ cas (nominal + erreurs).

- nav : key dup, label vide, href sans /, icon vide, position négative
- flags : key invalide, valeur non-bool, top-level non-objet
- rbac : superadmin manquant, action inconnue, ressource inconnue,
  role key invalide
- branding : hex invalide, font hors whitelist, contraste insuffisant

### 3. Routes API (unit, Vitest avec MSW + supertest)

- 401/403 paths (rôle insuffisant pour `flags`/`rbac`)
- 422 Zod fail
- 409 If-Match stale
- Snapshot écrit après PATCH
- `revalidateTag` appelé
- Audit log écrit

### 4. Composants admin (RTL)

- `NavEditor` : ajout/edit/drop reorder/save
- `RbacEditor` : toggle cell, superadmin lock, self-lock
- `BrandingEditor` : color picker, contrast warning
- `FlagsEditor` : toggle, search filter
- `SectionEditorShell` : dirty tracking, confirmation
- `ConfigDiff` : rendu correct du diff JSON

### 5. Helpers / utilitaires

- `deepMerge` : objets, arrays (replace-not-merge), primitives
- `migratePayload` : map legacy → courant
- `computeIsDefault` : équivalence après normalize-keys
- `contrastRatio` : WCAG AA threshold

### 6. Parcours e2e (Playwright)

Cf. scénarios documentés.

## Tests spéciaux

### Test failsafe (critique)

```ts
test('app continue de fonctionner avec une ligne DB corrompue', async () => {
  // INSERT direct d'une ligne invalide
  await db.insert(appConfig).values({
    section: 'nav',
    payload: { items: 'pas-un-array' },
    version: 1,
    updatedBy: 'usr_test',
  });

  const result = await getAppConfig('nav');
  expect(result).toEqual(defaults.nav);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('zod fail'),
    expect.objectContaining({ section: 'nav' }),
  );
});
```

### Test de version (optimistic lock)

```ts
test('PATCH refuse les versions stales', async () => {
  await patchSection('nav', { items: [] }, { version: 1 });
  const stale = await patchSection('nav', { items: [...] }, { version: 1 });
  expect(stale.status).toBe(409);
});
```

### Test cross-module

```ts
test('changer NAV invalide bien le cache de toutes les sections', async () => {
  await patchSection('nav', updatedNav);

  expect(revalidateTag).toHaveBeenCalledWith('app-config');
  expect(revalidateTag).toHaveBeenCalledWith('app-config:nav');
});
```

## Setup testcontainers

Identique à seo-cms / products-cms. Tests Vitest avec tag `@db`
pour les tests qui ont besoin de Postgres réel.

## Fixtures

- `__fixtures__/zod-cases.ts` — 60+ cas par section (valides /
  invalides)
- `__fixtures__/cascade-cases.ts` — 8 scenarios de cascade
- `__fixtures__/migration-cases.ts` — 3 cas legacy → courant

## Règle d'or

Pour ce module, chaque PR doit ajouter :

1. Un test unit pour le nouveau cas (cascade, schéma, helper)
2. Un test failsafe si le changement touche un fallback
3. Un fixture si nouveau shape de payload
