# Plan d'action — Refonte funnel checkout FemiGlow

> Plan d'exécution **multi-phases**, chaque phase = 1 PR atomique, mergeable
> indépendamment, livrable en prod sans casser l'existant grâce au flag
> `NEXT_PUBLIC_CHECKOUT_VARIANT` (`legacy` | `wizard`).
>
> **Source de vérité de la cible** : [`04-recommandation-finale.md`](./04-recommandation-finale.md).
> **Pilotage opérationnel** : [`11-runbook.md`](./11-runbook.md) (à suivre étape par étape pendant le dev).
> **Référence UI pendant l'impl.** : [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md).

---

## 0. Principes directeurs

| Principe | Application |
|---|---|
| **Pas de big bang** | Chaque PR ≤ 600 lignes diff (hors tests/snapshots). Feature flag par défaut OFF. |
| **Backward compatible** | Le funnel `legacy` reste exploitable jusqu'à phase 9. Tout `orders` produit reste lisible par l'admin existant. |
| **Test-first sur la donnée** | Tout endpoint nouveau a son test Vitest+MSW avant le code de prod (cf. `10-tests-strategy.md`). |
| **Mesurable** | `dataLayer` enrichi dès la phase 1 — on instrumente AVANT de refondre l'UI pour avoir une baseline propre. |
| **Réversible** | Rollback = bascule du flag `CHECKOUT_VARIANT=legacy` côté env, redéploiement < 5 min. Aucune migration destructive. |
| **i18n natif** | FR + AR (RTL) câblé dès la première phase UI, pas en après-coup. |

---

## 1. Vue d'ensemble : 10 phases, 10 PRs

| # | PR | Périmètre | Files clés créés / modifiés | Tests bloquants | Flag par défaut | Durée estimée |
|---|---|---|---|---|---|---|
| 1 | `feat(checkout): instrumentation dataLayer enrichie` | Étendre les events GTM existants (ajouter `lead_id`, `form_mode`, `step_name`, `variant`). Pas d'UI. | `apps/web/src/lib/tracking/gtm/builders.ts`, `docs/gtm/EVENTS.md` | Vitest builders + Playwright "events fired" | `legacy` | 1 j |
| 2 | `feat(db): migrations chat_lead extension + form_config` | Drizzle migrations : ajouter `chat_lead.source`, `chat_lead.cart_snapshot`, `chat_lead.gclid`/`fbclid`, créer `form_config`, `form_config_history`. | `apps/web/src/lib/chat/db/schema.ts`, `apps/web/drizzle/0023_*.sql`, `apps/web/src/lib/db/schema.ts` | Vitest schema + smoke run drizzle-kit | n/a | 1 j |
| 3 | `feat(api): endpoints lead + form-config` | API routes : `POST /api/checkout/lead`, `PATCH /api/checkout/lead/[id]`, `GET /api/admin/form-config`, `PUT /api/admin/form-config/[id]`. Idempotence via `Idempotency-Key`. | `apps/web/src/app/api/checkout/lead/route.ts`, `apps/web/src/app/api/admin/form-config/*`, `apps/web/src/lib/checkout/repos/*` | Vitest+MSW handlers (cf. `10-tests-strategy.md` §3.1) | n/a | 2 j |
| 4 | `feat(admin): UI form-config CRUD` | Page admin `/admin/checkout/forms` : list + edit (champs activés, ordre, libellés FR/AR, variant assignment %). Live preview. | `apps/web/src/app/admin/checkout/forms/*`, `apps/web/src/components/admin/forms/FormConfigEditor.tsx` | Vitest unit + Playwright admin flow | n/a | 2 j |
| 5 | `feat(checkout): wizard core + lead capture step 1` | Nouveau composant `Wizard` (FSM XState ou useReducer), step 1 minimal lead (firstName+phone). Émet `lead_capture` event. Pas encore branché sur `/kit`. | `apps/web/src/components/commerce/wizard/Wizard.tsx`, `apps/web/src/components/commerce/wizard/steps/Step1Lead.tsx`, `apps/web/src/components/commerce/wizard/state.ts` | Vitest (RTL) + MSW handlers `POST /lead` + a11y axe | `wizard` derrière flag | 3 j |
| 6 | `feat(checkout): wizard step 2 + autocomplete MA` | Step 2 (adresse + ville avec Fuse.js + dataset GeoNames MA). Patch `chat_lead` côté serveur. | `apps/web/src/components/commerce/wizard/steps/Step2Address.tsx`, `apps/web/src/lib/geo/morocco-cities.ts`, `apps/web/src/components/commerce/wizard/CityCombobox.tsx` | Vitest combobox (clavier/RTL) + Playwright fuzzy search | `wizard` derrière flag | 2 j |
| 7 | `feat(checkout): wizard step 3 payment + step 4 thank-you Lottie + email opt-in` | Step 3 (paymentMethod COD/Bank + promo + disclaimer consent implicite). Step 4 ThankYou : animation `dotLottie` + récap + **email opt-in optionnel** pour confirmation. Émission `purchase` + `thankyou_email_optin`. | `apps/web/src/components/commerce/wizard/steps/Step3Payment.tsx`, `apps/web/src/components/commerce/wizard/ThankYou.tsx`, `apps/web/src/components/commerce/wizard/ThankYouEmailOptIn.tsx`, `apps/web/public/lottie/checkout-success.lottie` | Vitest payment + email opt-in + Playwright end-to-end purchase | `wizard` derrière flag | 2,5 j |
| 8 | `feat(/kit): variante embed page` | Mode A : intégration du wizard sur `/kit` (sticky bottom mobile, sidebar desktop). Le bouton "Ajouter au panier" devient "Commander en 30s". | `apps/web/src/app/[locale]/kit/page.tsx`, `apps/web/src/components/commerce/kit/EmbedWizard.tsx` | Vitest layout responsive + Playwright kit→purchase | `wizard` derrière flag, sub-flag `EMBED` | 2 j |
| 9 | `feat(/commander): wizard remplace checkout legacy` | Mode B : `/commander` utilise le nouveau wizard quand `CHECKOUT_VARIANT=wizard`. Garde-fou : si flag `legacy`, l'ancien `CheckoutFlow.tsx` reste actif. | `apps/web/src/components/commerce/CheckoutFlow.tsx` (wrapper), `apps/web/src/app/[locale]/commander/page.tsx` | Playwright A/B (deux storageState : variant=wizard / variant=legacy) | `wizard` après QA | 1 j |
| 10 | `chore(checkout): cleanup legacy après stabilité` | **À déclencher minimum 3 semaines après bascule 100 %** : suppression `InfoStep.tsx`/`AddressStep.tsx`/`PaymentStep.tsx`, archivage `CheckoutFlow.legacy.tsx`. | suppression `apps/web/src/components/commerce/steps/*` | Re-run tests | n/a | 0.5 j |

