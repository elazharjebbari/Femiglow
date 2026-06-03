# F16 — E2E Parcours opérateur (créer → activer → effet /kit → grants)

## Rôle & surface

Parcours bout-en-bout **Playwright** du point de vue de l'opérateur **Karim** (admin
authentifié). Il couvre la boucle de vie complète d'un coupon d'accueil vue depuis
l'interface, puis l'effet sur la vitrine cliente, puis la consultation des codes de
fidélité émis avec masquage PII.

- **Surfaces** : `/admin/coupons` (back-office) → `/kit` (vitrine) → retour `/admin/coupons`.
- **Composant principal** : `CouponsManager.tsx` (`src/components/admin/coupons/`).
- **Fichier cible** : `e2e/admin-coupons-loyalty.spec.ts` (NOUVEAU — **étend**, ne duplique
  pas, `admin-coupons.spec.ts` : on garde le smoke create→activate existant et on ajoute
  la traversée /kit + grants + masquage).
- **Tag** : `@admin-coupons-e2e` (famille `@admin-coupons-*`).
- **Auth** : `test.use({ storageState: ADMIN_STORAGE_PATH })` — session pré-calculée par
  `global.setup.ts` (projet `setup`). Aucun passage par le formulaire de login dans ce spec
  (ce cas est couvert par `admin-coupons.spec.ts` `@admin-coupons-auth`).

## Fonctionnement optimal (ce qui DOIT se passer)

1. **Arrivée admin.** `page.goto('/admin/coupons')`. Le conteneur
   `[data-testid="coupons-manager"]` est visible ; le titre `Coupons` (heading `h1`) est rendu.
2. **Création d'un brouillon.** Karim remplit le champ `aria-label="Libellé"` avec un
   libellé unique horodaté (ex. `Geste d'accueil E2E 16:42:07`) pour éviter toute collision
   entre runs parallèles. Le champ `aria-label="Montant offert"` reste à son défaut (9000
   centimes). Clic sur le bouton `Créer (brouillon)`.
3. **Apparition de la ligne.** Après le `refresh()` interne (POST puis GET `/api/admin/coupons`),
   une ligne `[data-testid^="coupon-row-"]` portant le libellé unique apparaît. Sa cellule
   statut `[data-testid^="coupon-status-"]` affiche **`Brouillon`**.
4. **Activation.** Sur cette ligne, clic sur le bouton `Activer`. Après transition + refresh,
   la cellule statut affiche **`Actif`** et le bouton `Activer` disparaît (remplacé par
   `Pauser` + `Archiver`).
5. **Effet vitrine — parité prix.** `page.goto('/kit')`. Le bloc
   `[data-testid="pack-price-block"]` est scrollé en vue ; la ligne
   `[data-testid="pack-price-line"]` contient **`199`** (INV-PRICE : le geste d'accueil
   `welcome_auto` à −90 MAD ramène 289 → 199, le prix affiché EST le prix débité). Si une
   note d'accueil `[data-testid="coupon-welcome-note"]` est rendue, elle contient
   `geste d'accueil` et reste conforme charte (pas de `!`, pas d'emoji).
6. **Retour admin + grants.** Retour `/admin/coupons`. Dans la section
   `[data-testid="coupons-grants-section"]`, clic sur le bouton `Charger`. La table
   `[data-testid="coupons-grants-table"]` apparaît. Soit elle liste des lignes
   `[data-testid^="grant-row-"]` dont la cellule téléphone est **masquée** (motif `06…78`,
   jamais 9 chiffres consécutifs), soit elle affiche `Aucun code émis.` (env. frais).

## Contrat I/O

| Geste | Appel réseau | Attendu |
|---|---|---|
| Créer (brouillon) | `POST /api/admin/coupons` (body `type:welcome_auto, status:draft, valueAmount`) | 201 puis `GET /api/admin/coupons` (refresh) |
| Activer | `POST /api/admin/coupons/{id}/status` (body `{status:'active'}`) | 200 puis refresh |
| Charger grants | `GET /api/admin/coupons/grants` | 200, `{ items: GrantRow[] }`, téléphone **déjà masqué** côté réponse |
| Effet /kit | rendu SSR (`resolveProductPricing`) | `pack-price-line` contient `199` |

Attente réseau : `page.waitForResponse((r) => r.url().includes('/api/admin/coupons') && r.request().method() === 'POST')` pour la création/transition ; **jamais** `waitForTimeout`.

## Cas limites & non-happy-path

- **Pas de session** (couvert par `admin-coupons.spec.ts`) : `/admin/coupons` → redirection
  `/admin/login`. Ne PAS dupliquer ici ; référencer.
- **Collision de libellés** entre workers parallèles → utiliser un libellé horodaté +
  cibler la ligne par `hasText` du libellé unique (`page.locator('[data-testid^="coupon-row-"]', { hasText })`).
- **Idempotence d'état seed** : un `welcome_auto` peut déjà être actif (seed). Le test crée
  TOUJOURS son propre coupon ; il n'asserte la parité 199 que comme invariant global, pas la
  présence forcée de la note (cf. robustesse de `coupon-welcome.spec.ts`).
- **Grants vides** sur env. frais : accepter `Aucun code émis.` OU des lignes masquées
  (assertion en `or`). Ne jamais exiger une ligne précise sans seed dédié.
- **PII** : asserter que la cellule téléphone NE matche PAS `/\d{9}/` (anti-régression INV-PII).
- **Compile-on-demand Next dev** : `test.setTimeout(60_000)` (1ère requête admin/kit à froid).
- **Lenteur transition** : le bouton est `disabled` pendant `busy` ; attendre la réponse, pas
  l'état désactivé.

## Invariants couverts

- **INV-PRICE** — parité 199 MAD entre `/kit` et le prix résolu (un seul `resolveProductPricing`).
- **INV-PERM** — l'opérateur authentifié (storageState) peut créer (`write`) + transitionner
  (`publish`) ; le cas non-authentifié reste dans `admin-coupons.spec.ts`.
- **INV-PII** — téléphone masqué `06…78` dans la table grants, jamais en clair.
- Lacune audit adressée : **E2E parcours opérateur complet** + traversée /kit + grants (🔴 audit §3).

## Critères d'acceptation (observables)

- `coupons-manager` visible ; heading `Coupons` présent.
- Après `Créer (brouillon)` : une ligne avec le libellé unique, statut `Brouillon`.
- Après `Activer` : la même ligne affiche `Actif` ; le bouton `Activer` n'y est plus.
- Sur `/kit` : `pack-price-line` contient `199`.
- Après `Charger` : `coupons-grants-table` visible ; chaque cellule téléphone matche
  `/0\d…\d{2}/` (masqué) et NE matche PAS `/\d{9}/` ; ou bien `Aucun code émis.`.

## Points à vérifier — tous points de vue

- **Backend** : POST status applique la transition `draft→active` ; refresh renvoie le nouvel état.
- **Frontend** : la ligne ciblée par libellé unique survit au refresh ; le bouton `Activer`
  disparaît à l'état `active`.
- **UI/UX/design** : statut lisible (`Brouillon`/`Actif`) ; pas de `%`/`!`/emoji dans la note /kit.
- **Data** : la table grants sérialise le téléphone déjà masqué (le repo masque en sortie).
- **A11y** : heading `h1` présent ; `role="alert"` réservé aux erreurs (non déclenché en happy path).
- **i18n** : libellés admin FR ; /kit testé en FR par défaut (AR couvert ailleurs).
