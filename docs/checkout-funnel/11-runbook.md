# Runbook — Orchestration de l'exécution

> **Document opérationnel** à ouvrir et suivre étape par étape pendant le dev.
> Chaque étape liste : objectif, fichiers de référence, commandes, checklist
> done/not-done. **Coche au fur et à mesure.**
>
> Ce fichier est à mettre à jour quotidiennement par le dev en cours
> d'exécution (commit `chore(runbook): mark step X done`).

---

## Légende

- ✅ Done
- 🟡 In progress
- ⬜ Not started
- 🔴 Blocked

---

## Phase 0 — Pré-flight

### Step 0.1 : Lire toute la doc

⬜ **Statut** :

| Action | Référence |
|---|---|
| Lire `01-etat-actuel.md` (audit avant refonte) | [`./01-etat-actuel.md`](./01-etat-actuel.md) |
| Lire `02-references-synthese.md` (Kolenda + recherches) | [`./02-references-synthese.md`](./02-references-synthese.md) |
| Lire `03-propositions.md` (3 options évaluées) | [`./03-propositions.md`](./03-propositions.md) |
| Lire `04-recommandation-finale.md` (spec fonctionnelle) | [`./04-recommandation-finale.md`](./04-recommandation-finale.md) |
| Lire `05-plan-action.md` (10 PRs séquencées) | [`./05-plan-action.md`](./05-plan-action.md) |
| Lire `06-wizard-ui-specification.md` (spec UI pixel-précise) | [`./06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) |
| Lire `07-admin-form-management.md` (UX admin) | [`./07-admin-form-management.md`](./07-admin-form-management.md) |
| Lire `08-architecture-data.md` (DB, API, contracts) | [`./08-architecture-data.md`](./08-architecture-data.md) |
| Lire `09-architecture-frontend.md` (components, state, routing) | [`./09-architecture-frontend.md`](./09-architecture-frontend.md) |
| Lire `10-tests-strategy.md` (scénarios par composant) | [`./10-tests-strategy.md`](./10-tests-strategy.md) |

### Step 0.2 : Setup dev local

⬜ **Statut** :

```bash
# Cloner si besoin
cd ~/PycharmProjects/template-femiglow

# Vérifier Postgres up
brew services list | grep postgresql@17
# Si "error" → rm /usr/local/var/postgresql@17/postmaster.pid && brew services restart postgresql@17

# Vérifier DB accessible
psql -h localhost -U elazhar -d femiglow -tAc "SELECT current_database();"
# Doit renvoyer: femiglow

# Install deps
cd apps/web && bun install

# Migrate
bun run db:migrate

# Seed (admin user)
bun run db:seed:admin

# Run tests
bun run test
bun run playwright test --project=chromium

# Run dev server
bun dev
# → http://localhost:3000
```

| Checklist | OK |
|---|---|
| Node version `node -v` ≥ 20.10 | ⬜ |
| Bun version `bun -v` ≥ 1.1 | ⬜ |
| Postgres 17 accessible localhost:5432 | ⬜ |
| `bun run typecheck` passe | ⬜ |
| `bun run lint` passe | ⬜ |
| `bun run test` passe | ⬜ |
| `bun run playwright test` passe (au moins setup project) | ⬜ |
| `bun dev` lance et `/` répond 200 | ⬜ |
| `/kit` répond 200 | ⬜ |
| Admin accessible `/admin` après login local | ⬜ |

### Step 0.3 : Branche & issue Linear

⬜ **Statut** :

```bash
git checkout main
git pull
git checkout -b feat/checkout-funnel-pr1-tracking-baseline
```

| Action | OK |
|---|---|
| Issue Linear `CHA-XXX Funnel — Refonte wizard` créée | ⬜ |
| Sub-issues par PR (CHA-XXX.1, .2, etc.) | ⬜ |
| Branche pushée vide pour PR draft | ⬜ |

---

## Phase 1 — PR #1 : Tracking baseline

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #1
> **Tests** : [`10-tests-strategy.md`](./10-tests-strategy.md) §3.5

### Step 1.1 : Étendre builders GTM

⬜ **Statut** :

Fichiers à modifier :
- `apps/web/src/lib/tracking/gtm/builders.ts`
- `docs/gtm/EVENTS.md` (taxonomie)

Spec :
- Ajouter `lead_id?`, `form_mode`, `step_name`, `variant_key` aux builders existants
- Nouveaux builders : `buildLeadCaptureEvent`, `buildAddressCompletedEvent`, `buildWizardErrorEvent`, `buildWizardAbandonedEvent`

| Action | OK |
|---|---|
| Builders étendus | ⬜ |
| `bun run check:gtm` (Import/Export valid) | ⬜ |
| Tests Vitest sur builders (cf. `10-tests-strategy.md` §3.5) | ⬜ |

### Step 1.2 : Tests Vitest

⬜ **Statut** :

```bash
bun test apps/web/src/lib/tracking/gtm/__tests__/builders.spec.ts
```

Référence : [`10-tests-strategy.md §3.5`](./10-tests-strategy.md)

| Test | OK |
|---|---|
| `buildLeadCaptureEvent` shape correct | ⬜ |
| `buildPurchaseEvent` GA4 ecommerce conformity | ⬜ |
| Tous les events ont `form_mode` et `variant_key` optionnels | ⬜ |

### Step 1.3 : E2E baseline

⬜ **Statut** :

```bash
bun playwright test apps/web/e2e/tracking-legacy-baseline.spec.ts
```

| Test | OK |
|---|---|
| Happy path legacy émet bien `view_kit, add_to_cart, begin_checkout, purchase` | ⬜ |

### Step 1.4 : PR & merge

⬜ **Statut** :

```bash
git add apps/web/src/lib/tracking/gtm/ apps/web/src/lib/tracking/gtm/__tests__/ docs/gtm/EVENTS.md
git commit -m "feat(checkout): tracking baseline with form_mode/variant_key"
git push -u origin feat/checkout-funnel-pr1-tracking-baseline
gh pr create --title "feat(checkout): tracking baseline" --body "$(cat <<'EOF'
## Summary
- Étend les builders GTM existants avec `lead_id`, `form_mode`, `step_name`, `variant_key`
- Ajoute nouveaux events `lead_capture`, `address_completed`, `wizard_error`, `wizard_abandoned`
- Aucune UI modifiée — baseline avant refonte

## Test plan
- [x] Vitest builders
- [x] Playwright baseline events
- [x] GTM Import/Export valid

Ref: docs/checkout-funnel/05-plan-action.md §2 PR #1
EOF
)"
```

| Action | OK |
|---|---|
| PR créée et CI verte | ⬜ |
| Review approved | ⬜ |
| Mergé sur `main` | ⬜ |

---

## Phase 2 — PR #2 : DB migrations + form_config

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #2
> **Schémas** : [`08-architecture-data.md`](./08-architecture-data.md) §2-3
> **Tests** : [`10-tests-strategy.md`](./10-tests-strategy.md) §3

### Step 2.1 : Migrations Drizzle

⬜ **Statut** :

```bash
# Update schemas
# - apps/web/src/lib/chat/db/schema.ts (chat_lead extensions)
# - apps/web/src/lib/db/schema.ts (form_config, form_config_history, form_variant_assignment, checkout_idempotency, orders extensions)

