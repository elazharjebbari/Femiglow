# Audit approfondi — Module Analytics `/admin/analytics` (bugs prod)

> **Date** : 2026-06-04 · **Commanditaire** : opérateur FemiGlow (bugs constatés en prod)
> **Nature** : audit racine **fondé sur preuves** (introspection DB live) + dossier QA complet
> avec batterie de tests orientée UI/opérateur (MSW · Vitest · Playwright), plan d'action et runbook.
> **Style** : audit « grand cabinet » — chaque défaut a une **preuve**, une **cause racine**, un **fix**,
> un **test qui échoue avant / passe après**, et une **trace** dans le registre.

## 0. Symptômes rapportés (prod)

1. **Vue d'ensemble** : taux de rebond toujours nul.
2. **Top pages** : toujours vide.
3. **Funnel principal** : Engage/CTA/Checkout/Purchase ne fonctionnent pas ; drop-off à 100% incompréhensible ; funnel par page d'entrée vide (sauf « views »).
4. **CTA** : tout vide.
5. **Checkout** : presque tout vide.
6. **Insights** : tout vide.

## 1. Verdict

**Le module d'agrégation n'est pas en cause sur le fond — il agrège des événements qui, pour la
plupart, n'arrivent jamais en base, ou sous un nom qu'il n'attend pas.** La cause est en amont
(émission + ingestion + mapping de noms) et au niveau du **modèle de funnel cumulatif** qui s'effondre
dès qu'une étape intermédiaire est vide.

> **Statut produit : NON VALIDE pour la prise de décision.** Les chiffres affichés sont faux par
> construction (0 / 100% / vide) tant que la taxonomie d'événements et le modèle de funnel ne sont pas
> réconciliés.

## 2. Preuve (introspection DB live — `00-overview/evidence-db-2026-06-04.txt`)

`tracking_events_log` : **1005 événements** sur 2026-05-07 → 2026-06-03, **100% `analytics_storage=granted`**.

| Attendu par l'agrégation | En base (90j) | Verdict |
|---|---|---|
| `page_view` | **0** | 🔴 ABSENT → casse Bounce + Top pages |
| `scroll_depth` / `scroll_depth_50` | **0** | 🔴 ABSENT → casse *engage* |
| `cta_impression` | **0** | 🔴 ABSENT → casse *engage* + onglet CTA |
| `cta_click` | **0** | 🔴 ABSENT (vrais clics émis en `pack_cta_click` → **rejetés à l'ingestion**) |
| `view_cart` | **0** | 🔴 ABSENT → casse étape checkout `view_cart` |
| `checkout_intent` / `purchase_server` | **0** | 🟠 ABSENT (variantes) |
| `view_item` | 339 | ✓ |
| `begin_checkout` | 97 | ✓ (mais inutilisable, cf. funnel cumulatif) |
| `lead_capture` | 52 | ✓ |
| `add_to_cart` | 26 | ✓ |
| `add_payment_info` | 18 | ✓ |
| `generate_lead` | 17 | ✓ (ignoré par le funnel « purchase ») |
| `address_completed` | 15 | ✓ (mais **non mappé** par le checkout → `add_shipping_info` attendu) |
| `purchase` | 13 | ✓ |
| `add_shipping_info` | 4 | ✓ |

## 3. Causes racines (synthèse — détail dans `00-overview/findings-register.csv`)

- **AN-01 (P0)** — `page_view` n'est jamais stocké → **bounce rate** (lit `page_view` par session) renvoie `null`/0 et **top pages** (groupe par `page_view.page_route`) est vide. L'app émet `view_item` sur /kit, pas `page_view` générique.
- **AN-02 (P0)** — **Funnel cumulatif strict** (`engage = view ∧ engage`, `cta = view ∧ engage ∧ cta`, …) **+ étape *engage* alimentée par des événements absents** (`scroll_depth_50` mauvais nom, `cta_impression`=0, `video_user_play`≈0). Résultat : **aucune session ne dépasse *view*** → CTA/Checkout/Purchase = 0 → drop-off 100% partout, **alors que** begin_checkout(97)/add_to_cart(26)/purchase(13) existent.
- **AN-03 (P0)** — **Onglet CTA vide** : dépend de `cta_impression` (0) et `cta_click` (0). Les vrais clics sont émis sous `pack_cta_click`/`video_cta_click`/`composition_post_cta_click`, **rejetés à l'ingestion** car absents du schéma de validation (`tracking.ingest.unknown_event`).
- **AN-04 (P0)** — **Checkout** : `view_cart`=0 (jamais émis) ; l'événement d'adresse réel `address_completed` **n'est pas mappé** (le classifieur attend `add_shipping_info`/`add_shipping`) ; pas d'événement `submit`. Plusieurs étapes restent à 0.
- **AN-05 (P0)** — **Insights vide** : les événements nécessaires (view_item/begin_checkout/add_payment_info/purchase/generate_lead) **existent en base**, donc la cause est les **vues matérialisées non rafraîchies** en prod (le « firstRun »/matview vide est confondu avec « pas de trafic »).
- **AN-06 (P1)** — **Sémantique de conversion** : le funnel « purchase » ne compte que `purchase` (13) et **ignore `generate_lead` (17)**. Pour un tunnel COD orienté lead, la conversion doit être `generate_lead` **ou** `purchase` (indication opérateur).
- **AN-07 (P1)** — **Overview sans filtre de consentement** (incohérent avec funnel/cta/checkout qui filtrent `analytics_storage=granted`) → KPI calculés sur un dataset différent.
- **AN-08 (P1, report audit 2026-05-30)** — Revenu CTA ÷100 (value en MAD majeur traité comme cents) ; AN-09 réactivité des filtres (`useState` figé) ; AN-10 fuseau horaire (UTC vs Maroc) ; AN-11 device défaut `mobile`. Reportés ici pour couverture exhaustive.

## 4. Navigation du dossier

- `00-overview/` — README (ici), `findings-register.csv` (preuves+fixes+tests), `architecture.puml`, `feature-inventory.csv`, `test-strategy.md`, `quality-gates.yaml`, `traceability-matrix.csv`, `evidence-db-2026-06-04.txt`, `event-taxonomy.csv` (émis→stocké→attendu).
- `A00-…` à `A09-…` — un sous-dossier par fonctionnalité/défaut (spec.md, test-cases.csv, scenarios.md, fixtures.json [+ flow.puml]).
- `90-action-plan/` — plan par vagues (émission/ingestion → mapping → modèle funnel → matviews → tests) + boucle de correction + journal de décision.
- `99-runbook/` — runbook d'exécution + commandes + introspection DB + triage.

## 5. Conventions
Réutilise le gabarit `docs/coupon-loyalty-qa-ui-2026-06-03/00-overview/TEMPLATE.md` (types U/I/C/M/E/A/V,
schéma `test-cases.csv`, cycle MSW par fichier, exécution depuis `apps/web/`). Doctrine : **chaque
finding P0/P1 a ≥1 test qui échoue avant le fix et passe après**.