**Total estimé** : ~16,5 j-homme dev + ~2 j QA + ~1 j design QA + ~0,5 j ops/instrumentation = **~20 jours-homme** (3-4 semaines calendaires avec 1 dev + 0,5 designer).

---

## 2. Détail PR par PR

### PR #1 — `feat(checkout): instrumentation dataLayer enrichie`

**Branche** : `feat/checkout-tracking-baseline`
**Issue parent** : à créer `CHA-XXX Funnel tracking baseline`
**Owner** : 1 dev fullstack

**Objectif business** : avoir des events propres AVANT toute refonte UI, pour pouvoir mesurer le delta après bascule.

**Scope code** :
- `apps/web/src/lib/tracking/gtm/builders.ts` : étendre `buildBeginCheckoutEvent`, `buildAddPaymentInfoEvent`, `buildPurchaseEvent` avec :
  - `lead_id?: string` (optionnel pour rester compatible legacy)
  - `form_mode: 'legacy' | 'wizard_embed' | 'wizard_cart'`
  - `step_name: 'contact' | 'address' | 'payment' | 'lead' | 'review'`
  - `variant: 'A' | 'B' | 'control'`
- Nouveau event `lead_capture` (à ajouter au taxonomie GTM Import/Export).
- Update `docs/gtm/EVENTS.md` (taxonomie UPPER_SNAKE_CASE).

**Tests** :
- `apps/web/src/lib/tracking/gtm/__tests__/builders.spec.ts` : 8 cas
- `apps/web/e2e/tracking-legacy-baseline.spec.ts` : 1 happy path qui vérifie les events sur `dataLayer` via `page.evaluate`

**Critères d'acceptation** :
- [ ] Tous les events existants émettent encore les mêmes propriétés (rétro-compat)
- [ ] Les 4 nouvelles propriétés sont optionnelles (Zod `.optional()`)
- [ ] Test snapshot des payloads conforme à `docs/gtm/EVENTS.md`
- [ ] GTM Import/Export reste valide (vérifié via `bun run check:gtm`)

