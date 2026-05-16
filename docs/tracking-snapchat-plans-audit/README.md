# Audit Snapchat Pixel / CAPI dans Plans unifies

Date: 2026-05-16  
Worktree cible pour la suite: `/var/www/femiglow-leads-webhook-multi-step` (`leads-webhook-multi-step`)

## Objectif

Auditer pourquoi le systeme **Plans (unifie)** ne permet pas de construire le tracking Snapchat Pixel / Snapchat Conversions API, puis proposer un plan d'action complet backend, frontend, UI/UX, data, conception, developpement et tests.

La suite du chantier doit se faire dans le worktree deja en place du webhook:

```bash
cd /var/www/femiglow-leads-webhook-multi-step
```

Ce worktree est deja rattache a sa DB et a son `.env`; il ne faut pas developper cette evolution depuis `/var/www/femiglow` `master`.

## Sources externes verifiees

- Snap Conversions API v3: https://developers.snap.com/api/marketing-api/Conversions-API/Introduction
- Snap CAPI setup, Pixel ID, access token: https://developers.snap.com/api/marketing-api/Conversions-API/GetStarted
- Endpoint v3, structure `data[]`, `event_id`: https://developers.snap.com/api/marketing-api/Conversions-API/MigrationGuide
- Parametres et events standards Snap CAPI: https://developers.snap.com/api/marketing-api/Conversions-API/Parameters
- Snap Pixel setup: https://businesshelp.snapchat.com/articles/en_US/Knowledge/pixel-website-install
- Snap Pixel via GTM: https://businesshelp.snapchat.com/articles/en_US/Knowledge/formatting-pixel
- Website audience events Snap: https://developers.snap.com/api/marketing-api/Ads-API/audience-creation/website-events

## Resume executif

Le constat UI est confirme: Snapchat n'est pas integre dans **Plans (unifie)**. Ce n'est pas un simple manque de label. `snap` est absent du modele de plan, du seed canonique, des ecrans wizard et de l'export GTM.

En revanche, le repository contient deja une base Snapchat ailleurs:

- enum DB `tracking_provider_kind` avec `snap`;
- provider registry avec adapter `snap`;
- adapter CAPI `apps/web/src/lib/tracking/providers/snap.ts`;
- catalogue d'events avec `snap` dans plusieurs `defaultProviders`;
- mapping vendor avec plusieurs `snap`;
- matrice Event Mappings capable de representer `snap`.

Le probleme est donc une integration incomplete entre deux couches:

1. **runtime provider / mappings**: Snapchat existe partiellement;
2. **Plans unifies / GTM export / UI admin**: Snapchat est ignore.

Consequence pratique: meme si un provider Snap peut exister en base, un admin ne peut pas construire proprement un plan incluant Snapchat Pixel, exporter les tags `snaptr`, ni appliquer une politique de conversions "Snapchat uniquement" via l'attribution.

## Cartographie du code actuel

### Plans unifies

Fichiers:

- `apps/web/src/lib/tracking/plan/types.ts`
- `apps/web/src/lib/tracking/plan/canonical-seed.ts`
- `apps/web/src/lib/tracking/plan/exporter.ts`
- `apps/web/src/components/admin/tracking/plans/wizard/StepProviders.tsx`
- `apps/web/src/components/admin/tracking/plans/wizard/StepEnvProfiles.tsx`
- `apps/web/src/components/admin/tracking/plans/wizard/StepEvents.tsx`

Constats:

- `PROVIDER_IDS = ['ga4', 'googleAds', 'meta', 'tiktok', 'gtm']`.
- `envConfigSchema` ne contient pas `snapPixelId`.
- `canonical-seed.ts` documente que `snap` et `pinterest` sont ignores.
- `StepProviders` n'a pas de carte Snapchat.
- `StepEnvProfiles` n'a pas d'ID Snap.
- `StepEvents.syncFromCatalog()` mappe `google_ga4`, `google_ads`, `meta`, `tiktok`, mais pas `snap`.
- `exportPlan()` genere GA4, Google Ads, Meta, TikTok, mais pas Snap.

