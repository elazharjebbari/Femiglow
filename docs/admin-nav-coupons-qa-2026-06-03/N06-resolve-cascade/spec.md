# N06 — Cascade `resolve` de la section `nav` (DB → defaults, failsafe, `isDefault`)

## Rôle & surface
Cœur de la résolution de configuration : `getSection('nav')` /
`resolveSectionUncached('nav')` (`apps/web/src/lib/admin-config/resolve.ts`) décide quel payload
nav sert l'application et avec quel `meta`. Trois branches : **DB absente** → defaults + `defaultMeta`
(version 0, `isDefault:true`) ; **DB valide** → payload validé + `meta` issu de la row, `isDefault`
calculé par comparaison structurelle au default ; **DB corrompue** → failsafe sur defaults +
`logger.warn('admin_config.zod_fail')` + `meta` de la row avec `isDefault:true`. On mocke
`getAppConfigRow` (frontière DB) et `logger`. Couche **U/I**.
Fichier cible : `src/lib/admin-config/resolve.nav.test.ts` (nouveau).

> **Extension, pas duplication.** Aucune couverture ciblée nav du failsafe / `isDefault` n'existe
> (cf. overview §3). On teste ici spécifiquement la section `nav` ; `defaults-legal.test.ts` couvre
> une autre section et n'est pas rejoué.

## Fonctionnement optimal (ce qui DOIT se passer)
1. **DB absente** (`getAppConfigRow` → `null`) : `resolveSectionUncached('nav')` retourne
   `{ section:'nav', payload: getDefault('nav'), meta: { version:0, updatedAt: new Date(0).toISOString(),
   updatedBy:null, isDefault:true } }`. `logger.warn` **non** appelé.
2. **DB valide non-default** (row.payload = nav modifié valide, version 4, updatedBy renseigné) :
   `safeValidate` réussit → `payload === validated`. `isDefault = JSON.stringify(validated) ===
   JSON.stringify(getDefault('nav'))` → **false** (payload diffère du default). `meta` =
   `{ version:4, updatedAt: row.updatedAt en ISO, updatedBy, isDefault:false }`.
3. **DB valide == default** (row.payload structurellement identique à `navDefault`, version 2) :
   `isDefault === true` (comparaison `JSON.stringify`), mais `meta.version === 2` (≠ 0) et le payload
   vient de la DB (pas du failsafe). Distingue « égal au défaut » de « absent ».
4. **DB corrompue** (row.payload viole `navSchema`, ex. clé dupliquée ou href invalide, version 7) :
   `safeValidate` → `null` (+ `logger.warn('admin_config.zod_fail', { section:'nav', issues:[…≤6] })`) →
   **failsafe** : `payload === getDefault('nav')`, `meta = rowMeta(row, true)` ⇒ `version:7`,
   `isDefault:true`. Aucun crash.
5. **`updatedAt` en `Date` vs string** : `rowMeta` normalise (`instanceof Date ? toISOString() :
   String(updatedAt)`).

## Contrat I/O
- **Mock** : `vi.mock('@/lib/db/queries/app-config', () => ({ getAppConfigRow: vi.fn() }))` ;
  `vi.mock('@/lib/logging/logger', () => ({ logger: { warn: vi.fn(), … } }))`.
- **Sous test** : préférer `resolveSectionUncached` si exporté, sinon `getSection('nav')` (le wrap
  `unstable_cache` doit être neutralisé/mocké `next/cache` → exécution directe de la closure).
- **Entrée** : row `PlainRow { section, payload, version, updatedAt, updatedBy }` ou `null`.
- **Sortie** : `ResolvedSection<'nav'> { section, payload, meta }`.

## Cas limites & non-happy-path
- **Payload `null`/`undefined` en DB** (row existe mais payload nul) → `safeValidate` échoue → failsafe.
- **Payload non-objet** (string, number) → failsafe + warn.
- **`items` manquant** → failsafe + warn.
- **Clé dupliquée** (passe les items mais échoue `superRefine`) → failsafe (vérifie que le
  `superRefine` est pris en compte par `safeValidate`).
- **`updatedBy` null** → `meta.updatedBy === null` sans crash.
- **`updatedAt` string** (déjà ISO) → recopié via `String()`.
- **issues tronquées à 6** dans le warn (`issues.slice(0,6)`).
- **`getAppConfig()`** agrège : si `nav` corrompue mais `flags` OK, `getAppConfig().nav ===
  getDefault('nav')` et `meta.nav.isDefault === true`, sans affecter les autres sections.
- **Comparaison structurelle sensible à l'ordre des clés** : `JSON.stringify` ⇒ un payload aux mêmes
  valeurs mais clés réordonnées pourrait diverger → documenter comme limite (test informatif).

## Invariants couverts
- **NAV-INV-FAILSAFE** : payload DB invalide ⇒ retombe sur `defaults`, jamais de crash, warn loggé.
- **NAV-INV-CONFIG** : le payload servi en l'absence/corruption = `navDefault` (valide par N05).
- Badge `isDefault` fiable (distingue absent / égal-défaut / personnalisé).

## Critères d'acceptation (observables)
- DB null → `payload === getDefault('nav')`, `meta.version === 0`, `meta.isDefault === true`,
  `logger.warn` non appelé.
- DB valide non-default → `payload` = row.payload validé, `meta.isDefault === false`,
  `meta.version === 4`.
- DB valide == default → `meta.isDefault === true`, `meta.version === 2`.
- DB corrompue → `payload === getDefault('nav')`, `meta.version === 7`, `meta.isDefault === true`,
  `logger.warn` appelé 1× avec `'admin_config.zod_fail'` et `{ section:'nav' }`.
- `meta.issues` du warn ≤ 6 éléments.
- `getAppConfig()` : `nav` corrompue n'altère pas `flags`/`rbac`/`branding`.

## Points à vérifier — tous points de vue
- Backend : ordre des branches (null avant validate avant isDefault), normalisation `updatedAt`.
- Frontend : `meta.isDefault` pilote le badge « valeur défaut » dans `SectionEditorShell`.
- UI/UX : un failsafe doit rester invisible côté opérateur (pas d'écran cassé).
- Data : `logger.warn` est la SEULE trace d'une corruption — vérifier sa présence (lacune d'audit).
- A11y : N/A.
- i18n : N/A (payload structurel).