# Génère SQL
bun run db:generate

# Vérifie le SQL produit dans apps/web/drizzle/0023-0027*.sql
# Doit matcher 08-architecture-data.md §3 (ADD COLUMN IF NOT EXISTS, indexes, comments)

# Apply local
bun run db:migrate

# Vérifie tables
psql -h localhost -U elazhar -d femiglow -c "\d chat_lead"
psql -h localhost -U elazhar -d femiglow -c "\d form_config"
psql -h localhost -U elazhar -d femiglow -c "\d form_config_history"
psql -h localhost -U elazhar -d femiglow -c "\d form_variant_assignment"
psql -h localhost -U elazhar -d femiglow -c "\d checkout_idempotency"
```

| Migration | OK |
|---|---|
| `0023_chat_lead_funnel_extensions.sql` | ⬜ |
| `0024_orders_lead_link.sql` | ⬜ |
| `0025_form_config.sql` + seed default config | ⬜ |
| `0026_product_stock.sql` + seed initial stock par SKU | ⬜ |
| `0027_form_variant_assignment.sql` | ⬜ |
| `0028_checkout_idempotency.sql` | ⬜ |

### Step 2.2 : Types Drizzle regenerated

⬜ **Statut** :

```bash
bun run db:generate-types  # ou équivalent
bun run typecheck
```

| Check | OK |
|---|---|
| `ChatLead` type contient `source, cartSnapshot, gclid, ...` | ⬜ |
| `FormConfigRow` type export | ⬜ |

### Step 2.3 : Smoke test migrations

⬜ **Statut** :

```bash
bun test apps/web/src/lib/db/__tests__/migrations.spec.ts
```

| Test | OK |
|---|---|
| Migration up + down sans erreur | ⬜ |
| Seed default form_config inséré | ⬜ |

### Step 2.4 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 3 — PR #3 : Endpoints API

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #3
> **Contrats** : [`08-architecture-data.md`](./08-architecture-data.md) §4-5
> **Tests** : [`10-tests-strategy.md`](./10-tests-strategy.md) §4.9

### Step 3.1 : Schemas Zod

⬜ **Statut** :

Créer :
- `apps/web/src/lib/checkout/schemas/lead.ts` (`createLeadInputSchema`, `patchLeadInputSchema`, `finalizeLeadInputSchema`)
- `apps/web/src/lib/checkout/form-config/schema.ts` (`formConfigJsonSchema`)

Référence : [`08-architecture-data.md §5`](./08-architecture-data.md)

| Schema | OK |
|---|---|
| `createLeadInputSchema` + tests | ⬜ |
| `patchLeadInputSchema` + tests | ⬜ |
| `finalizeLeadInputSchema` + tests | ⬜ |
| `formConfigJsonSchema` avec superRefine business rules | ⬜ |

### Step 3.2 : Repos

⬜ **Statut** :

Créer :
- `apps/web/src/lib/checkout/repos/lead.ts`
- `apps/web/src/lib/checkout/repos/form-config.ts`
- `apps/web/src/lib/checkout/repos/variant-assignment.ts`
- `apps/web/src/lib/checkout/repos/idempotency.ts`
- `apps/web/src/lib/checkout/repos/stock.ts`

Référence : [`08-architecture-data.md §6`](./08-architecture-data.md)

| Repo | OK |
|---|---|
| `leadRepo` (createMinimal, patchAddress, patchPayment, markConverted, findByPhoneRecent) | ⬜ |
| `formConfigRepo` (CRUD + publish + archive + rollback + history) | ⬜ |
| `variantAssignmentRepo` (assign deterministic) | ⬜ |
| `idempotencyRepo` (get, set with TTL) | ⬜ |
| `stockRepo` (getByProductId, decrementAtomic, adjust + audit, setThresholds) | ⬜ |
| Tests Vitest pour chaque repo (mocked DB) | ⬜ |

### Step 3.3 : Route handlers

⬜ **Statut** :

Créer :
- `apps/web/src/app/api/checkout/lead/route.ts` (POST)
- `apps/web/src/app/api/checkout/lead/[leadId]/route.ts` (PATCH)
- `apps/web/src/app/api/checkout/lead/[leadId]/finalize/route.ts` (POST)
- `apps/web/src/app/api/checkout/form-config/active/route.ts` (GET cached)
- `apps/web/src/app/api/admin/form-config/route.ts` (GET, POST)
- `apps/web/src/app/api/admin/form-config/[id]/route.ts` (GET, PUT)
- `apps/web/src/app/api/admin/form-config/[id]/publish/route.ts` (POST)
- `apps/web/src/app/api/admin/form-config/[id]/archive/route.ts` (POST)
- `apps/web/src/app/api/admin/form-config/[id]/rollback/route.ts` (POST)
- `apps/web/src/app/api/admin/form-config/[id]/history/route.ts` (GET)
- `apps/web/src/app/api/admin/form-config/[id]/history/[version]/route.ts` (GET)

Référence : [`08-architecture-data.md §4`](./08-architecture-data.md)

| Endpoint | Handler créé | Tests passent |
|---|---|---|
| `POST /api/checkout/lead` | ⬜ | ⬜ |
| `PATCH /api/checkout/lead/[id]` | ⬜ | ⬜ |
| `POST /api/checkout/lead/[id]/finalize` (set `consented_at` + check & decrement stock) | ⬜ | ⬜ |
| `GET /api/checkout/form-config/active` | ⬜ | ⬜ |
| `GET /api/checkout/stock/[productId]` (cache tag 60s) | ⬜ | ⬜ |
| `POST /api/checkout/stock-notify` (rate-limited) | ⬜ | ⬜ |
| `GET /api/admin/form-config` | ⬜ | ⬜ |
| `POST /api/admin/form-config` | ⬜ | ⬜ |
| `GET /api/admin/form-config/[id]` | ⬜ | ⬜ |
| `PUT /api/admin/form-config/[id]` | ⬜ | ⬜ |
| `POST /api/admin/form-config/[id]/publish` | ⬜ | ⬜ |
| `POST /api/admin/form-config/[id]/archive` | ⬜ | ⬜ |
| `POST /api/admin/form-config/[id]/rollback` | ⬜ | ⬜ |
| `GET /api/admin/form-config/[id]/history` | ⬜ | ⬜ |
| `PATCH /api/admin/products/stock` (revalidateTag) | ⬜ | ⬜ |

### Step 3.4 : MSW handlers

⬜ **Statut** :

Créer :
- `apps/web/src/test/msw/handlers/checkout-lead.ts`
- `apps/web/src/test/msw/handlers/admin-form-config.ts`

Ajouter à `apps/web/src/test/msw/server.ts`.

Référence : [`10-tests-strategy.md §4.1`](./10-tests-strategy.md)

| Handler | OK |
|---|---|
| `checkoutLeadHandlers` (POST, PATCH, finalize, formConfig) | ⬜ |
| `adminFormConfigHandlers` (CRUD, publish, archive) | ⬜ |
| Wiring dans `server.ts` | ⬜ |

### Step 3.5 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 4 — PR #4 : Admin UI form-config

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #4
> **UX spec** : [`07-admin-form-management.md`](./07-admin-form-management.md)
> **Tests** : [`10-tests-strategy.md`](./10-tests-strategy.md) §4.8

### Step 4.1 : Pages admin

⬜ **Statut** :

Créer :
- `apps/web/src/app/admin/checkout/forms/page.tsx`
- `apps/web/src/app/admin/checkout/forms/new/page.tsx`
- `apps/web/src/app/admin/checkout/forms/[id]/page.tsx`
- `apps/web/src/app/admin/preview/checkout/page.tsx`

Référence : [`07-admin-form-management.md §4`](./07-admin-form-management.md)

### Step 4.2 : Composants admin

⬜ **Statut** :

Créer :
- `apps/web/src/components/admin/forms/FormConfigList.tsx`
- `apps/web/src/components/admin/forms/FormConfigEditor.tsx`
- `apps/web/src/components/admin/forms/FormConfigEditorTabs/FieldsTab.tsx`
- `apps/web/src/components/admin/forms/FormConfigEditorTabs/LogicTab.tsx`
- `apps/web/src/components/admin/forms/FormConfigEditorTabs/VariantsTab.tsx`
- `apps/web/src/components/admin/forms/FormConfigEditorTabs/PreviewTab.tsx`
- `apps/web/src/components/admin/forms/FormConfigEditorTabs/HistoryTab.tsx`
- `apps/web/src/components/admin/forms/SortableFieldList.tsx`
- `apps/web/src/components/admin/forms/DiffViewer.tsx`

Référence : [`07-admin-form-management.md §4-5-8`](./07-admin-form-management.md)

| Composant | Implémenté | Tests RTL+MSW | a11y |
|---|---|---|---|
| `FormConfigList` | ⬜ | ⬜ | ⬜ |
| `FormConfigEditor` | ⬜ | ⬜ | ⬜ |
| `FieldsTab` (drag-drop + locks) | ⬜ | ⬜ | ⬜ |
| `LogicTab` (conditional rules max 5) | ⬜ | ⬜ | ⬜ |
| `VariantsTab` (weight sum 100%) | ⬜ | ⬜ | ⬜ |
| `PreviewTab` (iframe sandbox) | ⬜ | ⬜ | ⬜ |
| `HistoryTab` (JSON Patch diff viewer) | ⬜ | ⬜ | ⬜ |

### Step 4.3 : E2E admin flow

⬜ **Statut** :

```bash
bun playwright test apps/web/e2e/admin/form-config.spec.ts
```

Référence : [`10-tests-strategy.md §5.7`](./10-tests-strategy.md)

| Scénario E2E | OK |
|---|---|
| Create draft, edit, publish | ⬜ |
| Edit published → creates new draft (immutable history) | ⬜ |
| Rollback to v9 → creates new draft from snapshot | ⬜ |

### Step 4.4 : Pages admin stock

⬜ **Statut** :

Créer :
- `apps/web/src/app/admin/products/stock/page.tsx` (liste)
- `apps/web/src/app/admin/products/stock/[productId]/history/page.tsx`
- `apps/web/src/components/admin/stock/StockList.tsx`
- `apps/web/src/components/admin/stock/StockAdjustModal.tsx`
- `apps/web/src/components/admin/stock/StockThresholdsModal.tsx`
- `apps/web/src/components/admin/stock/StockHistoryTable.tsx`
- `apps/web/src/app/api/admin/products/stock/route.ts` (PATCH)

Référence : [`07-admin-form-management.md §6`](./07-admin-form-management.md)

| Composant | Implémenté | Tests RTL+MSW | a11y |
|---|---|---|---|
| `StockList` (cards Lucide stroke 1.5) | ⬜ | ⬜ | ⬜ |
| `StockAdjustModal` (delta + reason obligatoire) | ⬜ | ⬜ | ⬜ |
| `StockThresholdsModal` (low_stock_threshold + restock_eta) | ⬜ | ⬜ | ⬜ |
| `StockHistoryTable` (audit `product_stock_adjustment`) | ⬜ | ⬜ | ⬜ |
| `PATCH /api/admin/products/stock` (revalidateTag) | ⬜ | ⬜ | — |

| Scénario E2E | OK |
|---|---|
| Admin ajuste stock → cache wizard invalidé immédiatement | ⬜ |
| Admin set restock_eta_days → badge "Réapprovisionnement dans X jours" | ⬜ |
| Adjustment audit ligne créée avec `reason` + `adjustedBy` | ⬜ |

### Step 4.5 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 5 — PR #5 : Wizard core + Step 1 Lead

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #5
> **UI spec** : [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) §3-5, §9
> **Frontend arch** : [`09-architecture-frontend.md`](./09-architecture-frontend.md) §2-4
> **Tests** : [`10-tests-strategy.md`](./10-tests-strategy.md) §4.2

### Step 5.1 : i18n setup

⬜ **Statut** :

Créer :
- `apps/web/messages/fr/checkout.json` (cf. [`06-wizard-ui-specification.md §16`](./06-wizard-ui-specification.md))
- `apps/web/messages/ar/checkout.json`

| Action | OK |
|---|---|
| Tous les strings Step 1-4 FR | ⬜ |
| Tous les strings Step 1-4 AR | ⬜ |
| Erreurs codes FR+AR | ⬜ |

### Step 5.2 : State machine + store

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/state/types.ts`
- `apps/web/src/components/commerce/wizard/state/wizard-store.ts` (Zustand persist)
- `apps/web/src/components/commerce/wizard/state/wizard-machine.ts` (FSM transitions)

