# A07 — Onglet Checkout (funnel 6 étapes + abandons + time-to-submit + erreurs)

## Rôle & surface
Onglet « Checkout » de `/admin/analytics`. Calculé par `getCheckoutData()` dans
`apps/web/src/lib/analytics/queries/checkout.ts`. Comprend :
- KPI session-level : `viewCart`, `beginCheckout`, `submissions` (=purchase), `abandons`,
  `serverFallbackPurchases` (`CheckoutKpiTotals`).
- Funnel 6 étapes `CHECKOUT_STAGES = [view_cart, begin_checkout, add_shipping, add_payment, submit,
  purchase]` (modèle BOOL_OR, chaque étape = sessions ayant émis l'event ; `dropoffToNext` clampé ≥ 0).
- Histogramme **time-to-submit** (begin_checkout → purchase, plafond 30 min, P25/P50/P75/P95).
- Top erreurs formulaire (`form_validation_error`) + champs abandonnés (`form_abandon`).

Vu par l'opérateur (« Karim ») qui diagnostique où les clientes décrochent dans le tunnel COD.

Couvre **AN-04** : view_cart=0, `address_completed` non mappé, pas d'event `submit`, abandons/TTS
dépendant de `begin_checkout`+`purchase`.

## Fonctionnement optimal (ce qui DOIT se passer)
- L'étape **Add Shipping** doit compter les sessions ayant renseigné l'adresse. L'app émet
  `address_completed` (15 en base) depuis le wizard `AddressStep` ; le funnel doit le compter.
- L'étape **View Cart** doit refléter les vues panier réelles. Aujourd'hui `view_cart` n'est jamais émis
  (0 en base) ; soit on l'émet (page panier au mount), soit on accepte qu'elle reste à 0 mais sans casser
  la lecture des étapes suivantes (modèle BOOL_OR, déjà non cumulatif).
- L'étape **Submit** doit représenter la soumission du formulaire. Aucun event `submit`/`checkout_submit`
  n'est émis ; le code marque `submit=true` quand `purchase` arrive (L386) → submit ≈ purchase, jamais
  d'écart submit↗purchase observable. Définir un vrai signal de soumission (ou documenter submit≡purchase).
- **Abandons** = sessions `begin_checkout` sans `purchase` dans la fenêtre 60 min. Avec 97 begin_checkout
  et 13 purchase, l'opérateur doit voir ~84 abandons (et non 0).
- **Time-to-submit** : sur les 13 sessions converties, l'histogramme et les percentiles doivent être
  renseignés (pas `null` partout).

## Contrat I/O
- Entrée : `AnalyticsFilters` + `now`.
- Sortie : `CheckoutData { range, totals, steps, timeToSubmit, topErrors, topAbandonedFields }`.
- `classifyEvent()` (L333-355) mappe les `eventName` → `CheckoutStage` :
  - `view_cart` → `view_cart`
  - `begin_checkout` → `begin_checkout`
  - `add_shipping_info` | `add_shipping` → `add_shipping`  ⚠️ **PAS `address_completed`**
  - `add_payment_info` | `add_payment` → `add_payment`
  - `checkout_submit` | `submit` → `submit`  ⚠️ **aucun de ces deux n'est émis**
  - `purchase` | `purchase_server` → `purchase`
  - sinon `null` (event ignoré).
- `fetchEvents` (L446-482) **filtre** `consent_snapshot->>'analytics_storage'='granted'` (cohérent avec
  funnel/cta, contrairement à overview — cf. AN-07/A01).
- Late-purchase window `(to, to+60min]` lue pour ne pas compter comme abandon une conversion juste après
  la période (L135-149).

## Cas limites & non-happy-path
- **Dataset prod réaliste** :
  - `add_shipping` = 4 (seuls les `add_shipping_info`), **les 15 `address_completed` ne sont pas comptés**
    → l'étape adresse paraît dévastée. ← bug central AN-04.
  - `view_cart` = 0 (jamais émis) → 1ère étape vide ; `progressionFromPrevious` de `begin_checkout` =
    `null` (prev=0) ; le funnel reste lisible grâce au BOOL_OR mais l'opérateur voit une 1ère barre nulle.
  - `submit` ≈ `purchase` (toujours, car `submit=true` posé à l'arrivée de purchase) → pas de signal
    propre de soumission.
- **Abandons** : `begin_checkout` ancien (> 60 min avant `now`) sans purchase → compté abandon.
  `begin_checkout` récent (< 60 min) → NON compté (fenêtre non écoulée).
- **TTS** : purchase < 1 s après begin_checkout → exclu (bot, `MIN_TTS_SECONDS`). purchase > 30 min →
  plafonné `MAX_TTS_SECONDS`. Aucune session begin+purchase → percentiles `null`, sampleSize 0.
- **Consentement** : events `denied` exclus (différent d'overview).
- **`checkout_intent` (0 en base) / `lead_capture` (52)** : non mappés par `classifyEvent` → ignorés ;
  fix possible : `lead_capture`/`checkout_intent` → `begin_checkout` (cf. findings-register AN-04).

## Invariants couverts
- **INV-CHK-MAP-SHIPPING** : l'événement d'adresse réellement émis (`address_completed`) est compté dans
  l'étape Add Shipping.
- **INV-CHK-ABANDON** : un `begin_checkout` sans purchase (fenêtre écoulée) compte comme abandon.
- **INV-CHK-SUBMIT** : l'étape submit a une définition non triviale (≠ simple recopie de purchase) OU est
  documentée comme alias de purchase.
- Lacune adressée : view_cart non émis ; classifieur désaligné sur les noms réels.

## Critères d'acceptation (observables)
- [REPRO] Sur fixture prod, l'étape `add_shipping` compte 4 (uniquement `add_shipping_info`), pas 19
  (4 + 15 `address_completed`).
- [REPRO] Sur fixture prod, `totals.viewCart === 0` et `steps[0].sessions === 0`.
- [REPRO] Sur fixture prod, `steps.find(s=>s.stage==='submit').sessions === steps.find(purchase).sessions`
  (submit recopie purchase).
- [REPRO] Avec 1 `address_completed` seul (sans add_shipping_info), `add_shipping === 0`.
- [SPEC] Après fix mapping, `add_shipping` compte les sessions avec `address_completed` OU
  `add_shipping_info` → 19 sur la fixture.
- [SPEC] Après fix, abandons = `beginCheckout` − sessions converties dans la fenêtre (≈ begin_checkout
  anciens non convertis).
- [SPEC] Time-to-submit : sur ≥1 session begin+purchase valide, `p50` est un nombre (pas `null`).

## Points à vérifier — tous points de vue
- **Backend** : étendre `classifyEvent` (L333) — `address_completed` → `add_shipping` ;
  `lead_capture`/`checkout_intent` → `begin_checkout` (à décider) ; définir un vrai `submit` ou documenter
  l'alias ; émettre `view_cart` (page panier au mount, déjà prévu dans `inventory.generated.json`).
- **Frontend** : `CheckoutDashboard` doit afficher une 1ère étape vide sans laisser croire à un funnel à
  100 % de drop ; tooltip explicatif si `view_cart`=0.
- **UI/UX/design** : barres funnel, pas de `%`/emoji superflus ; terracotta = économie uniquement.
- **Data** : cohérence avec l'onglet Insights (qui compte `add_payment_info`) et le funnel global
  (AN-02/AN-06) ; semantique COD (lead = conversion).
- **A11y** : étapes annoncées avec valeurs ; histogramme TTS avec table équivalente.
- **i18n** : libellés d'étapes FR/AR (Panier, Début commande, Adresse, Paiement, Soumission, Achat).