### Runtime providers

Fichiers:

- `apps/web/src/lib/db/schema.ts`
- `apps/web/src/lib/db/types.ts`
- `apps/web/src/lib/db/queries/tracking/providers.ts`
- `apps/web/src/lib/tracking/providers/registry.ts`
- `apps/web/src/lib/tracking/providers/snap.ts`
- `apps/web/src/lib/tracking/server/dispatcher.ts`

Constats:

- `snap` est un `TrackingProviderKind`.
- `tracking_providers` sait stocker `pixelId`, `capiToken`, `testEventCode`, `enabledEvents`.
- `snapAdapter` poste vers `https://tr.snapchat.com/v3/{pixelId}/events?access_token=...`.
- Le dispatcher autorise `snap` si `ad_storage === 'granted'`.
- Le dispatcher resout les mappings actifs pour `snap`.

Limites:

- `/api/track` ne transmet pas `identity` au `DispatchContext`.
- L'adapter Snap recoit souvent un `ctx.identity` vide.
- `event_id` est envoye cote CAPI, mais aucun Pixel Snap browser n'est genere par Plans pour partager le meme `client_deduplication_id`.
- Les parametres Snap attendus pour campagnes ecommerce/lead sont incomplets.

### Mappings et attribution

Fichiers:

- `apps/web/src/lib/tracking/providers/event-mapping.ts`
- `apps/web/src/lib/tracking/mappings/types.ts`
- `apps/web/src/lib/tracking/attribution/channel-detector.ts`
- `apps/web/src/lib/tracking/attribution/dispatch-gate.ts`

Constats:

- `MappingsByProvider` inclut `snap`.
- `channel-detector.ts` detecte le canal `snap` via `sccid` et UTM.
- `dispatch-gate.ts` mappe `snap` vers le canal `snap`.
- Mais `PROVIDER_TO_ATTRIBUTION_PROVIDER.snap = null`.
- `AttributionProvider = 'meta' | 'google_ads' | 'tiktok'`, sans `snap`.

Impact:

- Les conversions Snap ne sont jamais traitees comme primary.
- Un achat ou lead attribue a Meta/Google/TikTok ne sera pas bloque pour Snap par la logique actuelle, car Snap tombe en `non_primary_event`.
- La demande "envoyer les conversions Snapchat vers Snapchat uniquement" n'est donc pas satisfaite.

## Ecart avec les exigences Snap

### Pixel browser

Snap recommande d'installer le Pixel, de passer des donnees utilisateur lorsque possible, de fire au moins un event standard, et de passer `price`, `currency`, `transaction_id` pour `PURCHASE`.

Le code cible devra produire:

```js
snaptr('init', '<SNAP_PIXEL_ID>', {
  user_email: '<email-ou-hash-selon-politique>',
  user_phone_number: '<phone-ou-hash-selon-politique>'
});

snaptr('track', 'VIEW_CONTENT', {
  price: 399,
  currency: 'MAD',
  item_ids: ['sku-1'],
  item_category: 'kit',
  transaction_id: 'order-123',
  client_deduplication_id: '{{event_id}}',
  event_tag: 'femiglow',
  description: 'Kit FemiGlow',
  geo_city: 'Casablanca',
  geo_country: 'MA'
});
```

Note: l'exemple fourni dans la demande contient ` 'event_tag', 'INSERT_EVENT_TAG'`; dans un objet JavaScript valide il faut `event_tag: 'INSERT_EVENT_TAG'`.

### CAPI server-side

Snap CAPI v3 attend un endpoint de type:

```txt
POST https://tr.snapchat.com/v3/{PIXEL_ID}/events?access_token={TOKEN}
```

avec un body structure autour de `data[]`, `event_name`, `event_time`, `event_source_url`, `event_id`, `action_source`, `user_data`, `custom_data`.