Référence : [`09-architecture-frontend.md §4`](./09-architecture-frontend.md)

| Test Vitest | OK |
|---|---|
| Store persist key `femiglow-wizard-v1` | ⬜ |
| FSM transitions correctes | ⬜ |
| Reset clear values + currentStep → lead | ⬜ |

### Step 5.3 : Composants génériques

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/fields/WizardField.tsx`
- `apps/web/src/components/commerce/wizard/fields/PhoneInput.tsx`
- `apps/web/src/components/commerce/wizard/WizardProgress.tsx`
- `apps/web/src/components/commerce/wizard/WizardHeader.tsx`
- `apps/web/src/components/commerce/wizard/WizardLayout.tsx`
- `apps/web/src/components/commerce/wizard/WizardFooter.tsx`

Référence : [`06-wizard-ui-specification.md §4, §9`](./06-wizard-ui-specification.md)

| Composant | Implémenté | Tests RTL+MSW | a11y |
|---|---|---|---|
| `WizardField` (idle/focused/valid/error/disabled) | ⬜ | ⬜ | ⬜ |
| `PhoneInput` (+212 prefix + mask) | ⬜ | ⬜ | ⬜ |
| `WizardProgress` (4 segments) | ⬜ | ⬜ | ⬜ |
| `WizardHeader` (logo, back, lang toggle) | ⬜ | ⬜ | ⬜ |
| `WizardLayout` (shell) | ⬜ | ⬜ | ⬜ |
| `WizardFooter` (sticky mobile) | ⬜ | ⬜ | ⬜ |

### Step 5.4 : Step 1 — Lead

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/steps/Step1Lead.tsx`
- `apps/web/src/components/commerce/wizard/Wizard.tsx`

