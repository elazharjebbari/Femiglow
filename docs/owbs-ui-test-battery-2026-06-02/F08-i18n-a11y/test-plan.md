# F08 — Plan de tests concret

> Cibles : RTL a11y/i18n par étape (`*.a11y.test.tsx`) + `e2e/owbs-ui-i18n.spec.ts`.

## A. RTL (a11y + i18n composant)
- **F08-S10/S11/S12** : `expectNoAxeViolations` sur `LeadCaptureStep` (FR + AR) et `AddressStep`.
- **F08-S05** : `LeadFormBubble` rendu avec `language="ar"` → `dir="rtl"` présent ; libellés AR.
- **F08-S14/S15** : ordre de focus (`user.tab()`), `aria-invalid` + message lié sur erreur.

## B. Playwright (build flag-ON)
- **F08-S01/S02/S03** : `/fr|ar|en/kit` → parcours optimiste, vérifier libellés clés (pas de clé brute) + `dir` du conteneur.
- **F08-S04** : sur `/ar/kit`, taper `0600000000` → la valeur lue reste latine (`input.inputValue()` cohérent).
- **F08-S13 annonce d'étape** : après transition optimiste, vérifier qu'un élément `aria-live` annonce / le focus passe sur le titre de `wizard-step-address`. **Si absent → GAP a11y à corriger** (déplacer le focus sur le heading de l'étape).
- (option) `@axe-core/playwright` sur chaque page.

## C. Étapes
1. axe par étape FR/AR (S10-S12) — bloquant si violation.
2. i18n e2e (S01-S03) + téléphone latin AR (S04).
3. Annonce d'étape (S13) — corriger le focus si gap.
