# F05 — Plan de tests concret

> Cibles : **construire** `WizardSyncIndicator` (TDD) + `WizardSyncIndicator.test.tsx` (RTL) ;
> e2e dans `owbs-ui-degraded.spec.ts`.

## A. RTL (le composant + le signal)
- **F05-S01** : `syncDegraded=false` → `expect(screen.queryByRole('status')).toBeNull()`.
- **F05-S02** : `store.markSyncDegraded()` puis render → `getByRole('status')` visible, texte présent.
- **F05-S03** : assert `aria-live="polite"`, **pas** de `role="dialog"`/overlay bloquant.
- **F05-S04/S05** : via `lead-sync-queue` (transport factice) — retryable transitoire ⇒ `markSyncDegraded` **non** appelé ; drop (4xx ou maxAttempts) ⇒ appelé **une** fois (spy sur l'action store injectée comme `onDrop`).
- **F05-S10** : action « réessayer » → `flush` re-appelé ; sur succès, `clearSyncDegraded` → indicateur disparaît.
- **F05-S11/S12** : RTL (AR) + `expectNoAxeViolations`.

## B. Playwright (`owbs-ui-degraded.spec.ts`, build flag-ON)
- **F05-S06** : `page.route('**/api/checkout/lead', fulfill 400)` (non-retryable) → après submit, l'indicateur `role=status` apparaît ; **on peut toujours** remplir l'adresse et avancer.
- **F05-S07** : prouver que thank-you reste atteignable malgré l'indicateur.

## C. Étapes (TDD du composant)
1. Écrire `F05-S01/S02/S03` (rouge) → **construire** `WizardSyncIndicator` (vert).
2. Câbler le montage dans `WizardShell` + signal `onDrop` réel (S04/S05).
3. Action réessayer + `clearSyncDegraded` (S10).
4. a11y + i18n (S11/S12) + e2e non-bloquant (S06/S07).

> **Note** : ce module **produit du code** (composant + action store). Respecter les
> portes qualité (parité legacy : indicateur jamais affiché flag OFF / sans drop).