Référence : [`06-wizard-ui-specification.md §5`](./06-wizard-ui-specification.md)

| Comportement | OK |
|---|---|
| 2 champs visibles (firstName, phone) | ⬜ |
| Email expand toggle "+ Ajouter mon email" | ⬜ |
| 3 reassurance badges | ⬜ |
| CTA disabled jusqu'à form valid | ⬜ |
| Submit → POST `/api/checkout/lead` → setLeadId | ⬜ |
| Erreur réseau → toast + retry | ⬜ |
| `lead_capture` event poussé sur dataLayer | ⬜ |

### Step 5.5 : Tests Step 1

⬜ **Statut** :

```bash
bun test apps/web/src/components/commerce/wizard/steps/__tests__/Step1Lead.spec.tsx
bun playwright test apps/web/e2e/wizard-step1-only.spec.ts
```

Référence : [`10-tests-strategy.md §4.2`](./10-tests-strategy.md)

| Scénario | OK |
|---|---|
| 1.1-1.7 (cf. tests strategy) | ⬜ |

### Step 5.6 : Visual snapshot Step 1

⬜ **Statut** :

```bash
bun playwright test apps/web/e2e/visual/wizard-snapshots.spec.ts --grep "Step 1"
```

| Snapshot | OK |
|---|---|
| Step 1 mobile FR | ⬜ |
| Step 1 desktop FR | ⬜ |
| Step 1 mobile AR (RTL) | ⬜ |

