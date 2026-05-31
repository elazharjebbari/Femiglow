# Funnel checkout FemiGlow — Conception, plan, runbook

> Dossier complet : **stratégie + spec UI + architecture + tests + runbook**.
> Tout est interconnecté — partir du `11-runbook.md` pour exécuter le dev,
> consulter les autres fichiers en référence selon l'étape.

---

## Comment lire ce dossier

### Si tu prends connaissance du projet (lecture séquentielle)

| # | Fichier | À lire pour… | Temps |
|---|---|---|---|
| 1 | [`01-etat-actuel.md`](./01-etat-actuel.md) | Comprendre **où on en est** : audit du funnel actuel (code + UX + tracking) + commit `d1bac36`. | 12 min |
| 2 | [`02-references-synthese.md`](./02-references-synthese.md) | Voir les **fondations conceptuelles** : Kolenda (8 PDF) + recherches (neuro forms, autocomplete MA, Lottie). | 10 min |
| 3 | [`03-propositions.md`](./03-propositions.md) | Comparer **3 directions** avec forces/faiblesses/notes /10. | 8 min |
| 4 | [`04-recommandation-finale.md`](./04-recommandation-finale.md) | Lire **la proposition retenue** intégrant les 6 exigences (FR/AR, step 1 minimal lead, autocomplete MA, thank-you Lottie, dataLayer enrichi, variante /kit unique). | 12 min |
| 5 | [`05-plan-action.md`](./05-plan-action.md) | Vue **multi-phases** : 10 PRs séquencées, owners, timeline, rollback. | 10 min |
| 6 | [`06-wizard-ui-specification.md`](./06-wizard-ui-specification.md) | **Spec UI pixel-précise** — source de vérité pendant l'impl. | 20 min |
| 7 | [`07-admin-form-management.md`](./07-admin-form-management.md) | Gestion admin du formulaire : CRUD config, A/B testing, audit trail. | 10 min |
| 8 | [`08-architecture-data.md`](./08-architecture-data.md) | DB schemas Drizzle, migrations SQL, endpoints API, contrats Zod, events GTM. | 15 min |
| 9 | [`09-architecture-frontend.md`](./09-architecture-frontend.md) | Component tree, state Zustand, FSM, i18n RTL, error boundaries, perf budgets. | 15 min |
| 10 | [`10-tests-strategy.md`](./10-tests-strategy.md) | **Scénarios atomiques par composant** : Vitest + RTL+MSW + Playwright + a11y + visuel. ~250 cas. | 15 min |
| 11 | [`11-runbook.md`](./11-runbook.md) | **Pilote opérationnel** : à ouvrir et cocher étape par étape pendant le dev. | À utiliser au fil de l'eau |
| 12 | [`12-delivery-cities-catalog.md`](./12-delivery-cities-catalog.md) | **CHA-230** : catalogue villes DB-driven + kill-switch `NEXT_PUBLIC_USE_DB_CITIES`. | 8 min |

**Lecture totale** : ~2h pour tout absorber. Si tu dois choisir 3 fichiers : **`04`, `06`, `11`**.

### Si tu démarres le dev (exécution)

→ Ouvre directement [`11-runbook.md`](./11-runbook.md) et suis les étapes. Il te renvoie aux autres docs au moment opportun.

---

## Verdict synthétique (TL;DR)

| Question | Réponse |
|---|---|
| Le funnel actuel est-il long ? | **Oui** — 4 clics + 8 champs obligatoires entre `/kit` et la confirmation. Pour COD sur mobile MA, c'est ~2× le best-in-class. |
| Combien on perd ? | Benchmark Baymard 2024 : ~70-75 % entre `add_to_cart` et `purchase`. Cible post-refonte : 50-55 %. |
| Quel est le principal bug ? | **Pas de capture de lead avant l'étape 3.** Un abandon en Step 1 = 0 trace DB → 0 remarketing. |
| Recommandation | **Wizard 3 steps + capture lead immédiate au Step 1**, double mode : (A) embed sur `/kit`, (B) classique sur `/commander`. |
| Combien de PRs ? | 10 PRs séquencées, ~20 j-homme, bascule progressive 10→25→50→100 % |
| Quelle qualité de tests ? | ~250 scénarios atomiques (Vitest+RTL+MSW+Playwright+a11y+visuel), coverage cible 80 % global / 85-95 % sur le wizard |
| Comment l'admin gère le form ? | Config JSON versionnée + CRUD `/admin/checkout/forms` avec audit trail, A/B testing, live preview |
| Réversibilité ? | Flag env `NEXT_PUBLIC_CHECKOUT_VARIANT=legacy` → rollback 5 min |

