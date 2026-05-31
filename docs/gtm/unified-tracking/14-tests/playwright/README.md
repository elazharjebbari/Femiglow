# Tests Playwright — E2E

Tests end-to-end qui simulent l'utilisateur réel dans un vrai navigateur.

## Fichiers

| Fichier | Cible |
|---------|-------|
| `config.md` | Config Playwright + projets (chromium, firefox, webkit, mobile) |
| `journeys.spec.md` | Les 5 parcours utilisateurs (J1 → J5 de `07-ui-ux/user-journeys.md`) |
| `activation.spec.md` | Activation plan + bascule prod, rollback |
| `wizard.spec.md` | Wizard 5 étapes, auto-save, validation step-by-step |
| `expert.spec.md` | Mode expert 3 colonnes, JSON live preview |
| `i18n.spec.md` | Locales fr-MA / ar-MA, RTL |
| `a11y.spec.md` | Audit accessibilité (axe-playwright) |
| `keyboard.spec.md` | Raccourcis clavier, focus management |
| `error-recovery.spec.md` | Pertes connexion, conflits, autosave broken |
| `legacy-redirect.spec.md` | Anciennes routes → nouveau wizard |

## Conventions

- Un fichier `.spec.ts` par parcours métier.
- Pattern : `test.describe('Journey X — Title', ...)`.
- Page Objects dans `e2e/pages/` (TrackingPlanPage, WizardPage, ExpertPage).
- Fixtures dans `e2e/fixtures/`.
- Tests parallélisables : `test.describe.configure({ mode: 'parallel' })`.
- Tags : `@critical`, `@smoke`, `@a11y`, `@i18n`.

## Données de test

- Base de données dédiée (`femiglow_e2e`).
- Seed avant chaque suite : 3 plans (1 active, 1 draft, 1 archived).
- Reset entre tests : `await testDb.reset()`.

## Authentification

```typescript
test.use({ storageState: 'e2e/auth/admin.json' })
```

Storage state pré-généré pour `amal@femiglow.ma` (admin).

## Couverture cible

- **Parcours critiques** : 100 % (J1, J2, J5).
- **Parcours secondaires** : ≥ 80 % (J3, J4).
- **Browsers** : Chromium + WebKit (Firefox optionnel).
- **Devices** : Desktop 1280×720 + Mobile (iPhone 14).