### Step 5.7 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 6 — PR #6 : Step 2 + Autocomplete MA

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #6
> **UI spec** : [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) §6
> **Frontend** : [`09-architecture-frontend.md §6.5`](./09-architecture-frontend.md)
> **Tests** : [`10-tests-strategy.md §4.3, §4.5`](./10-tests-strategy.md)

### Step 6.1 : Dataset villes MA

⬜ **Statut** :

```bash
# Télécharger dataset GeoNames MA
# https://download.geonames.org/export/dump/MA.zip
# Extraire + transformer en JSON minimal
```

Créer :
- `apps/web/src/lib/geo/morocco-cities.json` (raw data ~80 KB)
- `apps/web/src/lib/geo/morocco-cities.ts` (typed export)
- `apps/web/src/lib/geo/city-search.ts` (Fuse.js wrapper)

| Action | OK |
|---|---|
| Dataset ~800 villes intégré | ⬜ |
| Champs `id, name, name_ar, name_normalized, name_ar_normalized, postal_code?, aliases?` | ⬜ |
| Bundle < 80 KB gzipped | ⬜ |
| Lazy import via `dynamic` | ⬜ |

### Step 6.2 : Combobox component

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/fields/WizardCombobox.tsx`
- `apps/web/src/components/commerce/wizard/fields/CityCombobox.tsx`

Référence : [`06-wizard-ui-specification.md §6.2`](./06-wizard-ui-specification.md) + [`09-architecture-frontend.md §6.5`](./09-architecture-frontend.md)

| Comportement | OK |
|---|---|
| React Aria useComboBox | ⬜ |
| Keyboard nav ↑↓ Enter Esc | ⬜ |
| Fuzzy search avec Fuse threshold 0.3 | ⬜ |
| ASCII-tolerant | ⬜ |
| RTL aware | ⬜ |
| Empty state fallback "Saisir manuellement" | ⬜ |
| Popover max-height 280px scrollable | ⬜ |
| aria-live count "5 villes trouvées" | ⬜ |

### Step 6.3 : Step 2 — Address + StockIndicator

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/steps/Step2Address.tsx`
- `apps/web/src/components/commerce/wizard/StockIndicator.tsx` (RSC)
- `apps/web/src/components/commerce/wizard/StockIndicator/LowStockPulse.tsx` (client child)

