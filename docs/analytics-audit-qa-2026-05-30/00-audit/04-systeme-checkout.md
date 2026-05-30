# 04 — Système Checkout (`/admin/analytics/checkout`)

Fichiers : `lib/analytics/queries/checkout.ts` (502) · `app/api/admin/analytics/checkout/route.ts` ·
`components/admin/analytics/checkout/{CheckoutDashboard,CheckoutKpiGrid,CheckoutFunnelStepper,
CheckoutTimeToSubmit,CheckoutFormErrors,CheckoutAbandonedFields}.tsx`.

## 1. Fonctionnement optimal

4 KPI session-level + funnel **6 étapes** + histogramme **time-to-submit** + **top erreurs
formulaire** + **top champs abandonnés**.

Étapes (`classifyEvent`, `checkout.ts:292`) :
`view_cart → begin_checkout → add_shipping(_info) → add_payment(_info) → submit(checkout_submit) →
purchase(+ purchase_server)`. Un `purchase` force aussi `submit=true` (tous les forms n'émettent
pas un submit distinct). Les `purchase_server` (webhook Stripe fallback) comptent dans `purchase`
mais sont **isolés** dans `serverFallbackPurchases` (transparence ops).

KPI : `viewCart`, `beginCheckout`, `submissions` (= **purchases**), `abandons`,
`serverFallbackPurchases`.

Time-to-submit : durée `begin_checkout → purchase`, filtrée `[1 s, 30 min]` (anti-bot + cap
outliers), **12 buckets de 50 s** (0–600 s) + percentiles **P25/P50/P75/P95**.

## 2. Justesse — analyse

✅ **Time-to-submit soigné** : filtre bot `<1 s`, cap 30 min, percentile par interpolation linéaire
correcte (`checkout.ts:383`), `sampleSize` exposé.

✅ **Server fallback** bien modélisé et tracé séparément.

🔴 **AF-03 (funnel non-cumulatif)** : chaque étape comptée **indépendamment** (`checkout.ts:143` :
`if (s.view_cart) ...; if (s.begin_checkout) ...`). Donc `begin_checkout` **peut dépasser**
`view_cart` (un visiteur arrivé directement sur le checkout sans `view_cart`), ce qui produit une
**progression > 100 %** affichée dans le stepper. Sémantiquement différent du Funnel (cumul strict).
À décider : garder le modèle « BOOL_OR par étape » (et clamp/expliquer la progression) ou aligner.

⚠️ **F-CHK-02 (« submissions » = purchases)** : le KPI nommé « soumissions » compte en réalité les
**achats** (`checkout.ts:182`), pas les soumissions de formulaire (`submit`). Nommage trompeur pour
l'opérateur (un form soumis mais paiement échoué n'est pas une « submission » ici).

⚠️ **F-CHK-03 (abandon — bord de fenêtre)** : `abandons` compte `begin_checkout` sans `purchase`
dans `[from,to]`, ou `purchase` > 60 min après. Si `begin_checkout` est en **fin de période** et le
`purchase` survient **juste après `to`** (hors fetch), la session est comptée **abandon** à tort
(faux positif). Symétriquement, un `begin_checkout` juste avant `from` n'est pas vu.

⚠️ **F-CHK-04 (abandon = begin sans purchase, fenêtre 60 min non vérifiée si purchase absent)** :
si pas de `purchase` du tout, abandon=oui quelle que soit l'ancienneté — un `begin_checkout` de
il y a 5 min (pas encore acheté) est déjà compté abandon. Léger sur-comptage des abandons récents.

⚠️ **Erreurs/abandons dépendent d'events front** `form_validation_error` / `form_abandon` : si le
front ne les émet pas (ad-blocker, page quittée brutalement), sous-comptage. `field_id`/`error_code`
fallback `'unknown'` → vérifier que l'UI agrège proprement les `unknown`.

⚠️ **AF-04 (fuseau horaire)** sur today/yesterday.

## 3. Réactivité & UI

🔴 **AF-01** : `CheckoutDashboard.tsx:31` fige `useState(initialFilters)`. Double fetch au mount.

✅ Sous-blocs avec `loading`/`EmptyState` ; stepper, histogramme, deux tables (erreurs, champs).

## 4. Points à vérifier / tester

| PoV | À garantir |
|---|---|
| **Précision data** | Chaque étape = nb sessions distinctes ayant émis l'event ; progression/drop-off cohérents (et clampés si non-cumulatif) ; TTS filtré `[1 s,30 min]` ; percentiles justes ; `sampleSize` correct. |
| **KPI** | `submissions` = purchases (renommer ou documenter) ; `serverFallbackPurchases ≤ submissions` ; `abandons` = règle 60 min appliquée correctement (cf. F-CHK-03/04). |
| **Fonctionnel UI** | Changer les filtres rafraîchit les 4 zones. Histogramme : 12 buckets, dernier bucket = overflow (≥550 s). Tables top 20 erreurs / top 10 champs. EmptyState si rien. |
| **Edge cases** | submit implicite via purchase ; `add_shipping_info` ≡ `add_shipping` ; bot <1 s exclu du TTS ; outlier >30 min cappé ; bord de fenêtre (F-CHK-03). |
| **Backend** | `purchase_server` compté + isolé ; consent gate ; auth. |
| **UX/Design** | Stepper lisible (étapes, %), histogramme avec axes, durées formatées (`2m 5s`), distinction visuelle serveur/abandon. |
| **a11y** | Histogramme et stepper accessibles (texte alternatif), tables avec en-têtes. |

## 5. Findings (extrait)

| ID | Sév. | Résumé |
|---|---|---|
| AF-01 | P0 | Filtres ne rafraîchissent pas le dashboard |
| AF-03 | P1 | Funnel non-cumulatif → progression > 100 % possible |
| F-CHK-02 | P2 | KPI « submissions » = purchases (nommage) |
| F-CHK-03 | P2 | Faux abandon au bord de fenêtre |
| F-CHK-04 | P2 | Sur-comptage abandons récents (begin sans purchase encore) |
