# N10 — E2E parcours opérateur : onglet Coupons & bascule d'actif

## Rôle & surface
Prouver, contre la **vraie app** (vrai RSC, vrai `requireAdmin`, vraie DB), que l'opérateur Karim arrive sur
`/admin/coupons`, voit l'onglet Coupons surligné, clique un autre onglet et voit l'actif basculer. C'est la
couche qui valide ce que l'unité ne peut pas (exécution RSC + navigation Next réelle). Surface : Playwright,
fichier cible `e2e/admin-nav-coupons.spec.ts`. Auth via `storageState` `.auth/admin.json` produit par
`global.setup.ts` (pattern de `admin-coupons.spec.ts`). `baseURL` fourni par la config Playwright.

## Fonctionnement optimal (ce qui DOIT se passer)
1. Contexte authentifié (`test.use({ storageState: ADMIN_STORAGE_PATH })` importé de `./helpers/auth`).
2. `goto('/admin/coupons')` → la page se monte ; `coupons-manager` visible.
3. L'onglet `admin-nav-coupons` porte `aria-current="page"` (surligné).
4. Karim clique sur un **autre** onglet — au choix `admin-nav-dashboard` (cible stable, route `/admin`).
   Après navigation : l'URL devient `/admin`, l'onglet `admin-nav-dashboard` porte `aria-current="page"` et
   `admin-nav-coupons` ne le porte **plus** (bascule de l'actif).
5. Retour optionnel sur Coupons via `admin-nav-coupons` pour confirmer la réversibilité.

## Contrat I/O
- Aucune API mockée (E2E réel). Cookies de session via storageState. `data-testid` des onglets = `admin-nav-<key>`.
- Sélecteurs : `getByTestId('coupons-manager')`, `getByTestId('admin-nav-coupons')`, `getByTestId('admin-nav-dashboard')`.

## Cas limites & non-happy-path
- **Non authentifié** : déjà couvert par `admin-coupons.spec.ts` (`goto('/admin/coupons')` sans session →
  redirige vers `/admin/login`). N10 le ré-affirme brièvement en best-effort OU s'appuie sur l'existant
  (ne pas dupliquer inutilement).
- **Compile-on-demand Next dev** : la première navigation peut être lente ; utiliser `test.setTimeout(60_000)`
  comme les autres specs admin, et `expect(...).toBeVisible()` (auto-waiting Playwright) plutôt que des sleeps.
- **INV-PRICE NON concerné** : N10 ne touche PAS au pricing /kit. On ne crée pas de coupon, on ne vérifie pas
  `pack-price-line`. La parité prix (199) est le périmètre des E2E coupon/fidélité (F16/F19), explicitement
  **hors scope** ici — la nav ne doit avoir aucun effet sur le prix. À noter dans la spec pour éviter le
  chevauchement de couverture.
- **ConsentBanner** : neutralisé par `global.setup.ts` (`fg_consent_chosen='1'` persisté dans storageState) —
  pas de workaround à ajouter.

## Invariants couverts
- **NAV-INV-ACTIVE** en conditions réelles : `/admin/coupons` → Coupons actif ; après clic → la cible devient
  l'unique actif.
- **NAV-INV-PRESENCE** + **NAV-INV-ROUTE** : l'onglet existe, est cliquable, mène à la bonne route.
- Frontière documentée avec N03 : N10 est le niveau (b) qui exécute le vrai RSC.

## Critères d'acceptation (observables)
- Après `goto('/admin/coupons')` : `coupons-manager` visible ; `admin-nav-coupons` a
  `aria-current="page"`.
- Après clic sur `admin-nav-dashboard` : `await expect(page).toHaveURL(/\/admin(\/?$|\?)/)` (route dashboard) ;
  `admin-nav-dashboard` a `aria-current="page"` ; `admin-nav-coupons` n'a plus `aria-current`.
- (Réversibilité optionnelle) clic retour sur `admin-nav-coupons` → re-surligné, URL `/admin/coupons`.
- Aucun assert sur le prix /kit (INV-PRICE hors scope, mentionné en commentaire de la spec).

## Points à vérifier — tous points de vue
- Backend : `requireAdmin` autorise la session storageState ; routes `/admin/coupons` et `/admin` rendent.
  · Frontend : navigation Next (Link) recalcule l'actif par page. · UI/UX : feedback de page courante cohérent
  au clic. · Data : aucune mutation (lecture seule de la nav). · A11y : `aria-current` réellement présent dans
  le DOM rendu. · i18n : libellés FR.

## Anti-flaky
Playwright `--repeat-each=2`. Pas de `waitForTimeout`. S'appuyer sur l'auto-waiting de `toBeVisible` /
`toHaveAttribute` / `toHaveURL`.