Référence : [`06-wizard-ui-specification.md §6 + §6.4`](./06-wizard-ui-specification.md)

| Field | OK |
|---|---|
| `<StockIndicator>` RSC component en tête de Step 2 | ⬜ |
| 4 états (in_stock / low_stock / restocking / out_of_stock) | ⬜ |
| Icônes Lucide stroke 1.5 (CheckCircle2 / AlertTriangle / Clock / XCircle) | ⬜ |
| `<LowStockPulse>` micro-animation 2.4s (prefers-reduced-motion respecté) | ⬜ |
| Cache tag `product-stock-{productId}` (revalidate 60s) | ⬜ |
| CTA bloqué si `out_of_stock` + bouton "M'avertir" → modale `/api/checkout/stock-notify` | ⬜ |
| City (combobox) | ⬜ |
| Address line 1 | ⬜ |
| Postal code (optional) | ⬜ |
| Landmark (optional) | ⬜ |
| Autofill postal_code si city a un value | ⬜ |
| Debounced PATCH 800ms | ⬜ |
| `address_completed` event | ⬜ |
| `stock_unavailable` event si out_of_stock affiché | ⬜ |

### Step 6.4 : Tests Step 2 + Combobox + StockIndicator

⬜ **Statut** :

| Scénario | OK |
|---|---|
| Tests RTL+MSW Step 2 (10 cas, dont StockIndicator + out_of_stock CTA) | ⬜ |
| Tests `<StockIndicator>` (8 cas s.1–s.8) | ⬜ |
| Tests `GET /api/checkout/stock/[productId]` (6 cas) | ⬜ |
| Tests `POST /api/checkout/stock-notify` (3 cas) | ⬜ |
| Tests Combobox (8 cas) | ⬜ |
| Tests city-search (8 cas) | ⬜ |
| E2E search "casa" → Casablanca | ⬜ |
| E2E out_of_stock → CTA disabled | ⬜ |
| a11y combobox 0 violation | ⬜ |
| a11y StockIndicator role="status" aria-live="polite" | ⬜ |

### Step 6.5 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 7 — PR #7 : Step 3 Payment + Step 4 Thank-You

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #7
> **UI spec** : [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) §7-8
> **Tests** : [`10-tests-strategy.md §4.4`](./10-tests-strategy.md)

### Step 7.1 : Step 3 Payment

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/steps/Step3Payment.tsx`
- `apps/web/src/components/commerce/wizard/fields/WizardRadioGroup.tsx`

Référence : [`06-wizard-ui-specification.md §7`](./06-wizard-ui-specification.md)

| Comportement | OK |
|---|---|
| 2 radios paiement (COD/Bank) | ⬜ |
| COD pré-sélectionné par défaut | ⬜ |
| Cart summary inline | ⬜ |
| Promo code input + apply | ⬜ |
| Consent disclaimer micro-copy sous CTA (pas de checkbox) | ⬜ |
| Audit trail : `consented_at` + `consent_version` set serveur-side au finalize | ⬜ |
| CTA loading overlay sur form | ⬜ |
| Submit → POST `/finalize` → redirect `/merci/[id]` | ⬜ |

### Step 7.2 : Step 4 Thank-You + Lottie + Email opt-in

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/wizard/ThankYou.tsx`
- `apps/web/src/components/commerce/wizard/ThankYouEmailOptIn.tsx`
- `apps/web/src/app/[locale]/merci/[orderId]/page.tsx`
- `apps/web/src/app/api/checkout/order/[orderId]/email/route.ts` (PATCH)
- `apps/web/public/lottie/checkout-success.lottie` (asset designer)
- Migration `0029_orders_email_optin.sql` (cf. [`08-architecture-data.md §3.7`](./08-architecture-data.md))

| Comportement | OK |
|---|---|
| Lottie autoplay one-shot | ⬜ |
| Fallback SVG checkmark si Lottie fail | ⬜ |
| Lazy import `@lottiefiles/dotlottie-react` | ⬜ |
| Récap commande | ⬜ |
| Email opt-in bloc (form indépendant, optionnel) | ⬜ |
| Validation Zod email + état idle → loading → success/error | ⬜ |
| `Idempotency-Key` stable par session | ⬜ |
| Rate limit serveur 3 essais / 10 min | ⬜ |
| Email transactionnel uniquement (pas marketing) | ⬜ |
| `email_optin_submitted` + `email_optin_confirmed` events | ⬜ |
| CTA WhatsApp pré-rempli | ⬜ |
| Cross-sell carousel lazy | ⬜ |
| `purchase` event poussé | ⬜ |