Point important: Snap documente `event_id` comme identifiant de deduplication; si le Pixel est utilise, `event_id` doit correspondre au `client_dedup_id` de l'event client.

## Gaps prioritaires

| Priorite | Gap | Impact | Correction |
| --- | --- | --- | --- |
| P0 | `snap` absent de `PROVIDER_IDS` | UI Plans impossible | Ajouter provider de premier ordre |
| P0 | Seed canonique ignore `snap` | Les nouveaux plans perdent Snap | Mapper `snap -> snap` |
| P0 | Export GTM sans Snap | Aucun Pixel browser | Ajouter init + events `snaptr` |
| P0 | AttributionProvider sans Snap | Pas de "Snap uniquement" | Ajouter Snap primary gating |
| P0 | `lead_capture` sans Snap | Campagnes lead Snap cassées | Mapper vers `SIGN_UP` |
| P1 | `chat_lead_form_submit` utilise `LEAD` | Event probablement non standard | Remplacer/valider |
| P1 | `/api/track` ne transporte pas identity | Matching CAPI faible | Accepter/hydrater `user_data` |
| P1 | `ScCid` non gere en casse officielle | Attribution Snap perdue | Lire `ScCid` et `sccid` |
| P1 | Payload Snap incomplet | ROAS/matching faibles | Mapper ecommerce/lead complet |
| P2 | Erreurs Snap peu ergonomiques | Debug difficile | Logs + UI diagnostics provider |

## Plan de conception cible

### Principe produit

Snapchat doit devenir un provider public au meme niveau que Meta/TikTok dans Plans unifies:

- activable dans le wizard;
- configurable par environnement;
- selectionnable par event;
- exportable vers GTM;
- testable depuis l'admin;
- observable dans logs providers;
- compatible Pixel + CAPI + dedup.

### Separation des responsabilites

- **Plans**: declare quels providers/events/IDs doivent etre exportes.
- **Mappings**: declare comment un event canonique devient un event vendor.
- **Exporter GTM**: genere le Pixel browser et les triggers.
- **Dispatcher server**: envoie CAPI selon consentement, mapping et attribution.
- **Attribution**: decide quelles conversions primary vont vers quel provider.
- **Identity mapper**: transforme identity/ecommerce en champs vendor.

### Design data

Ajouter au `EnvConfig`:

```ts
snapPixelId?: string;
snapAdvancedMatching?: boolean;
snapEventMode?: 'pixel_only' | 'capi_only' | 'hybrid';
```

Ne pas ajouter le token CAPI dans `EnvConfig` exporte. Le token reste dans `tracking_providers.capiToken` cote serveur.

Normaliser les plans existants:

- s'ils n'ont pas `snap`, ajouter `{ id: 'snap', active: false }`;
- pour chaque event, completer `providers.snap = false` si absent;
- ne pas activer Snap automatiquement sur les plans actifs existants sans decision admin.

### Design UI/UX admin

Provider label:

- `Snapchat Pixel`
- hint: `Pixel + conversions Snapchat Ads. Requiert un Snap Pixel ID.`

Env step:

- champ `Snap Pixel ID`;
- validation souple mais utile: UUID Snap ou alphanumerique long si les IDs existants ne sont pas UUID;
- aide courte: "Le token CAPI reste cote serveur dans Providers, il n'est jamais exporte dans GTM."

Events step:

- colonne `Snap`;
- presets commerce/leads deja coches si catalogue le recommande;
- badge warning si `snap` actif mais `snapPixelId` absent;
- warning si mode `hybrid` mais provider server `snap` absent ou token manquant.

Diagnostics:

- `Snap Pixel ID manquant`;
- `Provider Snap CAPI non configure`;
- `Event primary Snap sans dedup event_id`;
- `Mapping Snap inconnu ou non standard`.

### Mapping event recommande