**Risques** : modification d'un fichier sensible (`builders.ts`) ; mitigation = couverture tests à 100 % avant merge.

---

### PR #2 — `feat(db): migrations chat_lead extension + form_config`

**Branche** : `feat/checkout-db-foundation`
**Owner** : 1 dev fullstack

**Objectif** : préparer la couche données pour le lead capture et la gestion admin du formulaire.

**Migrations Drizzle** (cf. `08-architecture-data.md` §2 pour le SQL complet) :
- `chat_lead` : ajouter `source` (enum), `cart_snapshot` (jsonb), `gclid` (text), `fbclid` (text), `utm_*` (text), `consented_at` (timestamptz)
- nouvelle table `form_config` : id, slug (`checkout_wizard`), version, status (`draft|published|archived`), config (jsonb), published_at, created_by, updated_by
- nouvelle table `form_config_history` : audit trail (id, form_config_id, version, diff, author, created_at)
- nouvelle table `form_variant_assignment` : id, lead_id, form_config_id, variant_key, weight, assigned_at — pour A/B testing déterministe

**Tests** :
- `apps/web/src/lib/chat/db/__tests__/schema.spec.ts` : nouveau test `chat_lead extended columns`
- `apps/web/src/lib/db/__tests__/migrations.spec.ts` : smoke test (drizzle-kit migrate up → down)

**Critères d'acceptation** :
- [ ] Migration up + down sans erreur (testé en local)
- [ ] Aucune donnée existante perdue (default value sur new columns)
- [ ] Schema types regenerated (`bun run db:generate`)
- [ ] Repo `leadRepo` étendu avec `createMinimal()`, `patchContact()`, `patchAddress()` (pas encore exposé via API en PR2, juste prêt côté repo)

---

### PR #3 — `feat(api): endpoints lead + form-config`

**Branche** : `feat/checkout-api-endpoints`
**Owner** : 1 dev backend

**Endpoints créés** (cf. `08-architecture-data.md` §3 pour contrats exhaustifs) :
- `POST /api/checkout/lead` — création initiale (firstName + phone obligatoires)
- `PATCH /api/checkout/lead/[leadId]` — patch progressif (adresse, paiement, consentement)
- `POST /api/checkout/lead/[leadId]/finalize` — finalisation = conversion lead → order
- `GET /api/admin/form-config` — list configs (admin auth requise)
- `GET /api/admin/form-config/[id]` — détail config
- `PUT /api/admin/form-config/[id]` — update config + bump version (admin auth requise)
- `POST /api/admin/form-config/[id]/publish` — publish (draft → published)
- `POST /api/admin/form-config/[id]/rollback` — rollback à une version antérieure
- `GET /api/checkout/form-config/active` — endpoint public côté wizard (renvoie la config en `status=published`, cache `revalidateTag('form-config')`)

**Sécurité** :
- Middleware `requireAdmin` pour tous les `/api/admin/*` (cf. `apps/web/src/middleware.ts`)
- Rate limit sur `POST /api/checkout/lead` (10 req/min/IP via upstash)
- Idempotency-Key header sur tous les `POST` mutateurs
- CSRF protégé par le `same-origin` (Next App Router) + double-submit token sur formulaires server actions

**Tests** :
- `apps/web/src/app/api/checkout/lead/__tests__/route.spec.ts` : 6 cas (happy, dup, invalid phone, missing fields, idempotency replay, rate limit)
- `apps/web/src/app/api/admin/form-config/__tests__/route.spec.ts` : 5 cas (admin only, publish, rollback, history listing)
- MSW handlers correspondants dans `apps/web/src/test/msw/handlers/checkout-lead.ts`, `apps/web/src/test/msw/handlers/admin-form-config.ts`

---

### PR #4 — `feat(admin): UI form-config CRUD`

**Branche** : `feat/admin-form-config-ui`
**Owner** : 1 dev fullstack + 0,5 designer

**Pages créées** (cf. `07-admin-form-management.md` pour spec UX exhaustive) :
- `/admin/checkout/forms` — liste (statuts, version active, métriques rapides)
- `/admin/checkout/forms/[id]` — éditeur avec :
  - Onglet **Champs** : drag & drop ordre, toggle obligatoire/optionnel, label FR + label AR
  - Onglet **Logique** : conditions d'affichage (`if city = 'Casablanca' show district`)
  - Onglet **Variantes** : assignation % pour A/B
  - Onglet **Aperçu** : preview live (iframe sur `/preview/checkout?config=<id>`)
  - Onglet **Historique** : versions précédentes + diff visuel + bouton rollback

