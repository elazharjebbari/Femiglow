# 00 — Outils & harness de test

> Conventions **uniformes** pour toute la batterie. Réutilise l'existant du repo
> (zéro nouvelle dépendance). Tout code de test produit **doit** suivre ces
> conventions (déterminisme, sélection par rôle/testid, fixtures synthétiques).

## 1. Couche RTL (Vitest 2.1 + @testing-library/react)

- Environnement `jsdom` (défaut `.test.tsx`).
- **Sélection** : `getByRole`/`findByRole` + nom accessible ; sinon `data-testid`.
  **Jamais** par classe CSS ou état Zustand privé.
- **Interaction** : `@testing-library/user-event` (frappe réelle, focus, blur).
  Pour les champs masqués (téléphone) : `pressSequentially`/`user.type` (touche à
  touche), **pas** `fill` brut.
- **Pièges connus à coder dans les helpers** :
  - 1ᵉʳ `input[type=text]` = **honeypot** → cibler par `name` (`firstName`, `phone`, `consent`).
  - submit déverrouillé par `isValid` (`mode:'onChange'`) → attendre `toBeEnabled()`.
- **Flags** : togglés via `process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED`
  dans `beforeEach/afterEach` (cf. `flags.test.ts`).
- **Store** : réinitialiser (`useWizardStore.getState().reset()` / `useChatStore…reset()`) en `beforeEach`.
- **a11y** : `expectNoAxeViolations(container)` (helper repo `@/test/axe`).

## 2. Couche MSW (msw ^2.14)

- Serveur partagé `@/test/msw/server` ; lifecycle **par fichier** :
  `beforeAll(server.listen({onUnhandledRequest:'error'}))`, `afterEach(server.resetHandlers())`, `afterAll(server.close())`.
- Handlers OWBS dédiés à créer : `src/test/msw/handlers/owbs-ui.ts` (catalogue ci-dessous).
- **Faux timers** Vitest (`vi.useFakeTimers()`) pour piloter le backoff de la file de façon déterministe.
- **Hoisting** : tout mock référençant une variable locale passe par `vi.hoisted(() => …)` (piège récurrent : `Cannot access 'X' before initialization`).

### Catalogue de handlers MSW (réutilisables)
| Handler | Route | Comportement |
|---|---|---|
| `leadOk` | POST `/api/checkout/lead` | 201 `{leadId,status,nextStep}` |
| `leadSlow(ms)` | idem | délai paramétrable (latence) |
| `leadFlaky(n)` | idem | n×503 puis 201 (retry) |
| `lead409` | idem | 409 idempotency_conflict |
| `leadNetworkError` | idem | `HttpResponse.error()` (offline) |
| `addressOk` / `orderOk` | PATCH/POST | conversion nominale |
| `orderStockOut` / `orderPriceMismatch` | POST `/api/checkout/order` | 409/422 (erreurs UI) |
| `syncOk` / `syncPartial` | POST `/api/checkout/lead/sync` | 200 / résultat mixte ; spy du corps |
| `sync429` | idem | rate-limit |
| `chatLeadOk(value)` / `chatLeadSlow` / `chatLeadError` | POST `/api/chat/lead/contact` | succès valorisé / lent / erreur |

## 3. Couche Playwright (1.59, build flag-ON)

- Base : build prod local `:3100` avec `NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true`
  + `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true` (cf. runbook).
- Specs `apps/web/e2e/owbs-ui-*.spec.ts`.
- **Réseau** : `page.route('**/api/checkout/lead', …)` (delay/abort/fulfill) ;
  `page.waitForRequest('**/api/checkout/lead/sync')` pour observer le beacon.
- **Helpers partagés** (`e2e/_helpers/owbs.ts`) :
  - `openWizard(page)` → /fr/kit, scroll `wizard-shell`, passe `wizard-step-cart`→lead si présent.
  - `fillLead(page,{firstName,phone})` → cibler par `name`, `pressSequentially` téléphone, attendre `wizard-lead-submit` enabled.
  - `throttle/abortOnce(page,pattern)` ; `measureTransition(page,from,to)` ; `captureBeacon(page)`.
- **i18n** : `/fr/kit`, `/ar/kit`, `/en/kit`.
- **a11y e2e** : `@axe-core/playwright` si dispo, sinon assertions ARIA ciblées.
- **Multi-navigateur critique** : chromium **+** webkit (R-07 iOS/pagehide) — nécessite d'élargir le `testMatch` cross-browser (`PLAYWRIGHT_CROSS=1`), cf. action plan.

## 4. Données de test

- **Fixtures synthétiques** uniquement (zéro PII réelle). Téléphone `0600000000`,
  prénom `Salma`/`Yassine`, leadId `cl_` + 20 (généré ou littéral basse entropie).
- Allowlist gitleaks pour le dossier (faux secrets de doc), comme le dossier ingénierie.
- DB de test : pglite (intégration) ; build seedé (e2e).

## 5. Stabilité (anti-flaky)

- Aucune assertion sur l'horloge réelle ; `expect.poll`/`waitFor`/`findBy`.
- Beacon : asserter sur la **requête observée** (`waitForRequest`), pas sur un délai.
- Playwright : `retries: 1` en CI, traces on-first-retry ; éviter `waitForTimeout`.
- Tests **indépendants** : reset store + MSW + flag en `beforeEach/afterEach`.
