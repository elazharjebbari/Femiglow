# 30.6 — Export GTM Container — détail technique

## Spec officielle GTM Container Import

Format documenté par Google : https://developers.google.com/tag-platform/tag-manager/api/v2

Structure top-level :
```json
{
  "exportFormatVersion": 2,
  "exportTime": "ISO8601",
  "containerVersion": {
    "container": { ... metadata ... },
    "tag": [ ... ],
    "variable": [ ... ],
    "trigger": [ ... ],
    "folder": [ ... ]
  }
}
```

## Conversion Mappings → GTM artefacts

Pour une cellule `(eventName='purchase', provider='meta', mappedName='Purchase', isCustom=false, isEnabled=true)` :

### 1. Trigger (généré 1 fois par event canonique)

```json
{
  "accountId": "0",
  "containerId": "0",
  "triggerId": "trg_purchase",
  "name": "FemiGlow: purchase",
  "type": "customEvent",
  "customEventFilter": [
    {
      "type": "equals",
      "parameter": [
        { "type": "template", "key": "arg0", "value": "{{_event}}" },
        { "type": "template", "key": "arg1", "value": "purchase" }
      ]
    }
  ]
}
```

### 2. Tag Meta (généré par cellule active)

```json
{
  "accountId": "0",
  "containerId": "0",
  "tagId": "tag_meta_purchase",
  "name": "FemiGlow: Meta — purchase",
  "type": "cvt_meta_pixel",
  "parameter": [
    { "type": "template", "key": "pixelId", "value": "{{Meta Pixel ID}}" },
    { "type": "template", "key": "eventName", "value": "Purchase" },
    { "type": "boolean", "key": "isStandardEvent", "value": "true" },
    { "type": "template", "key": "value", "value": "{{DLV - value}}" },
    { "type": "template", "key": "currency", "value": "{{DLV - currency}}" },
    { "type": "template", "key": "eventID", "value": "{{DLV - event_id}}" }
  ],
  "firingTriggerId": ["trg_purchase"]
}
```

Pour `isCustom=true` (ex : `checkout_intent`) :
```json
{
  "type": "cvt_meta_pixel",
  "parameter": [
    { "key": "pixelId",     "value": "{{Meta Pixel ID}}" },
    { "key": "eventName",   "value": "trackCustom" },
    { "key": "customEventName", "value": "checkout_intent" },
    ...
  ]
}
```

### 3. Tag GA4

```json
{
  "type": "googtag",
  "parameter": [
    { "key": "tagId", "value": "{{GA4 Measurement ID}}" },
    { "key": "eventName", "value": "purchase" },
    { "key": "eventParameters", "value": "..." }
  ],
  "firingTriggerId": ["trg_purchase"]
}
```

### 4. Tag Google Ads (si `mappedName != null`)

Type `cvt_google_ads_conversion`. Référence `googleAdsConvLabel` (variable du config GTM).

### 5. Variables (DLV — Data Layer Variables)

Une variable par paramètre du dataLayer à exposer :

```json
{
  "variableId": "var_event_id",
  "name": "DLV - event_id",
  "type": "v",
  "parameter": [
    { "key": "name", "value": "event_id" },
    { "key": "dataLayerVersion", "value": "2" }
  ]
}
```

Liste des variables générées :
- `DLV - event_id`
- `DLV - currency`
- `DLV - value`
- `DLV - transaction_id` (purchase)
- `DLV - items` (purchase, add_to_cart)
- `DLV - form_id` (form_*)
- `DLV - first_field` (form_start)
- `DLV - lead_id` (lead_*)
- `DLV - method` (lead_*, sign_up)

### 6. Container metadata

```json
{
  "name": "FemiGlow Web — exported by admin v3",
  "publicId": "GTM-XXXXXXX",
  "usageContext": ["WEB"],
  "domainName": ["femiglow-maroc.com"]
}
```

## Algorithme `buildGtmContainer`

```
1. Lire les mappings de la version + l'env demandé
2. Identifier les events canoniques actifs (au moins 1 cell isEnabled=true)
3. Pour chaque event → générer 1 trigger
4. Pour chaque (event, provider) où isEnabled=true && mappedName!=null :
   → générer 1 tag, en utilisant le bon `type` GTM par provider
   → firingTriggerId pointant vers le trigger de l'event
5. Collecter toutes les variables DLV nécessaires (dédupliquées)
6. Calculer triggerId, tagId, variableId (déterministes, basés sur hash)
7. Assembler le JSON top-level
8. sha256 du payload
```

## Idempotence et déterminisme

- IDs `tagId`, `triggerId`, `variableId` sont déterministes : `${type}_${hash(name)}`
- Même input → même output exact (sha256 stable)
- Permet :
  - Test CI de non-régression (snapshot du output GTM pour `default-mapping`)
  - Détection de changements externes (admin a édité GTM UI manuellement → diff)

## Limitations V1

- Pas de support multi-workspace
- Pas de merge avec un container existant (l'admin doit choisir nouveau workspace ou écrasement explicit)
- Pas de génération automatique des Pixel IDs / Conv labels (l'admin doit configurer côté GTM ou via `/admin/tracking/gtm` config existant)

## Tests

- `gtm-export.test.ts` :
  - ✅ default-mapping → output stable (snapshot)
  - ✅ 0 mappings actifs → container vide valide
  - ✅ tous mappings → containerSize cohérent
  - ✅ sha256 reproductible
  - ✅ JSON valide selon schema officiel (test avec `zod` qui mimique le schema GTM)
- 1 test ULTIMATE : container produit + import via mock GTM ContainerVersion parser + diff sémantique vs input = ∅
