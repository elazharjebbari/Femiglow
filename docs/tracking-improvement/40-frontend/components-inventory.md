# 40.1 — Components inventory

## Composants à créer (NEW)

### `GtmConfigEditWizard.tsx`
Wizard multi-steps pour éditer/cloner une version GTM existante.
- 5 steps : confirmation → édition par env (×4) → récap diff → activation
- Steps configurables via `wizard-edit-version.json`
- État géré via `useReducer`

### `ProvidersSnapshotPanel.tsx`
Affiche un récapitulatif des pixels enregistrés dans `tracking_providers`.
Bouton "Importer ces valeurs" qui hydrate `GtmConfigForm`.

### `SyncIndicator.tsx`
Petit composant visuel à côté de chaque champ pixel dans `GtmConfigForm` :
- ✅ vert : valeur identique au Provider
- ⚠ orange : valeur divergente
- ✏ bleu : override manuel par version
- Tooltip explicatif au hover

### `EventCategorizationTable.tsx`
Tableau éditable pour `/admin/tracking/events/categorization`.
- Liste tous les events `isConversion: true`
- Dropdown éditable par event
- Bouton reset au default
- Indicateur visuel "override active" / "default"

### `ConversionActionsMappingPanel.tsx`
Pour chaque catégorie Google Ads, montre le Conversion Action Label associé.
Bouton "Editer dans GTM" link vers `/admin/tracking/gtm/<active>/edit#googleAds`.

### `ProvidersAnalyticsTable.tsx`
Tableau analytics par provider :
- Total events, success rate, latency p50/p95, errors 24h
- Refresh auto 30s
- Drill-down : clic → liste des derniers events échoués

### `ConversionsChart.tsx`
Bar chart 7 jours des conversions, groupées par jour.
Utilise `recharts` (déjà dans le projet).

### `ConsentDebugPanel.tsx`
Visible en dev uniquement. Affiche :
- État courant `localStorage` + cookie
- Last `gtag('consent','update')` payload
- Boutons "Force granted" / "Force denied" pour QA

### `GoogleAdsOnboardingWizard.tsx`
Wizard OAuth pour autoriser FemiGlow à uploader des conversions à
Google Ads. 4 steps :
1. Customer ID
2. OAuth redirect
3. Mapping conversions
4. Test event

## Composants à modifier

### `GtmConfigForm.tsx`
Refonte complète :
- Nouveau prop `seedFrom: 'providers' | 'version' | 'template' | 'empty'`
- Nouveau prop `mode: 'create' | 'edit'` (édition = clone + override)
- Intégration `SyncIndicator` pour chaque champ pixel
- Section "Google Ads Conversion Actions" enrichie (catégories)

### `TrackingProvider.tsx`
Ajout :
- Génération `event_id` par event dans le TrackingClient
- Propagation `event_id` au snippet client (gtag, fbq)
- Capture `gclid` depuis URL ou cookie

### `PixelLoader.tsx`
Ajout :
- Listening sur `fg:consent-changed` → re-injecte si denied → granted
- Idempotence renforcée (vérification `script[data-tracking-pixel="<kind>"]`)

### `ConsentBanner.tsx`
Pas de changement V1 (banner désactivé actuellement). À garder en cas d'activation.

## Pages à créer

### `/admin/tracking/events/categorization`
Page server component → `EventCategorizationTable` client.

### `/admin/tracking/analytics/providers`
Page server component → `ProvidersAnalyticsTable` client + `ConversionsChart`.

### `/admin/tracking/google-ads/oauth-callback`
Route handler OAuth Google Ads callback (server-only).

## Hooks à créer

### `useGtmConfig(versionId)`
SWR hook qui fetch `/api/admin/tracking/gtm/<id>`. Retourne `{ data, error, isLoading, mutate }`.

### `useProvidersSnapshot()`
SWR hook qui fetch `/api/admin/tracking/providers/snapshot`. Cache 60s.

### `useEventCategorization()`
SWR hook qui fetch la liste catégorisée des events. Mutate sur update.

### `useProvidersAnalytics(window)`
SWR hook qui fetch les KPIs par provider. Auto-refresh 30s.

### `useTrackingClient()`
Hook qui retourne l'instance `TrackingClient` et expose `emit(eventName, params)`.
Gère le contexte `gclid`, `fbp`, `fbc`.

## Hooks à modifier

### `useChatSession`
Pas de changement direct mais l'event `chat_lead_form_submit` doit
hériter de `event_id` proper.

## Routes admin à créer

```
app/admin/tracking/
├── events/
│   └── categorization/
│       └── page.tsx ✨
├── analytics/
│   └── providers/
│       └── page.tsx ✨
└── google-ads/
    └── oauth-callback/
        └── route.ts ✨
```
