# Journal de décision & dette

> Consigner ici tout écart, choix d'architecture de test, bug produit révélé, oracle ajusté.
> Rempli au fil de l'eau pendant l'exécution (boucle de correction §3 du plan).

## Décisions

| id | date | sujet | décision | raison |
|---|---|---|---|---|
| D01 | 2026-06-03 | Frontière MSW vs route directe | Composants (F01-04,F08-11) → MSW ; contrats (F05-07,F14-15) → import direct route + memoryStore | MSW isole le rendu ; le contrat se teste sans serveur, plus rapide et déterministe |
| D02 | 2026-06-03 | Bloqueur activation F18 | Seed déterministe `scripts/seed-e2e-loyalty.ts` (pas de hook HTTP prod) | un code émis est `not_yet_active` ; CI sans psql → seed dédié avant la suite |
| D03 | 2026-06-03 | Échec silencieux stats/grants | Oracle = absence de `role=alert` (constat du code, pas de bug) | `loadStats`/`loadGrants` n'ont pas de gestion d'erreur (no-op si !ok) |
| D04 | 2026-06-03 | 2 InvitationCodeField sur /kit (welcome note + wizard) | E2E F18 scope le champ au `wizard-coupon-field` | `getByLabel('Votre code')` ambigu (strict mode) sinon |
| D05 | 2026-06-03 | Latence création commande avec code (émission+redemption grant) | timeout thankyou 45s + re-seed `seed-e2e-loyalty.ts` avant chaque run F18 | code à usage unique → `already_redeemed` au 2ᵉ run sans re-seed ; serveur dev lent |
| D06 | 2026-06-03 | F16 /kit goto lent sous charge parallèle (serveur dev) | local : `--workers=1` ; CI : `pnpm build` + start (production) | artefact dev-mode (compilation à la volée), pas un bug |

## Bugs produit révélés (le cas échéant)

| id | feature | symptôme | gravité | statut |
|---|---|---|---|---|
| OBS-01 | F08 | `InvitationCodeField` affiche « 20 MAD » même en arabe (formatMad code en dur « MAD »), alors que `LoyaltyCodeCard` localise en درهم | cosmétique | constaté — hors périmètre, oracle aligné sur le réel |

## Bilan d'exécution (W6 — clôture)

- **Gates vertes** : typecheck = 0 erreur (projet) ; lint = 0 (seed : `eslint-disable no-console` assumé) ;
  anti-flaky composant **3×** stable (8 fichiers / 69 tests) ; non-régression périmètre **459 tests / 51 fichiers** ;
  E2E **7 tests verts** (F16 ×3 en `--workers=1`, F17 ×2, F18 ×2) en navigateur réel.
- **Nouveaux tests livrés** (≈ +210 cas) : W1 contrats 40 · W2 admin 28 · W3 client 62 · W4 intégration 48 · W0 smoke 5 · E2E 7.
- **Lacune n°1 fermée** : `CouponsManager.tsx` passe de **0 → 28** tests composant ; couche **MSW** coupon/fidélité créée (inexistante avant).
- **Correctifs d'oracle** (boucle de correction, jamais de bug produit masqué) : F04-C003 (PII sur la cellule, pas le `<tr>`),
  F08-C006 (MAD vs درهم, cf. OBS-01), refactor mocks `vi.mocked` + champs `CouponInput` complets (typecheck).

## Dettes traitées (boucle de correction 2026-06-03)

- ✅ **OBS-01 corrigé** : `InvitationCodeField.formatMad(cents, isArabic)` localise la devise en **درهم**
  en arabe (cohérent avec `LoyaltyCodeCard`). Oracle F08-C006 mis à jour (`20 درهم`). FR garde « MAD ».
- ✅ **Couplage fixtures F19/F20 supprimé** : `fixtures.json` co-localisés dans l'arbre `src`
  (`src/lib/coupons/__fixtures__/pricing-integration.fixtures.json`,
  `src/lib/db/queries/__fixtures__/activation.fixtures.json`) ; imports repointés (plus de `../../docs/…`).

## Dette résiduelle / suites possibles

- E2E F18 : code à usage unique → re-seed avant run (documenté runbook). CI = build prod.
- (cf. dossier admin-nav pour la dette d'unification de la navigation, requalifiée en décision produit.)
- **E2E F18** : code à usage unique → exécuter `scripts/seed-e2e-loyalty.ts` avant chaque run (documenté runbook).
- **E2E en dev-mode** lent sous charge parallèle ; CI utilise `pnpm build` + start (production) → rapide et stable (cf. ci-pipeline.yaml).
- Pistes futures : tests composant mobile/RTL admin, audit-log assertions sur grants, invalidation cache ISR observable.