**Stack UI** :
- React Hook Form + Zod (cohérence avec existant)
- `@dnd-kit/sortable` pour reorder
- shadcn/ui `Dialog`, `Tabs`, `DropdownMenu` (déjà utilisés)

**Tests** :
- `apps/web/src/components/admin/forms/__tests__/FormConfigEditor.spec.tsx` (Vitest+RTL+MSW) : 8 cas
- `apps/web/e2e/admin/form-config.spec.ts` (Playwright) : 3 scénarios (créer, modifier+publier, rollback)

---

### PR #5 — `feat(checkout): wizard core + lead capture step 1`

**Branche** : `feat/wizard-core-step1`
**Owner** : 1 dev frontend senior

**Composants créés** (cf. `06-wizard-ui-specification.md` pour spec UI/animation exhaustive) :
- `Wizard.tsx` — orchestrateur : state machine, navigation, persistance localStorage
- `WizardLayout.tsx` — shell visuel : header avec progress, body, footer sticky
- `WizardProgress.tsx` — barre de progression 4 segments
- `WizardField.tsx` — composant générique de champ (label flottant, error inline, RTL-aware)
- `Step1Lead.tsx` — formulaire minimal : prénom + téléphone (`+212` prefix locked)
- `state.ts` — store Zustand `useWizardStore` (persist key `femiglow-wizard-v1`)

**Comportement clé Step 1** :
- Sur **blur** du téléphone valide → `POST /api/checkout/lead` (silent, debounced 600ms)
- Sur **succès** → store `lead_id` dans Zustand (chiffré ? non, simple ID) + cookie HttpOnly `fg_lead` (côté serveur)
- Sur **erreur réseau** → retry x3 puis fallback "On vous rappelle" + queue dans localStorage
- Émission `lead_capture` event sur `dataLayer`

