# ADR-003 — Format d'export vers GTM

**Statut** : Proposed
**Date** : 2026-05-13
**Décideurs** : Tech Lead, Marketing

## Contexte

L'utilisateur veut "importer directement dans son container GTM Web". Deux niveaux d'intégration possibles :
1. Export d'un fichier JSON que l'admin charge dans GTM UI (manuel mais simple)
2. Push automatique via Google Tag Manager API v2 (OAuth requis)

Pour V1 on choisit le niveau le plus simple, V2 pourra évoluer.

## Options évaluées

### Option A — Export JSON brut "à notre sauce"
- Format custom FemiGlow
- L'admin doit copier/coller manuellement
- ❌ Erreur humaine fréquente
- ❌ Non standard

### Option B — Format GTM Container Import (recommandé V1) ★
- Format officiel reconnu par GTM UI dans "Admin → Container → Import Container"
- L'admin télécharge le fichier puis fait "drag-drop" dans GTM UI
- ✅ Zéro copy-paste, zéro erreur de format
- ✅ GTM lit le fichier, propose preview, l'admin valide
- ✅ Pas d'OAuth, pas de Google API quota
- ⚠ Doit respecter la spec GTM exportFormatVersion: 2 (documentée par Google)

### Option C — Push direct via Tag Manager API v2 (OAuth)
- ✅ Zéro étape manuelle
- ❌ OAuth complexité (cf. tracking-improvement chantier 1 skip)
- → V2

## Décision

**Option B** — Export GTM Container JSON compatible Import GTM UI.

## Conséquences

### Spec du fichier produit

```json
{
  "exportFormatVersion": 2,
  "exportTime": "2026-05-13T18:00:00Z",
  "containerVersion": {
    "container": {
      "name": "FemiGlow Web Container (export from FemiGlow admin)",
      "publicId": "GTM-XXXXXXX",
      "usageContext": ["WEB"]
    },
    "tag": [
      {
        "name": "GA4 - purchase",
        "type": "googtag",
        "parameter": [
          { "key": "tagId", "value": "G-XXXXXXX" },
          { "key": "eventName", "value": "purchase" },
          { "key": "eventParameters", "value": "..." }
        ],
        "firingTriggerId": ["{{purchase_trigger_id}}"]
      },
      { "name": "Meta - Purchase", ... }
    ],
    "variable": [
      { "name": "DLV - event_id", "type": "v", "parameter": [{"key": "name", "value": "event_id"}] },
      { "name": "DLV - currency", "type": "v", ... },
      ...
    ],
    "trigger": [
      { "name": "Custom - purchase", "type": "customEvent", "customEventFilter": [{"parameter": [{"key": "arg0", "value": "{{_event}}"}, {"key": "arg1", "value": "purchase"}]}] },
      ...
    ]
  }
}
```

### Mapping FemiGlow → GTM artefacts

| FemiGlow concept | GTM artefact produit |
|---|---|
| Event canonique (`purchase`) | Trigger custom event (déclenche sur dataLayer push `event: 'purchase'`) |
| Mapping Meta `Purchase` (isCustom=false) | Tag Meta type `cvt_meta_pixel` (template communautaire ou Custom HTML) |
| Mapping Meta `checkout_intent` (isCustom=true) | Tag Meta type avec `eventName: 'trackCustom'` + `customEventName: 'checkout_intent'` |
| Mapping GA4 `purchase` | Tag `googtag` avec `eventName: 'purchase'` |
| Param event (currency, value) | Variable `DLV` (Data Layer Variable) référencée par le tag |

### Validation post-export

Pour garantir que le JSON produit est importable :
1. **Test unitaire** : valide schéma JSON contre le spec officiel GTM (schema validator)
2. **Test ULTIMATE** (round-trip) : `version → export → réimport (mock GTM) → diff sémantique = ∅`
3. **Validation manuelle** : 1 fois par semaine, l'admin télécharge un export et l'importe vraiment dans un container GTM de staging

### Limitations V1

- **Pas de pixel ID/conv labels dans l'export V1** — ceux-ci sont gérés séparément dans `/admin/tracking/gtm` (configs) et l'admin doit faire un 2e import GTM. C'est intentionnel pour séparer "mappings sémantiques" (ce module) et "credentials providers" (l'autre module).
- **Pas de fusion intelligente** : l'import GTM crée des tags/variables/triggers avec des noms `FemiGlow:*`. Les existants ne sont pas merged automatiquement. L'admin peut soit (a) repartir d'un container vide, soit (b) faire l'import en mode "merge & rename".
- **Pas de support workspaces multiples** : on génère pour le default workspace.

### Test CI obligatoire

```typescript
// scripts/check-gtm-export-format.ts
import { buildGtmContainer } from 'apps/web/src/lib/tracking/mappings/gtm-export';
import { defaultMapping } from 'docs/event-mappings/20-data/default-mapping.json';
import { gtmContainerSchema } from './gtm-schema-zod';

const container = buildGtmContainer({ mappings: defaultMapping.mappings, env: 'production' });
const parsed = gtmContainerSchema.parse(container);
console.log('GTM export schema OK');
```

## Évolution V2

- Push automatique via API v2 → ADR séparée quand on aborde sGTM ou OAuth Google Ads
- Support multi-workspace
- Merge intelligent avec un container existant

## Liens
- ADR-004 (provider config shape)
- `30-backend/gtm-export.md`
- Doc officielle Google : https://developers.google.com/tag-platform/tag-manager/api/v2#export_format
