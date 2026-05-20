# 3. Architecture cible (approche C hybride — phase 1)

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│                        VISITEUR FEMIGLOW                             │
│                                                                      │
│  URL: femiglow-maroc.com/?gclid=abc123&utm_source=google&...         │
│       Référent: google.com/aclk?sa=...                               │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ╭─────────────────╮   ╭────────────────────╮                        │
│  │ AttributionCap- │   │  TrackingClient    │                        │
│  │  tureBridge     │   │  .emit(event,...)  │                        │
│  │  (client mount) │   │                    │                        │
│  ╰────────┬────────╯   ╰─────────┬──────────╯                        │
│           │                      │                                   │
│           │ détecte channel      │ lit cookie fg_attr                │
│           │ écrit cookie fg_attr │ + applique stratégie              │
│           │ POST /api/track/attr │                                   │
│           │                      │ ajoute attribution{} au payload   │
│           ▼                      ▼                                   │
│  ╭─────────────────╮   ╭────────────────────╮                        │
│  │ Cookie fg_attr  │   │  dataLayer.push({  │                        │
│  │  first_touch    │   │    event: '…',     │                        │
│  │  last_touch     │   │    user_data: {…}, │                        │
│  │  paid_history[] │   │    attribution: {  │                        │
│  ╰─────────────────╯   │      channel,      │                        │
│                        │      click_id,     │                        │
│  ╭─────────────────╮   │      strategy,     │                        │
│  │ visitor_attribu │   │      is_paid       │                        │
│  │  tion (DB)      │   │    }               │                        │
│  │  Source de v.   │   │  })                │                        │
│  │  cross-session  │   ╰─────────┬──────────╯                        │
│  ╰─────────────────╯             │                                   │
│                                  ▼                                   │
└──────────────────────────────────┼───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       GTM CONTAINER (côté navigateur)                │
│                                                                      │
│  ┌─ TRIGGER : CustomEvent purchase ────────────────────────────────┐ │
│  │  arg1 = 'purchase'                                              │ │
│  └────────┬────────────────────────────────────────────────────────┘ │
│           │                                                          │
│           ├─→ TAG GA4 Evt purchase           (toujours fire)         │
│           │                                                          │
│           ├─→ TAG Meta Pixel Purchase                                │
│           │     condition: {{DLV - attribution.channel}}             │
│           │       IN ['meta','direct','organic']                     │
│           │                                                          │
│           ├─→ TAG Ads Conv purchase                                  │
│           │     condition: {{DLV - attribution.channel}}             │
│           │       IN ['google_ads','direct','organic']               │
│           │                                                          │
│           └─→ TAG TikTok Purchase                                    │
│                 condition: {{DLV - attribution.channel}}             │
│                   IN ['tiktok','direct','organic']                   │
└──────────────────────────────────────────────────────────────────────┘
```

## Composants à créer

### 1. `lib/tracking/attribution/channel-detector.ts`

Pure function : transforme une `URL` + `document.referrer` → un `ChannelTouch`.

```ts
interface ChannelTouch {
  channel: AttributionChannel;       // 'google_ads' | 'meta' | … | 'direct'
  is_paid: boolean;                  // true si canal payant
  click_id?: string;                 // gclid/fbclid/ttclid…
  click_id_field?: 'gclid' | 'fbclid' | 'ttclid' | 'sccid' | 'epik' | 'msclkid' | 'gbraid' | 'wbraid';
  utm?: { source?, medium?, campaign?, term?, content? };
  referrer?: string;
  detected_at: ISO8601;
}

type AttributionChannel =
  | 'google_ads'
  | 'meta'
  | 'tiktok'
  | 'snap'
  | 'pinterest'
  | 'bing_ads'
  | 'email'
  | 'organic'           // SEO
  | 'social_organic'    // FB/IG/TT sans ?fbclid
  | 'direct';

function detectChannel(input: {
  url: string | URL;
  referrer?: string;
}): ChannelTouch;
```

### 2. `lib/tracking/attribution/strategy.ts`

Stratégie qui mange un `AttributionSnapshot` → renvoie `AttributedChannel`.

```ts
type AttributionStrategy =
  | 'last_paid_touch'   // ⭐ par défaut
  | 'first_paid_touch'
  | 'last_touch'
  | 'first_touch'
  | 'broadcast';        // tous les pixels (déconseillé)

interface AttributionSnapshot {
  first_touch: ChannelTouch | null;
  last_touch: ChannelTouch | null;
  paid_history: ChannelTouch[];      // tous les paid touches ordered desc
  fallback?: 'direct' | 'broadcast';
}