| Event canonique | Snap | Role |
| --- | --- | --- |
| `page_view` | `PAGE_VIEW` | audience |
| `view_item` | `VIEW_CONTENT` | audience |
| `add_to_cart` | `ADD_CART` | audience |
| `checkout_intent` | `START_CHECKOUT` | funnel |
| `add_payment_info` | `ADD_BILLING` | funnel |
| `lead_capture` | `SIGN_UP` | primary lead |
| `chat_lead_form_submit` | `SIGN_UP` ou `CUSTOM_EVENT_1` | primary lead si campagne chat |
| `purchase` | `PURCHASE` | primary sales |

Decision ouverte: `LEAD` est present dans le code, mais les listes officielles verifiees ne l'exposent pas comme event standard. Il faut le remplacer par `SIGN_UP` ou valider dans Snap Events Manager avant de le conserver.

## Plan de developpement detaille

### Phase 0 - Preparation dans le bon worktree

Commande:

```bash
cd /var/www/femiglow-leads-webhook-multi-step
git status --short
git branch --show-current
python manage.py check || true
pnpm --filter @femiglow/web test -- --runInBand || true
```

Objectifs:

- confirmer qu'on est dans `leads-webhook-multi-step`;
- confirmer `.env` et DB du worktree;
- lister les changements existants sans les revert;
- prendre un baseline tests/checks.

### Phase 1 - Modele Plans + migration douce

Fichiers probables:

- `apps/web/src/lib/tracking/plan/types.ts`
- `apps/web/src/lib/tracking/plan/canonical-seed.ts`
- `apps/web/src/lib/tracking/plan/service.ts`
- `apps/web/src/lib/tracking/plan/validator.ts`
- `apps/web/src/lib/tracking/plan/diagnostics.ts`

Actions:

1. Ajouter `snap` dans `PROVIDER_IDS`.
2. Ajouter `snapPixelId`, `snapAdvancedMatching`, `snapEventMode`.
3. Mapper `snap` dans `LEGACY_TO_V2`.
4. Ajouter provider Snap au seed canonique, actif selon catalogue ou inactif selon choix admin. Recommandation: provider global `active: false`, mais events catalogues conservent `providers.snap = true` si le provider est active plus tard.
5. Ajouter une normalisation defensive pour les plans existants.
6. Ajouter diagnostics.

Tests Vitest:

- schema accepte `snap`;
- ancien plan sans `snap` se normalise sans regression;
- seed conserve `snap`;
- diagnostics detecte Snap actif sans Pixel ID;
- validation refuse activation production si Snap actif et `snapPixelId` absent.

### Phase 2 - UI/UX Plans

Fichiers probables:

- `StepProviders.tsx`
- `StepEnvProfiles.tsx`
- `StepEvents.tsx`
- `StepReview.tsx`
- `EventMatrixRow.tsx` si hypothese de colonnes hardcodees

Actions:

1. Ajouter carte Snapchat.
2. Ajouter champ Pixel ID.
3. Ajouter colonne Snap.
4. Ajouter Snap dans sync catalogue.
5. Ajouter microcopy sur CAPI token cote serveur.
6. Ajouter warnings propres dans review.

Tests:

- render `StepProviders`: Snapchat visible et toggle fonctionnel;
- render `StepEnvProfiles`: champ Snap visible si actif;
- render `StepEvents`: colonne Snap visible et sync catalogue conserve Snap;
- test a11y minimal: label associe au champ Pixel ID.

### Phase 3 - Mapping vendor + attribution

Fichiers probables:

- `providers/event-mapping.ts`
- `attribution/dispatch-gate.ts`
- `attribution/channel-detector.ts`
- tests associes

Actions:

1. Etendre `AttributionProvider` avec `snap`.
2. Ajouter `SNAP_PRIMARY_NAMES = new Set(['PURCHASE', 'SIGN_UP'])`.
3. Mapper `snap` dans `PROVIDER_TO_ATTRIBUTION_PROVIDER`.
4. Ajouter `lead_capture.snap = { name: 'SIGN_UP', isStandard: true }`.
5. Remplacer ou feature-flag `chat_lead_form_submit.snap = 'LEAD'`.
6. Detecter `ScCid` et `sccid`.

