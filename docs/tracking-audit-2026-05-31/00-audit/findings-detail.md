# Findings — détail

Convention : chaque finding = **Preuve** (file:line) · **Cause racine** ·
**Impact** · **Correctif** · **Test (rouge→vert)**.

---

## T-01 — P0 — DLV `ecommerce.*` au lieu de `params.*` (awct Google Ads)

**Preuve**
```ts
// plan/exporter.ts:622-624
const txnIdVar   = ensureDlv('DLV - ecommerce.transaction_id', 'ecommerce.transaction_id');
const currencyVar= ensureDlv('DLV - ecommerce.currency',       'ecommerce.currency');
const valueVar   = ensureDlv('DLV - ecommerce.value',          'ecommerce.value');
// …puis L657-659
{ key: 'orderId',         value: txnIdVar },
{ key: 'currencyCode',    value: currencyVar },
{ key: 'conversionValue', value: valueVar },
```
Le dataLayer met ces champs sous `params.*` (`client.ts:168` → `params`), jamais
sous `ecommerce.*` (aucun push `ecommerce` dans tout le code client — vérifié).
Le tag **Snap lit correctement** `params.value` (`exporter.ts:776`), ce qui
prouve l'incohérence interne.

**Cause racine** — chemin DLV hérité d'une convention GA4 `ecommerce` (couche
non implémentée côté push).

**Impact** — `conversionValue` & `currencyCode` `undefined` → Google Ads compte
des conversions **sans valeur** ⇒ ROAS faux. `orderId` `undefined` → **pas de
déduplication** ⇒ conversions **dupliquées** (ROAS gonflé). Le bug le plus
coûteux.

**Correctif** — pointer les 3 DLV vers `params.transaction_id`, `params.currency`,
`params.value`. (Renommer aussi les variables `DLV - value` etc. pour la clarté.)

**Test** — `plan/__tests__/exporter.test.ts` : pour un plan avec `purchase`
+ googleAds, le tag `awct` référence une variable dont
`parameter[name].value === 'params.value'` (et `params.currency`,
`params.transaction_id`).

---

## T-02 — P0 — Tag GA4 `gaawe` sans value/currency/items

**Preuve**
```ts
// plan/exporter.ts:562-574
type: 'gaawe',
parameter: [
  { key: 'eventName', value: event.key },
  { key: 'measurementIdOverride', value: idVars.ga4 },
],   // ← aucun value / currency / items
```
**Impact** — GA4 ne reçoit aucune valeur → revenu GA4 = 0, et toute conversion
Google Ads **importée depuis GA4** = 0.

**Correctif** — pour les events à valeur (catégorie ecommerce + `generate_lead`/
`lead_capture`), ajouter sur `gaawe` un `eventSettingsTable` (ou
`eventSettingsVariable`) mappant `value`→`{{DLV - params.value}}`,
`currency`→`{{DLV - params.currency}}`, `transaction_id`, `items`.

**Test** — le tag `GA4 Evt — purchase` contient des paramètres event-settings
`value`/`currency` pointant `params.*`.

---

## T-03 — P0 — Pixel Meta `custom_data = {}` (pas de valeur)

**Preuve**
```ts
// plan/exporter.ts:601
value: `<script>fbq('track', '${metaName}', {}, { eventID: {{DLV - event_id}} });</script>`,
//                                          ^^ custom_data vide
```
Côté serveur, `meta.ts:72` n'enrichit `value/currency` **que** pour
`purchase`/`purchase_server` — pas pour `generate_lead`/`lead_capture`.

**Impact** — Purchase **et** Lead Meta partent **sans valeur** côté pixel. La
déduplication Pixel↔CAPI fait que la version sans valeur peut « gagner » →
ROAS Meta dégradé / Advantage+ mal alimenté.

**Correctif** — injecter `custom_data` depuis `params` :
`{ value: {{DLV - params.value}}, currency: {{DLV - params.currency}},
contents: …, content_type:'product' }`, en gardant `eventID` en 4ᵉ arg.
Optionnel : étendre l'enrichissement DB CAPI (`_enrich-purchase`) aux leads.

**Test** — snapshot du tag `Meta Evt — purchase` contient `value`/`currency`
dans le 3ᵉ argument `fbq`.

---

## T-04 — P1 — Exporter `mappings` : pas de balise de linkage + awct invalide

