# F06 — Plan de tests concret

> Cibles : `e2e/owbs-ui-network.spec.ts` (PW) + réutilisation MSW de F03.

## A. Playwright (build flag-ON)
- **F06-S01/S02** : `route` delay → `measureTransition` < 1,5 s par étape.
- **F06-S03/S05** offline : `await context.setOffline(true)` ; submit ; fermer/masquer → beacon ; `setOffline(false)` ; vérifier convergence à **1 lead** (via admin/endpoint).
- **F06-S08** : pendant la latence, assert `getByRole('alert')` **absent** (pas d'erreur prématurée).
- **F06-S10** conversion offline : tout le parcours hors-ligne → la conversion échoue (message clair) **mais** le lead capturé est persisté au retour réseau / via beacon.

## B. MSW (réaction file)
- **F06-S04/S06/S07** : réutiliser `leadFlaky`, `lead409`, `networkError` (cf. F03) — convergence/retry/drop.

## C. Unit
- **F06-S09** : backoff borné (faux timers) — partagé avec F03-S05.

## D. Étapes
1. PW latence (S01/S02) + no-alert (S08).
2. Offline CDP (S03/S05/S10) + beacon.
3. MSW conditions (S04/S06/S07).