**Tests** :
- Vitest+RTL+MSW : 7 scénarios sur `Step1Lead` (cf. `10-tests-strategy.md` §3.2)
- Vitest sur `state.ts` : transitions FSM, persist/hydrate
- Playwright : ne couvre pas encore le full flow (PR #7 + #9)
- axe-core a11y : 0 violation critique/serious

---

### PR #6 — `feat(checkout): wizard step 2 + autocomplete MA`

**Branche** : `feat/wizard-step2-address`
**Owner** : 1 dev frontend

**Composants créés** :
- `Step2Address.tsx` — adresse ligne 1 + ville (combobox) + code postal optionnel + repère optionnel
- `CityCombobox.tsx` — React Aria `useComboBox` + Fuse.js fuzzy + RTL
- `apps/web/src/lib/geo/morocco-cities.ts` — dataset des 800+ villes MA (depuis GeoNames, statique, ~80 KB minifié)

**Comportement** :
- Sur **valid step 2** → `PATCH /api/checkout/lead/[id]` (debounced 800ms)
- Émission event `address_completed`

**Tests** :
- Vitest+RTL : 9 cas combobox (clavier, mouse, RTL, accents, ASCII tolerant, screen reader)
- Playwright : fuzzy search "casa" → "Casablanca" sélectionnée
- a11y axe : combobox correctement annoncé NVDA-style

---

### PR #7 — `feat(checkout): wizard step 3 payment + step 4 thank-you Lottie`

**Branche** : `feat/wizard-step3-payment-step4-thanks`
**Owner** : 1 dev frontend + 0,5 designer (Lottie)

**Composants créés** :
- `Step3Payment.tsx` — radios paiement (COD pré-sélectionné, Bank), promoCode, disclaimer consentement implicite sous le CTA (pas de checkbox bloquante)
- `Step4ThankYou.tsx` — animation Lottie + récap commande + **email opt-in optionnel** (`PATCH /api/checkout/order/[orderId]/email`) + CTA WhatsApp + cross-sell
- `ThankYouEmailOptIn.tsx` — sub-component : input email + bouton "Recevoir la confirmation" → toast succès
- `apps/web/public/lottie/checkout-success.lottie` — animation (à fournir par le designer)

**Comportement** :
- Sur **submit** → `POST /api/checkout/lead/[id]/finalize` → redirige `/merci/[orderId]`
- Émission events `add_payment_info`, `purchase`

**Tests** :
- Vitest+RTL : 6 cas
- Playwright `wizard-end-to-end.spec.ts` : happy path complet (Step1 → Step4)
- Lottie : test que l'animation se monte sans crash (mock `@lottiefiles/dotlottie-react`)

---

### PR #8 — `feat(/kit): variante embed page (Mode A)`

**Branche** : `feat/kit-embed-wizard`
**Owner** : 1 dev frontend + 0,5 designer

**Modifications** :
- `apps/web/src/app/[locale]/kit/page.tsx` — détecte `process.env.NEXT_PUBLIC_KIT_EMBED === '1'`, monte `<EmbedWizard />`
- `apps/web/src/components/commerce/kit/EmbedWizard.tsx` — wrapper qui pré-remplit le panier (1 kit) et monte le wizard inline
- **Mobile (< 768px)** : sticky bottom drawer qui s'ouvre au tap du CTA
- **Desktop (≥ 1024px)** : sidebar à droite (sticky), bottle gallery à gauche

**Tracking spécifique** :
- Override `form_mode: 'wizard_embed'` sur tous les events
- `add_to_cart` est émis automatiquement à l'ouverture du drawer (consentement implicite via interaction)

**Tests** :
- Vitest layout responsive (RTL: `matchMedia` mocked)
- Playwright : `kit-embed.spec.ts` happy path mobile + desktop

---

### PR #9 — `feat(/commander): wizard remplace checkout legacy (Mode B)`

**Branche** : `feat/commander-wizard-mode`
**Owner** : 1 dev fullstack

**Modifications** :
- `apps/web/src/components/commerce/CheckoutFlow.tsx` devient un **wrapper** qui lit `process.env.NEXT_PUBLIC_CHECKOUT_VARIANT` :
  - `legacy` (défaut) → monte l'ancien `InfoStep/AddressStep/PaymentStep`
  - `wizard` → monte `<Wizard mode="cart" />`
- Aucun changement de logique cart
- Le `form_mode` côté tracking devient `wizard_cart`

**Tests** :
- Playwright A/B : 2 projets `checkout-legacy` et `checkout-wizard` qui basculent via env override

---

### PR #10 — `chore(checkout): cleanup legacy après stabilité`

**Condition pour merger** : taux conversion `wizard` ≥ taux `legacy` mesuré sur 3 semaines de bascule 100 %.

**Modifications** :
- Suppression `apps/web/src/components/commerce/steps/InfoStep.tsx`
- Suppression `apps/web/src/components/commerce/steps/AddressStep.tsx`
- Suppression `apps/web/src/components/commerce/steps/PaymentStep.tsx`
- Renommage `CheckoutFlow.tsx` → suppression du wrapper, `Wizard` devient direct
- Update tests qui référençaient l'ancien flow

---

## 3. Sequencing & dépendances

```
PR1 (tracking)         ──┐
PR2 (db migrations)    ──┤
                         ├──→ PR3 (api) ──┐
                         │                 ├──→ PR4 (admin UI)
                         │                 │
                         │                 ├──→ PR5 (wizard core) ──→ PR6 (step2) ──→ PR7 (step3+4) ──┬──→ PR8 (kit embed)
                         │                 │                                                            │
                         │                 │                                                            ├──→ PR9 (commander wizard)
                         │                 │                                                            │
                         │                 │                                                            └──→ (3 semaines QA) ──→ PR10 cleanup
```

**Parallélisation possible** :
- PR1 et PR2 en parallèle
- PR3 dépend de PR2
- PR4 peut commencer en parallèle de PR5 dès que PR3 est mergée
- PR8 et PR9 peuvent être traités en parallèle après PR7

---

## 4. Critères go/no-go par phase

### Go pour mise en prod du wizard (PR9 mergée + flag activé)
- [ ] Lighthouse score mobile ≥ 88 (`/commander` et `/kit` avec wizard)
- [ ] axe-core a11y : 0 violation critique/serious sur tous les steps
- [ ] CWV mobile : LCP < 2,5 s, INP < 200 ms, CLS < 0,1
- [ ] Toutes les suites Playwright vertes en CI
- [ ] Coverage Vitest ≥ 80 % sur les composants wizard
- [ ] QA manuelle FR + AR (RTL) validée sur device réel (iPhone Safari + Android Chrome)
- [ ] Smoke test prod : 5 commandes test passées sans erreur sur les 3 modes (legacy/embed/cart)

### Go pour cleanup (PR10)
- [ ] 3 semaines mini de bascule à 100 % du trafic en wizard
- [ ] Taux conversion `purchase / begin_checkout` ≥ taux legacy mesuré sur la même période YoY
- [ ] Aucun incident P0/P1 lié au funnel sur 14 j glissants
- [ ] Validation Elazhar par écrit

---

## 5. Rollback procedure

**Niveau 1** (5 min) — Bascule env var :
```bash
# Vercel / runtime
NEXT_PUBLIC_CHECKOUT_VARIANT=legacy
NEXT_PUBLIC_KIT_EMBED=0
# Redéploiement instantané
```

**Niveau 2** (30 min) — Revert PR :
```bash
git revert <sha-pr-merge> --no-edit
git push origin main
# Build + déploy CI
```

**Niveau 3** (1 j) — Rollback DB (en dernier recours, **non destructif**) :
- Les migrations PR #2 ajoutent uniquement (pas de DROP)
- Donc rollback DB = no-op : on désactive juste l'écriture côté API
- Si VRAIMENT besoin : `bun run db:migrate:down` (drizzle-kit)

---

## 6. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Régression conversion en cours de bascule | Moyenne | Élevé | Bascule progressive 10 → 25 → 50 → 100 % avec monitoring quotidien |
| Lottie animation alourdit le bundle | Faible | Faible | `dotLottie` + lazy import ; budget JS < 50 KB ajouté |
| Autocomplete dataset MA trop lourd | Faible | Moyen | Dataset chargé en dynamic import, code-split, ~80 KB gzip |
| Admin UI complexité sous-estimée | Moyenne | Moyen | MVP en PR4 = read+toggle visibilité, drag-drop+conditional en PR4.1 si besoin |
| Bug iron-session sur admin auth | Faible | Élevé | Tests Playwright `admin-auth.spec.ts` couvrent renew, logout, expire |
| Migration `chat_lead` casse les chats existants | Faible | Élevé | Migration uniquement ADD COLUMN, default values safe, tests E2E chat avant deploy |
| RTL casse le layout sur certains devices | Moyenne | Moyen | Tests visuels Playwright en `locale=ar` + QA manuelle 3 devices |
| Rate limit upstash mal configuré bloque users | Faible | Moyen | Soft limit (warn) en preview, hard limit (block) en prod, monitoring |

---

## 7. Métriques de succès (post-bascule)

| Métrique | Baseline (legacy) | Cible 30 j | Cible 90 j |
|---|---|---|---|
| Conversion `purchase / begin_checkout` mobile | ~25-30 % (estim.) | +5 pts | +10 pts |
| Conversion `purchase / view_kit` desktop | ~3-4 % | +1 pt | +2 pts |
| Taux abandon Step 1 → Step 2 | ~50 % | < 30 % | < 25 % |
| % leads récupérés via SMS retargeting | 0 % | 5 % | 10 % |
| Time-to-purchase moyen (mobile) | ~3 min | < 2 min | < 90 s |
| % erreurs validation côté client | mesurer | < 5 % | < 3 % |
| INP p75 mobile `/commander` | mesurer | < 200 ms | < 150 ms |

---

## 8. Resources & references

| Doc | Usage |
|---|---|
| [`01-etat-actuel.md`](./01-etat-actuel.md) | Connaître l'état avant refonte (pour rollback / régression) |
| [`02-references-synthese.md`](./02-references-synthese.md) | Justifier les choix UX (cite Kolenda + Baymard) |
| [`03-propositions.md`](./03-propositions.md) | Pourquoi C+B et pas A |
| [`04-recommandation-finale.md`](./04-recommandation-finale.md) | Spec fonctionnelle source de vérité |
| [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) | **Spec UI pendant l'implémentation, pixel par pixel** |
| [`07-admin-form-management.md`](./07-admin-form-management.md) | UX/UI admin |
| [`08-architecture-data.md`](./08-architecture-data.md) | Schémas DB, API contracts |
| [`09-architecture-frontend.md`](./09-architecture-frontend.md) | Component tree, state, i18n |
| [`10-tests-strategy.md`](./10-tests-strategy.md) | Scénarios Vitest+MSW+Playwright par composant |
| [`11-runbook.md`](./11-runbook.md) | **À ouvrir et suivre étape par étape pendant le dev** |