**Preuve** — `mappings/gtm-export.ts:104-111` (`google_ads:'awct'`) + L257-266 :
```ts
{ key: 'conversionId',    value: '{{Google Ads Customer ID}}' }, // ❌ ≠ conversion ID
{ key: 'conversionLabel', value: cell.mappedName },              // ❌ = nom d'event, pas le label Google
// ❌ ni conversionValue, ni currencyCode, ni Conversion Linker / googtag
```
**Impact** — si l'admin exporte via le bouton `MappingExportButton`, Google Ads
ne compte rien correctement (label invalide, pas d'attribution sans linker).
C'est le candidat le plus probable du symptôme « souci de balise de linkage ».
Le plan exporter, lui, gère le linker via `googtag` « Ads Cfg »
(`exporter.ts:373-389`).

**Correctif** — déprécier `mappings/gtm-export.ts` + faire pointer le bouton UI
vers l'export plan (ou supprimer la route). Décision T-09.

**Test** — la route `export-gtm` renvoie un avis de dépréciation **ou** un
container à parité avec `exportPlan`.

---

## T-05 — P1 — Pinterest absent du plan exporter

**Preuve** — `plan/exporter.ts` : 0 occurrence de `pinterest` ; aucun
`event.providers.pinterest`, aucun « Pinterest Init », aucun `pintrk`. Pourtant
`event-mapping.ts` mappe Pinterest pour `page_view`, `view_item`, `add_to_cart`,
`purchase`, `generate_lead`, `sign_up`, `search`…

**Impact** — events Pinterest jamais générés dans le container (« events non
ajoutés à l'exporter »).

**🔁 RE-SCOPÉ (vérif code)** — ce n'est **pas un oubli** : Pinterest est
**volontairement hors du système plan v2**. `PROVIDER_IDS` (plan/types.ts:3) =
`['ga4','googleAds','meta','tiktok','snap','gtm']` — pas de `pinterest` ; et
`plan/canonical-seed.ts` dit explicitement « providers non-supportés en v2
(pinterest) sont ignorés ». Pinterest **fire via CAPI serveur**
(`pinterestAdapter` dans le registry → Pinterest Conversions API), pas via GTM.
Donc rien n'est cassé : Pinterest = **CAPI-only** par design.

**Décision PO requise** — garder Pinterest en CAPI-only (statu quo) **ou**
le ré-introduire dans le plan/container GTM = une **feature** (étendre
`PROVIDER_IDS` + `envConfigSchema.pinterestTagId` + UI admin + DB), pas un
bug-fix. Non implémenté dans cette passe pour respecter la décision v2.

---

## T-06 — P1 — `generate_lead` du chat sans `value`

**Preuve**
```ts
// LeadFormBubble.tsx:249
emit('generate_lead', { method: 'chat', lead_id: data.leadId, currency: 'MAD' }); // ❌ pas de value
// vs CheckoutFlow.tsx:329-332
emit('generate_lead', { currency: 'MAD', value: total / 100 });                   // ✅ value présente
```
✅ L'event **atteint bien le dataLayer** (`emit`→`getDataLayer().push`) et
`/api/track` (conversion : `route.ts:36`). Seule la **valeur** manque.

**Impact** — leads chat valorisés à 0 (Meta Lead / Ads lead / value-based
bidding). `currency` sans `value` = signal invalide.

**Correctif (décidé PO)** — `value` du lead chat = **prix du kit avec la
promotion**. Calcul **serveur-authoritative** :
`effectiveCents = promoPriceCents ?? priceCents` (`products/public.ts:52-64`),
`value = effectiveCents / 100`, `currency` = devise produit (MAD).
1. `/api/chat/lead/contact/route.ts` : ajouter `{ value, currency }` à la réponse
   `{ ok, leadId, outcomeMessage }` (L247-250), depuis le prix public du kit.
2. `LeadFormBubble.tsx:249` : émettre `generate_lead` avec `value`+`currency`
   issus de la réponse API (pas de prix en dur côté client).

**Test** — (a) la route renvoie `value>0` + `currency` cohérents avec le prix
promo du kit ; (b) `LeadFormBubble` émet `generate_lead` avec ces `value`/
`currency`.

---

## T-07 — P2 — Double-fire GA4 (client `gaawe` + serveur MP)

**Preuve** — `/api/track` dispatche **tous** les events aux providers serveur
(`route.ts:209 dispatchToProviders`) ; `googleAdapter` (`google.ts`) envoie à
`mp/collect` ; le même event fire aussi client via `gaawe` (GTM). GA4 ne déduplique
pas nativement gtag↔MP (≠ Meta/TikTok/Snap qui dédupent par `event_id`).

**Impact** — sur-comptage GA4 possible (revenu/conversions ×2) si GA4 est activé
**à la fois** client (GTM) et serveur (provider DB).

**Correctif (décidé PO)** — **GA4 = client GTM uniquement.** Le dispatch serveur
MP (`googleAdapter`) est réservé aux events **server-scope** (`purchase_server`).
Garde-fou : `googleAdapter.supports` ne retourne `true` que pour ces events
(ou flag config) → supprime le double-comptage.

**Test** — décision documentée + test : `googleAdapter` skip les events déjà
couverts client.

---

## T-08 / T-09 — P2 — Dette d'architecture (exporters divergents)

- **T-08** : `mappings/gtm-export.ts:285-294` lit `name:'value'` (top-level) →
  même classe de bug que T-01. Couvert par la dépréciation (T-04).
- **T-09** : trois générateurs (`plan/exporter`, `mappings/gtm-export`,
  `gtm/builders`) ; le **drift-detector** compare contre `gtm/builders`
  (`snapshot.ts:17`) que personne n'exporte → drift non fiable.
  **Correctif** : reconverger `snapshot.ts` (et l'UI) sur `exportPlan` ;
  déprécier `builders.ts` + `mappings/gtm-export.ts`.