### Step 7.3 : Tests Step 3 + Step 4

⬜ **Statut** :

| Test | OK |
|---|---|
| Step 3 RTL+MSW (8 cas) | ⬜ |
| Step 4 ThankYou RTL+MSW | ⬜ |
| `<ThankYouEmailOptIn>` RTL+MSW (6 cas t.1–t.6) | ⬜ |
| `PATCH /api/checkout/order/[id]/email` route tests (7 cas g.1–g.7) | ⬜ |
| Lottie mount sans crash (mocked) | ⬜ |
| E2E happy path end-to-end | ⬜ |
| E2E Step 4 → email opt-in submit → success | ⬜ |

### Step 7.4 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 8 — PR #8 : Mode A embed sur /kit

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #8
> **UI spec** : [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) §12
> **Tests** : [`10-tests-strategy.md §5.3`](./10-tests-strategy.md)

### Step 8.1 : EmbedWizard component

⬜ **Statut** :

Créer :
- `apps/web/src/components/commerce/kit/EmbedWizard.tsx`
- `apps/web/src/components/commerce/kit/KitCTA.tsx`

Référence : [`06-wizard-ui-specification.md §12`](./06-wizard-ui-specification.md) + [`09-architecture-frontend.md §3.4`](./09-architecture-frontend.md)

| Comportement | OK |
|---|---|
| Mobile: drawer sticky bottom CTA | ⬜ |
| Mobile: drawer 90vh, swipe-down close | ⬜ |
| Desktop: sidebar sticky 560px | ⬜ |
| Pre-fill cart `[1× kit]` | ⬜ |
| `add_to_cart` émis à l'ouverture drawer | ⬜ |
| `form_mode: 'wizard_embed'` | ⬜ |

### Step 8.2 : Integration /kit page

⬜ **Statut** :

Modifier :
- `apps/web/src/app/[locale]/kit/page.tsx`

| Action | OK |
|---|---|
| Detect `NEXT_PUBLIC_KIT_EMBED === '1'` | ⬜ |
| Render `<EmbedWizard>` si embed mode | ⬜ |
| Fallback legacy `<AddToCartButton>` si flag off | ⬜ |

### Step 8.3 : Tests Mode A

⬜ **Statut** :

| Test | OK |
|---|---|
| RTL+MSW EmbedWizard (drawer open/close) | ⬜ |
| E2E mobile happy path drawer | ⬜ |
| E2E desktop happy path sidebar | ⬜ |
| Visual snapshots mobile + desktop | ⬜ |

### Step 8.4 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 9 — PR #9 : Mode B sur /commander

> **Réf principale** : [`05-plan-action.md`](./05-plan-action.md) §2 PR #9

### Step 9.1 : CheckoutFlow wrapper

⬜ **Statut** :

Modifier :
- `apps/web/src/components/commerce/CheckoutFlow.tsx` (devient wrapper variant-aware)
- Rename ancien en `CheckoutFlow.legacy.tsx`

| Action | OK |
|---|---|
| Lit `NEXT_PUBLIC_CHECKOUT_VARIANT` env | ⬜ |
| Si `'wizard'` → monte `<Wizard mode="cart">` | ⬜ |
| Si `'legacy'` → monte ancien flow intact | ⬜ |
| `form_mode: 'wizard_cart'` côté tracking | ⬜ |

### Step 9.2 : Tests Mode B

⬜ **Statut** :

| Test | OK |
|---|---|
| E2E project `checkout-legacy` (variant=legacy) passe | ⬜ |
| E2E project `checkout-wizard` (variant=wizard) passe | ⬜ |
| Switch flag dynamique sans redéploiement | ⬜ |

### Step 9.3 : Activation prod progressive

⬜ **Statut** :

Plan rollout :
1. Preview deploy → QA interne (2-3 jours)
2. 10 % trafic → 24h monitoring
3. 25 % → 24h
4. 50 % → 48h
5. 100 % → 1 semaine
6. Si KPIs OK : merge PR #10 cleanup

| Stage | OK |
|---|---|
| 10 % activé | ⬜ |
| Conversion ≥ legacy après 24h | ⬜ |
| 25 % activé | ⬜ |
| 50 % activé | ⬜ |
| 100 % activé | ⬜ |

### Step 9.4 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 10 — PR #10 : Cleanup legacy

> **Condition** : 3 semaines mini à 100 % + KPIs validés (cf. `05-plan-action.md` §4 Go pour cleanup)

### Step 10.1 : Remove legacy

⬜ **Statut** :

Supprimer :
- `apps/web/src/components/commerce/steps/InfoStep.tsx`
- `apps/web/src/components/commerce/steps/AddressStep.tsx`
- `apps/web/src/components/commerce/steps/PaymentStep.tsx`
- `apps/web/src/components/commerce/CheckoutFlow.legacy.tsx`

Modifier :
- `apps/web/src/components/commerce/CheckoutFlow.tsx` (devient direct wrapper du Wizard, pas plus de variant)

