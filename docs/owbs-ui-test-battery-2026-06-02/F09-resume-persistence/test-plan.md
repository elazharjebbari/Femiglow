# F09 — Plan de tests concret

> Cibles : `wizard-store` (persist/migrate déjà testés) + `ResumeBanner.test.tsx` +
> `e2e/owbs-ui-resume.spec.ts`.

## A. RTL
- **F09-S03** : store avec `currentStep` absent des `steps` → `WizardShell` recale sur `steps[0]` (monter le shell, vérifier l'étape rendue).
- **F09-S04 (garde-fou)** : poser `markSyncDegraded()`, sérialiser via `partialize`, vérifier que `syncDegraded` **n'est pas** dans l'objet persisté (éphémère).
- **F09-S01/S02/S07/S08** : reprise étape/drafts ; `ResumeBanner` visible + `wizard-resume-dismiss` masque.

## B. Playwright (build flag-ON)
- **F09-S05 reload-recovery** (partagé F04-S20) : envelope en file (réseau aborté) → `page.reload()` → convergence **1 lead**.
- **F09-S06 multi-onglet** : 2 `page` dans 2 contextes → parcours en parallèle → chacun cohérent (pas d'écrasement croisé). NB : sessionStorage est **par onglet** → vérifier l'isolation.

## C. Étapes
1. Cohérence hydratation (S03/S08) + éphémère syncDegraded (S04).
2. Resume banner (S02) + drafts (S07).
3. Reload-recovery e2e (S05) + multi-onglet (S06).