Tests Vitest:

- `getAttributionMode('purchase', 'snap') === 'primary'`;
- `getAttributionMode('lead_capture', 'snap') === 'primary'`;
- `getAttributionMode('checkout_intent', 'snap') === 'broadcast'`;
- gate skip Snap quand resolved channel `meta` pour purchase;
- gate allow Snap quand resolved channel `snap`, `direct`, `organic`, `broadcast`;
- channel detector supporte `ScCid` et `sccid`.

### Phase 4 - Export GTM Snap

Fichier principal:

- `apps/web/src/lib/tracking/plan/exporter.ts`

Actions:

1. Ajouter `idVars.snap`.
2. Ajouter `SNAP_INIT_NAME = 'Snap Init'`.
3. Ajouter tag init HTML ou template GTM Snap.
4. Ajouter mapper params Snap:
   - `price` depuis `value` ou item price;
   - `currency`;
   - `item_ids` depuis `items[].item_id`;
   - `item_category` depuis premier item;
   - `transaction_id`;
   - `client_deduplication_id` depuis `event_id`;
   - `event_tag`, `description` si presents;
   - `geo_city`, `geo_country`, `geo_region`;
   - identity user fields selon consent.
5. Ajouter DLV necessaires.
6. Ajouter tags `Snap Evt - ...`.
7. Ajouter attribution trigger provider `snap`.

Tests Vitest:

- export contient `CONST - Snap Pixel ID`;
- export contient `Snap Init`;
- export contient `snaptr('track', 'VIEW_CONTENT'...)`;
- purchase Snap contient `transaction_id`, `currency`, `price`, `client_deduplication_id`;
- lead_capture utilise trigger attribution Snap;
- events broadcast utilisent trigger normal;
- export reste deterministe au hash.

### Phase 5 - Server CAPI Snap robuste

Fichiers probables:

- `providers/snap.ts`
- `providers/types.ts`
- `app/api/track/route.ts`
- `tracking/schemas.ts`
- `server/dispatcher.ts`
- `server/enricher.ts`

Actions:

1. Corriger `action_source` vers `WEB` si Snap le requiert en uppercase.
2. Garder `event_id` = event id client.
3. Accepter ou reconstruire `identity`.
4. Mapper `user_data` correctement.
5. Propager `ScCid` depuis attribution snapshot ou params.
6. Mapper `custom_data` complet.
7. Ajouter endpoint validate en mode test admin si utile.
8. Journaliser `lastError`, `errorCount24h`, `lastEventAt`.

Tests MSW/Vitest:

- mock endpoint Snap v3 success;
- mock 400 validate;
- mock 401 token invalid;
- verify body `data[0]`;
- verify identity hash;
- verify `sc_click_id`;
- verify skip consent;
- verify skip missing token/pixel.

### Phase 6 - Checkout data contract

Fichiers probables:

- `checkout-events.ts`
- `use-wizard-mutations.ts`
- `CheckoutFlow.tsx`
- `MerciClient.tsx`
- `schemas.ts`

Actions:

1. Ajouter les donnees manquantes pour Snap sans casser GA4/Meta:
   - ville reelle ou `geo_city`;
   - country;
   - item category;
   - event tag;
   - description produit;
   - phone/email selon consent.
2. Eviter de mettre de la PII dans `params` si `user_data` est le canal dedie.
3. S'assurer que `/api/track` n'est pas strictement incompatible avec `user_data`.

Tests:

- builder `lead_capture` peut hydrater Snap identity;
- builder `address_completed` expose city utilisable;
- endpoint `/api/track` accepte un event avec `user_data` ou le nettoie proprement;
- aucun event existant n'est rejete par regression.

### Phase 7 - Observabilite et admin debug

Actions:

1. Afficher l'etat Snap dans analytics providers.
2. Ajouter erreurs Snap lisibles.
3. Ajouter un bouton test Snap qui utilise `/events/validate`.
4. Ajouter un panneau dedup: dernier `event_id`, Pixel/CAPI.