---

## Structure du dossier

```
docs/checkout-funnel/
├── README.md                            ← vous êtes ici
├── 01-etat-actuel.md                    ← audit avant
├── 02-references-synthese.md            ← fondations Kolenda + recherches
├── 03-propositions.md                   ← 3 options évaluées
├── 04-recommandation-finale.md          ← spec fonctionnelle retenue
├── 05-plan-action.md                    ← 10 PRs séquencées
├── 06-wizard-ui-specification.md        ← UI pixel-précise (critique)
├── 07-admin-form-management.md          ← CRUD admin + A/B
├── 08-architecture-data.md              ← DB, API, schemas Zod
├── 09-architecture-frontend.md          ← components, state, i18n
├── 10-tests-strategy.md                 ← ~250 cas atomiques
├── 11-runbook.md                        ← pilote step-by-step
└── 12-delivery-cities-catalog.md        ← CHA-230 catalogue DB + kill-switch
```

---

## État du dossier

- ✅ Audit complet (code + flux + tracking)
- ✅ Synthèse des références (Kolenda + recherches externes)
- ✅ 3 propositions notées sur 10
- ✅ Recommandation finale intégrant les 6 exigences
- ✅ Plan d'action 10 PRs détaillé
- ✅ Spec UI wizard ultra-détaillée
- ✅ Gestion admin du formulaire
- ✅ Architecture data (DB + API)
- ✅ Architecture frontend (components + state + i18n)
- ✅ Stratégie tests (Vitest + RTL + MSW + Playwright + a11y + visuel)
- ✅ Runbook orchestration
- ⏳ En attente : kick-off Phase 1 (PR #1 tracking baseline)

---

## Quality criteria (rappel)

Le système final doit être :

| Critère | Comment c'est garanti |
|---|---|
| **Robuste** | Tests atomiques par composant + idempotency + retry + rollback |
| **Maintenable** | Modularité (wizard / fields / state / hooks séparés), TypeScript strict, conventions |
| **Débuggable** | Tracking dataLayer enrichi + Sentry breadcrumbs + audit trail admin |
| **Ergonomique** | UI spec basée Kolenda + Baymard + WCAG AA, focus management, RTL natif |
| **Élégant** | Tokens design system + animations sobres (≤ 350ms) + tap targets 48px |
| **Bien structuré** | Arbre fichiers documenté (cf. `09-architecture-frontend.md §2`), naming conventions |
| **Modulable** | Form config admin-managed (champs/ordre/conditions/variantes JSON-driven) |
| **Évolutif** | Migrations additives non-destructives + schema versioning + variants A/B |
| **Fonctionnel** | E2E happy path multi-mode (legacy/embed/cart) + tracking complet |
| **Optimisé** | Perf budgets : LCP < 2.5s, INP < 200ms, JS < 200 KB |

---

## Lien avec le reste du projet

- Funnel actuel (à remplacer) :
  - `apps/web/src/components/commerce/CheckoutFlow.tsx`
  - `apps/web/src/components/commerce/steps/InfoStep.tsx`
  - `apps/web/src/components/commerce/steps/AddressStep.tsx`
  - `apps/web/src/components/commerce/steps/PaymentStep.tsx`
  - `apps/web/src/components/commerce/CartContents.tsx`
- Schémas Zod : `apps/web/src/lib/schemas/order.ts`
- Tracking GTM : `apps/web/src/lib/tracking/gtm/builders.ts` (modifié dans `d1bac36`)
- Cart store : `apps/web/src/lib/stores/cart-store.ts` (Zustand persist `femiglow-cart`)
- Chat lead repo existant : `apps/web/src/lib/chat/repos/lead.ts` (à étendre)
- Auth admin : `apps/web/src/lib/auth/session.ts` + `apps/web/src/middleware.ts`
- Tests MSW : `apps/web/src/test/msw/` (handlers existants)
- Tests E2E : `apps/web/e2e/` + `apps/web/playwright.config.ts`
- Références conception : `docs/kolenda/` (Attention, Color, Copywriting, Ecommerce, Fonts, Luxury, Pricing, UX)
- Tracking taxonomie : `docs/gtm/` & `docs/tracking/` (existant — à étendre)
- i18n : `apps/web/messages/{fr,ar}/` (next-intl)