interface AttributedChannel {
  channel: AttributionChannel | 'broadcast';
  is_paid: boolean;
  reason: string;                    // pour debug : "last_paid_touch matched gclid…"
}

function applyStrategy(
  snapshot: AttributionSnapshot,
  strategy: AttributionStrategy,
): AttributedChannel;
```

### 3. `lib/db/schema-tracking.ts` extension

```sql
CREATE TABLE visitor_attribution (
  visitor_id      TEXT PRIMARY KEY,
  first_touch     JSONB NOT NULL,
  last_touch      JSONB NOT NULL,
  paid_history    JSONB NOT NULL DEFAULT '[]',  -- limit 20 entries
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_va_updated ON visitor_attribution(updated_at);
```

`paid_history` est tronqué à 20 entrées (LRU). Suffisant pour 99% des cas.

### 4. `app/api/track/attribution/route.ts`

Endpoint POST appelé par `AttributionCaptureBridge` au landing :

```
POST /api/track/attribution
{
  visitor_id: 'v_abc',
  session_id: 's_xyz',
  touch: <ChannelTouch>
}

→ upsert visitor_attribution :
   - first_touch : preserved (insert only si nouveau)
   - last_touch : updated avec le current touch
   - paid_history : prepend si is_paid, dedup par click_id
```

### 5. `components/tracking/AttributionCaptureBridge.tsx`

Client component, monté dans `TrackingProvider` :

- Au mount, parse `window.location` + `document.referrer`
- Appelle `detectChannel` → obtient `ChannelTouch`
- Si différent du `last_touch` en cookie → POST `/api/track/attribution`
- Met à jour le cookie `fg_attr` (httpOnly false, sameSite Lax, 90j)

### 6. `lib/tracking/client.ts` extension

`TrackingClient.emit()` annote chaque event avec :

```ts
entry.attribution = {
  channel: '<attributed>',    // résultat de applyStrategy
  is_paid: <bool>,
  strategy: '<active>',
  click_id: '<gclid>',        // copy-paste du touch attribué
  click_id_field: '<gclid>',
  utm: <copy>,
}
```

L'attribution est lue depuis le cookie `fg_attr` (sync) ou depuis le
contexte React (async pour la première fois).

### 7. `lib/tracking/plan/exporter.ts` extension

Pour les events de conversion (cf. `event-mapping.ts` → `google_ads.conversionLabelKey` ou Meta std event), l'exporter ajoute un filter au trigger CustomEvent :

```ts
{
  triggerId: …,
  name: 'CE — purchase + meta-attributed',
  type: 'CUSTOM_EVENT',
  customEventFilter: [
    { type: 'EQUALS', parameter: [arg0='_event', arg1='purchase'] },
    // Nouvelle condition d'attribution
    { type: 'CONTAINS', parameter: [
        arg0='{{DLV - attribution.channel}}',
        arg1='meta,direct,organic'
    ]}
  ]
}
```

Ou plus propre — un trigger CustomEvent générique + une **filter group**
par tag (pas par trigger). Détails dans `04-data-and-engine.md`.

### 8. Admin UI : `app/admin/tracking/attribution/page.tsx`

Page settings + debugger :
- **Stratégie** (radio buttons) avec `last_paid_touch` recommandée
- **Override par event** (table : events conversion / audience / les deux)
- **Debugger** : input visitor_id → affiche le snapshot + le canal attribué

### 9. Settings storage

Stockée dans `tracking_settings` (table existante) sous la clé
`attribution.strategy` :

```sql
INSERT INTO tracking_settings (key, value) VALUES
  ('attribution.strategy', '"last_paid_touch"');
```

## Gating per-provider : primary vs broadcast (refactor 2026-05-15)

### Le problème de l'ancien modèle

Le système initial utilisait un flag binaire **global** `isConversion: true`
dans `event-catalog.ts`. Tous les events marqués conversion étaient
attribution-gated pour **tous** les providers payants (Meta, Ads, TikTok).

Limite : Google Ads et Meta ont une distinction primary/secondary
réelle dans leur UI de conversions. `checkout_intent` est **secondaire**
côté Google Ads (`BEGIN_CHECKOUT`, observation/learning) et **non-primary**
côté Meta (`InitiateCheckout` est funnel/intent, pas Purchase/Lead).
Le gater uniformément privait Smart Bidding et Advantage+ d'un signal
volumique qu'on souhaite max.

### Le modèle actuel

Chaque couple `(eventKey, provider)` est classé en deux modes via
`getAttributionMode(eventKey, provider)` dans
`lib/tracking/providers/event-mapping.ts` :

| Mode        | Comportement                                                                                      | Quand                                                       |
|-------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| `primary`   | Attribution-gated. Trigger CUSTOM_EVENT + filter MATCH_REGEX sur `{{DLV - attribution.channel}}` | Réservé aux conv pilotant le bidding (Purchase, Lead)       |
| `broadcast` | Trigger standard, fire sur tous les canaux                                                       | Audience events + secondary conversions (volume max)        |

#### Source de vérité par provider

| Provider       | `primary` si…                                                                              | Exemples primary                                                                 |
|----------------|--------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| **google_ads** | `event-mapping.ts.google_ads.recommendedRole === 'primary'` (= rôle Principale dans Google Ads UI) | purchase, lead_capture, generate_lead, contact_submit, chat_message_sent         |
| **meta**       | Meta event name ∈ `{ Purchase, Lead }`                                                     | purchase, lead_capture, generate_lead, chat_lead_form_submit                     |
| **tiktok**     | TikTok event name ∈ `{ CompletePayment, SubmitForm }`                                      | purchase, generate_lead                                                          |

Cas inconnus ou non-mappés → `broadcast` (safety default, on ne bloque
jamais un signal par accident).

#### Matrice par event (extrait — cf. event-mapping.ts pour la liste complète)

| Event canonique     | Ads    | Meta       | TikTok     | Effet GTM                                              |
|---------------------|--------|------------|------------|--------------------------------------------------------|
| `purchase`          | primary | primary   | primary    | Tous gated (Purchase/Purchase/CompletePayment)         |
| `lead_capture`      | primary | primary   | primary    | Tous gated (Lead/Lead/SubmitForm)                      |
| `checkout_intent`   | broadcast | broadcast | broadcast | Aucun gating — fire partout (funnel/intent)            |
| `add_to_cart`       | broadcast | broadcast | broadcast | Fire partout (audience + secondary Ads)                |
| `sign_up`           | broadcast | broadcast | broadcast | Fire partout (UI Ads = Secondaire, Meta non-primary)   |
| `add_payment_info`  | broadcast | broadcast | broadcast | Audience pure                                          |
| `view_item`         | broadcast | broadcast | broadcast | Audience pure                                          |
| `chat_message_sent` | primary | broadcast  | broadcast  | Ads gated uniquement (rôle Principale UI Ads CONTACT)  |

#### Bénéfices du modèle per-provider

1. **Bidding propre côté primary** : Smart Bidding (Ads) et Advantage+
   (Meta) ne voient que les conversions attribuées à leur canal → pas
   de double-comptage cross-provider qui skewerait l'algo.

2. **Volume max côté secondary/audience** : `add_to_cart`,
   `checkout_intent`, `sign_up` etc. fire sur **tous les canaux** —
   alimente Smart Bidding (observation) et Custom Audiences (Meta
   Lookalike, TikTok similar) avec le volume complet du trafic.

3. **Cohérence Google Ads UI ↔ code** : le mapping
   `event-mapping.ts.google_ads.recommendedRole` doit refléter le rôle
   configuré dans Google Ads UI (Principale / Secondaire). Sinon
   mismatch entre ce que GTM fire et ce que Google Ads compte → audit
   chartré.

#### Phase 2 (server CAPI) — symétrie

`lib/tracking/attribution/dispatch-gate.ts` applique la **même logique** :
`isPrimaryConversionFor(providerKind, eventName)` route via
`getAttributionMode`. Les events non-primary pour le provider cible
passent le gate avec `reason: 'non_primary_event'` (vs l'ancien
`audience_event` qui collapsait deux concepts).

### Comment ajuster

- **Ajouter un event** comme conversion primary Google Ads : remplir
  `google_ads.recommendedRole = 'primary'` dans `event-mapping.ts`
  ET configurer la conv en Principale dans Google Ads UI.
- **Repasser un event en secondary** : descendre `recommendedRole` à
  `'secondary'` côté code ET côté UI Google Ads.
- **Étendre la matrice Meta primary** : ajouter le Meta event name
  dans `META_PRIMARY_NAMES` (event-mapping.ts). À utiliser avec
  parcimonie — chaque ajout réduit le volume signal de cet event.

## Non-objectifs (phase 1)

- ❌ Server-side dispatch Google Ads OCI / TikTok Events API
- ❌ ML-based attribution data-driven
- ❌ Cross-device attribution (besoin user_id stable)
- ❌ Modification du Meta CAPI dispatcher (sera phase 2)

## Sécurité & privacy

- L'attribution N'EST PAS de la PII en soi (le click_id est anonyme)
- Le cookie `fg_attr` est first-party, durée 90j, `SameSite=Lax`
- Aucun envoi si `analytics_storage === 'denied'` (Consent Mode v2 gate)
- L'attribution server-side est purgée après 90j (cron de purge)