Tests:

- UI affiche `failed` proprement;
- MSW simule erreur Snap et l'admin voit le message;
- logs structurés contiennent provider, event, status, httpStatus.

### Phase 8 - E2E Playwright

Scenarios:

1. Admin cree/edite un plan avec Snapchat actif.
2. Admin renseigne Pixel ID.
3. Admin active `view_item`, `lead_capture`, `purchase` pour Snap.
4. Export GTM contient Snap.
5. Storefront: consent granted, ouvrir produit => `VIEW_CONTENT`.
6. Storefront: commencer checkout => `START_CHECKOUT`.
7. Storefront: creer lead => `SIGN_UP`.
8. Avec attribution Meta, purchase Snap primary est absent/skipped.
9. Avec attribution Snap, purchase Snap primary est present.

## Runbook d'execution

### 1. Se placer dans le bon worktree

```bash
cd /var/www/femiglow-leads-webhook-multi-step
git status --short
git branch --show-current
```

Attendu:

- branche `leads-webhook-multi-step`;
- ne pas utiliser `/var/www/femiglow` `master`.

### 2. Baseline

```bash
python manage.py check
pnpm --filter @femiglow/web test -- --run
pnpm --filter @femiglow/web exec playwright test --list
```

Si un test baseline est deja rouge, noter l'erreur avant modifications.

### 3. Implementer Phase 1 + tests

```bash
pnpm --filter @femiglow/web test -- apps/web/src/lib/tracking/plan --run
```

Critere: schemas/seed/validator OK.

### 4. Implementer Phase 2 + tests UI

```bash
pnpm --filter @femiglow/web test -- apps/web/src/components/admin/tracking/plans --run
```

Critere: wizard Plans affiche et persiste Snap.

### 5. Implementer Phase 3 + tests attribution

```bash
pnpm --filter @femiglow/web test -- apps/web/src/lib/tracking/attribution apps/web/src/lib/tracking/providers --run
```

Critere: Snap primary gate correct.

### 6. Implementer Phase 4 + tests exporter

```bash
pnpm --filter @femiglow/web test -- apps/web/src/lib/tracking/plan/__tests__/exporter.test.ts --run
```

Critere: export GTM Snap present, stable, importable.

### 7. Implementer Phase 5 + tests MSW

```bash
pnpm --filter @femiglow/web test -- apps/web/src/lib/tracking/providers/snap.test.ts apps/web/src/app/api/track/route.test.ts --run
```

Critere: CAPI Snap success/failure/skip couverts.

### 8. Lancer E2E

```bash
pnpm --filter @femiglow/web exec playwright test tests/playwright/tracking --workers=1
```

Critere: scenarios admin + storefront passent.

### 9. Validation locale complete

```bash
python manage.py check
pnpm --filter @femiglow/web lint
pnpm --filter @femiglow/web test -- --run
pnpm --filter @femiglow/web build
```

### 10. Validation staging Snap

1. Configurer Pixel ID Snap dans Plans.
2. Configurer provider server `snap` avec token CAPI dans admin Providers.
3. Activer mode test/validate.
4. Declencher `view_item`, `lead_capture`, `purchase`.
5. Verifier Snap Pixel Helper.
6. Verifier Snap Events Manager.
7. Verifier logs FemiGlow `providersResults.snap`.

## Definition of Done

- Snapchat est visible dans Plans unifies.
- Un plan peut activer Snap par event.
- L'export GTM contient Snap init + tags events.
- Pixel et CAPI partagent le meme identifiant de dedup.
- `lead_capture` et `purchase` sont primary-gated pour Snap.
- `view_item`, `add_to_cart`, `checkout_intent` restent broadcast.
- CAPI Snap envoie un payload complet, teste par MSW.
- Les erreurs Snap sont debuggables dans l'admin/logs.
- Vitest, MSW, Playwright, build passent dans `/var/www/femiglow-leads-webhook-multi-step`.
- Aucune modification destructive n'est faite sur `master`.
