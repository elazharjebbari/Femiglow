# Stratégie de test

## Pyramide (centre de gravité remonté vers l'UI)

```
        ╱╲          E2E Playwright (P0 parcours réels)        ~8-10 specs
       ╱  ╲         — opérateur complet, fidélité, redemption
      ╱────╲        Composant + MSW (Testing Library)         ~cœur du dossier
     ╱      ╲       — CouponsManager, InvitationCodeField, AddressStep,
    ╱        ╲        WizardCartRecap, ThankYouStep
   ╱──────────╲     Contrat API (route handlers + MSW/mocks)  ~ status/stats/grants/redeem
  ╱            ╲    Unit (pur, déterministe)                   ~store, helpers
 ╱──────────────╲
```

La base pure (engine/repos) **existe déjà** ; ce dossier remplit les deux strates du haut + les
contrats manquants.

## Les 6 types de tests (colonne `type` du CSV)

| Code | Type | Outil | Quand |
|---|---|---|---|
| **U** | Unit (pur) | Vitest | logique déterministe, store zustand, helpers |
| **I** | Intégration / contrat API | Vitest (+ mocks auth/repo) | route handlers, agrégation, RBAC |
| **C** | Composant | Vitest + Testing Library (+ MSW) | rendu, interactions, états, i18n, charte |
| **M** | Réseau / MSW | MSW dans un test C ou I | succès + erreurs + latence + payload malformé |
| **E** | End-to-end | Playwright | parcours opérateur/client multi-écrans |
| **A** | Accessibilité | Playwright + axe-core / jest-axe | pas de violation critique/serious |
| **V** | Visuel / charte | Playwright snapshot + assertions | terracotta, pas de %/!/emoji, RTL |

## Rôle de MSW (couche critique manquante)

MSW est la **frontière de contrat** entre l'UI testée et le backend. On crée
`src/test/msw/coupons-handlers.ts` exportant des familles de handlers paramétrables :

- `couponsAdminHandlers({ coupons, role })` — `GET/POST /api/admin/coupons`, `POST [id]/status`, `GET [id]/stats`
- `grantsAdminHandlers({ grants })` — `GET /api/admin/coupons/grants` (téléphone déjà masqué)
- `redeemHandlers({ byCode })` — `POST /api/coupons/redeem` renvoyant `valid`/`reason` selon le code
- Variantes d'échec : `failWith(status, reason)` pour 403/409/422/500 et `withLatency(ms)`.

Cycle imposé **par fichier** (jamais global) :
```ts
import { server, http, HttpResponse } from '@/test/msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Schéma de `test-cases.csv` (imposé)

Colonnes : `id,feature_id,titre,type,priorite,couche,preconditions,etapes,donnees,resultat_attendu,oracle,risque_couvert,fichier_test_cible`

- `id` : `F08-C003` (feature-numéro-type+séquence) — repris **verbatim** dans le titre du test (`it('F08-C003 …')`) pour grep.
- `type` ∈ {U,I,C,M,E,A,V}. `priorite` ∈ {P0,P1,P2}.
- `oracle` : l'assertion **exacte et observable** (texte, testid, statut HTTP, classe CSS, attribut `dir`).
- `risque_couvert` : référence à un invariant (`INV-*`) ou à une lacune de l'audit.

## Conventions d'assertion UI

- Cibler par `data-testid` (stable) ou rôle ARIA (`role="alert"`, `role="status"`), jamais par texte fragile seul.
- Pour les montants : asserter la **chaîne formatée** (`−90 MAD`, `199 MAD`) et la classe `tabular-nums`.
- Pour la charte : `expect(text).not.toMatch(/[%!]|🎉|⏰/)` + présence de la couleur terracotta sur l'économie.
- Pour l'i18n AR : `dir="rtl"`, présence de `درهم`, libellés arabes attendus.
- Pour le réseau : asserter l'**état de transition** (bouton désactivé / « … » / spinner) et l'**état final** (succès/erreur).

## Boucle anti-flaky

Tout test C/E/A passe `--repeat-each 3` avant d'être considéré stable (cf. runbook).
Pas de `waitForTimeout` arbitraire en Playwright : on attend un **testid** ou une **réponse réseau**.