| Action | OK |
|---|---|
| Suppression fichiers | ⬜ |
| Update imports orphans | ⬜ |
| Re-run tous tests | ⬜ |
| Bundle size check (gain attendu) | ⬜ |

### Step 10.2 : PR & merge

⬜ **Statut** : ⬜

---

## Phase 11 — Post-launch monitoring

### Step 11.1 : KPIs tracking

| Métrique | Baseline | Cible 30j | Mesurée | OK |
|---|---|---|---|---|
| Conversion `purchase/begin_checkout` mobile | ~28 % | 33 % | _ | ⬜ |
| Conversion `purchase/view_kit` desktop | ~3.5 % | 4.5 % | _ | ⬜ |
| Taux abandon Step 1 → Step 2 | ~50 % | < 30 % | _ | ⬜ |
| % leads récupérés SMS | 0 % | 5 % | _ | ⬜ |
| Time-to-purchase mobile | ~3 min | < 2 min | _ | ⬜ |
| % `stock_unavailable` events / sessions | — | < 1 % | _ | ⬜ |
| % opt-in email confirmation Step 4 | — | ≥ 35 % | _ | ⬜ |
| Désynchro stock (orders vs decrement) | — | 0 | _ | ⬜ |

### Step 11.2 : Incident response

| Type incident | Action |
|---|---|
| Conversion chute > 10 % | Rollback flag → legacy, investigation |
| Erreurs 500 spike `/finalize` | Roll back PR #7, check DB |
| Lottie ne charge pas | Verify CDN, fallback SVG check |
| Combobox dataset 404 | Static asset rebuild |
| Stock decrement échoue (race condition) | Vérifier `WHERE stock_units >= reservedUnits`, rollback transaction, alert ops |
| Cache stock désynchro (admin update n'apparait pas wizard) | Force `revalidateTag('product-stock-*')` via API admin |
| Email confirmation Step 4 ne s'envoie pas | Vérifier provider transactional, fallback "WhatsApp" CTA reste |

### Step 11.3 : SMS retargeting setup (Phase 11.3 optionnelle)

⬜ **Statut** :

| Action | OK |
|---|---|
| Job nightly cron via Vercel/Inngest | ⬜ |
| SMS provider intégré (Vonage / Twilio / Orange MA) | ⬜ |
| Template SMS FR + AR | ⬜ |
| Link recovery signed token | ⬜ |
| Tests retargeting flow | ⬜ |

---

## Index des fichiers de référence

| Document | Étapes qui le consultent |
|---|---|
| [`01-etat-actuel.md`](./01-etat-actuel.md) | 0.1 (lecture), 10.1 (rollback) |
| [`02-references-synthese.md`](./02-references-synthese.md) | 0.1 (lecture) |
| [`03-propositions.md`](./03-propositions.md) | 0.1 (lecture) |
| [`04-recommandation-finale.md`](./04-recommandation-finale.md) | Toutes phases (source of truth fonctionnel) |
| [`05-plan-action.md`](./05-plan-action.md) | Toutes phases (séquencement PRs) |
| [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) | Phases 5-8 (UI précise) |
| [`07-admin-form-management.md`](./07-admin-form-management.md) | Phase 4 (admin UX) |
| [`08-architecture-data.md`](./08-architecture-data.md) | Phases 2-3 (DB, API) |
| [`09-architecture-frontend.md`](./09-architecture-frontend.md) | Phases 5-9 (front arch) |
| [`10-tests-strategy.md`](./10-tests-strategy.md) | Toutes phases (tests par composant) |
| [`11-runbook.md`](./11-runbook.md) | Ce fichier — pilote |

---

## Commandes de référence

```bash
# Dev quotidien
cd ~/PycharmProjects/template-femiglow/apps/web
bun dev                              # http://localhost:3000
bun test --watch                     # Vitest watch mode
bun playwright test --ui             # Playwright UI mode

# Avant chaque commit
bun run typecheck
bun run lint
bun run test
bun run playwright test --project=chromium

# Avant chaque PR
bun run build                        # Production build
bun run lighthouse:local /commander  # Perf check
bun run check:bundle-size            # Bundle budget

# DB
bun run db:generate                  # Génère migrations from schema
bun run db:migrate                   # Apply migrations
bun run db:studio                    # GUI Drizzle Studio

# Cleanup quand bloqué
pkill -f "next dev"
rm /usr/local/var/postgresql@17/postmaster.pid 2>/dev/null
brew services restart postgresql@17
```

---

## Contact escalation

| Type | Contact |
|---|---|
| Code review wizard | Elazhar |
| Design / Lottie / Copy | Designer FemiGlow |
| DBA / migration tricky | (à définir) |
| Incident prod | Elazhar via WhatsApp |
| Sentry alerts | Slack #femiglow-prod (si configuré) |

---

## Journal des sessions

> Append-only. Le dev en cours ajoute une ligne quotidienne.

| Date | Dev | Phase | Notes |
|---|---|---|---|
| _ | _ | _ | _ |
