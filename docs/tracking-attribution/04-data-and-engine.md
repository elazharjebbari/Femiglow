# 4. Modèle de données + moteur d'attribution

## Schema BDD

### Table `visitor_attribution`

```sql
CREATE TABLE IF NOT EXISTS visitor_attribution (
  visitor_id      TEXT PRIMARY KEY,
  first_touch     JSONB NOT NULL,
  last_touch      JSONB NOT NULL,
  paid_history    JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_va_updated_at
  ON visitor_attribution(updated_at);
```

### Format JSONB de chaque touch

```ts
{
  channel: 'google_ads',           // AttributionChannel
  is_paid: true,
  click_id: 'EAIaIQobChMIz_…',
  click_id_field: 'gclid',
  utm: {
    source: 'google',
    medium: 'cpc',
    campaign: 'maroc_femiglow_brand',
    content: 'kit_v2_video',
    term: undefined
  },
  referrer: 'https://www.google.com/aclk?sa=l&ai=…',
  landing_path: '/kit',
  detected_at: '2026-05-15T10:30:00.000Z'
}
```

### Setting `attribution.strategy`

```sql
-- table tracking_settings existante
key: 'attribution.strategy'
value: '"last_paid_touch"'  -- défaut

-- Valeurs possibles :
--   "last_paid_touch"  (⭐ recommandé)
--   "first_paid_touch"
--   "last_touch"
--   "first_touch"
--   "broadcast"  (déconseillé : tous les pixels comptent)
```

## Moteur d'attribution

### Détection canal (priorité)

```ts
function detectChannel(input: { url: URL; referrer?: string }): ChannelTouch {
  const params = input.url.searchParams;

  // 1. Click IDs (preuve absolue d'un clic payant)
  if (params.get('gclid') || params.get('gbraid') || params.get('wbraid')) {
    return { channel: 'google_ads', is_paid: true,
             click_id: params.get('gclid') ?? params.get('gbraid') ?? params.get('wbraid'),
             click_id_field: 'gclid', /* … */ };
  }
  if (params.get('fbclid')) {
    return { channel: 'meta', is_paid: true,
             click_id: params.get('fbclid'), click_id_field: 'fbclid', /* … */ };
  }
  if (params.get('ttclid')) { /* tiktok */ }
  if (params.get('sccid'))  { /* snap */ }
  if (params.get('epik'))   { /* pinterest */ }
  if (params.get('msclkid')){ /* bing_ads */ }

  // 2. UTM (canal payant déclaré)
  const utmSource = (params.get('utm_source') ?? '').toLowerCase();
  const utmMedium = (params.get('utm_medium') ?? '').toLowerCase();
  const isPaidMedium = /^(cpc|ppc|paid|cpv|cpa|cpm|display|social_paid)$/.test(utmMedium);

  if (isPaidMedium) {
    if (/google/.test(utmSource))         return paid('google_ads', utm);
    if (/facebook|fb|meta|instagram|ig/.test(utmSource)) return paid('meta', utm);
    if (/tiktok/.test(utmSource))         return paid('tiktok', utm);
    if (/snap/.test(utmSource))           return paid('snap', utm);
    if (/pinterest/.test(utmSource))      return paid('pinterest', utm);
    if (/bing|microsoft/.test(utmSource)) return paid('bing_ads', utm);
  }

  // 3. UTM email
  if (utmMedium === 'email' || utmSource === 'newsletter') {
    return { channel: 'email', is_paid: false, utm, /* … */ };
  }

  // 4. Referrer
  if (input.referrer) {
    const ref = new URL(input.referrer);
    if (/google\.|bing\.|duckduckgo\./.test(ref.host)) {
      return { channel: 'organic', is_paid: false, referrer, /* … */ };
    }
    if (/facebook|instagram|tiktok|snap|pinterest/.test(ref.host)) {
      return { channel: 'social_organic', is_paid: false, referrer, /* … */ };
    }
  }

  // 5. Default
  return { channel: 'direct', is_paid: false, /* … */ };
}
```

### Stratégies d'attribution

```ts
function applyStrategy(
  snap: AttributionSnapshot,
  strategy: AttributionStrategy,
): AttributedChannel {
  switch (strategy) {
    case 'last_paid_touch': {
      const t = snap.paid_history[0];
      if (t) return { channel: t.channel, is_paid: true, reason: `last_paid_touch:${t.click_id_field}` };
      return { channel: 'direct', is_paid: false, reason: 'no_paid_touch_in_history' };
    }
    case 'first_paid_touch': {
      const t = snap.paid_history[snap.paid_history.length - 1];
      if (t) return { channel: t.channel, is_paid: true, reason: `first_paid_touch:${t.click_id_field}` };
      return { channel: 'direct', is_paid: false, reason: 'no_paid_touch_in_history' };
    }
    case 'last_touch':
      return { channel: snap.last_touch?.channel ?? 'direct', is_paid: snap.last_touch?.is_paid ?? false, reason: 'last_touch' };
    case 'first_touch':
      return { channel: snap.first_touch?.channel ?? 'direct', is_paid: snap.first_touch?.is_paid ?? false, reason: 'first_touch' };
    case 'broadcast':
      return { channel: 'broadcast', is_paid: false, reason: 'broadcast_strategy' };
  }
}
```

### Sémantique « direct + organic »

Quand l'attribution résout `channel = 'direct'` (ou `'organic'`,
`'email'`, `'social_organic'`), **aucun pixel publicitaire ne devrait
fire la conversion** (logique stricte). Mais en pratique on veut donner
une chance à Google Ads de capter ce visiteur (cas où il avait cliqué
avant que ITP purge le cookie).

**Politique par défaut** (configurable) :

| Canal attribué | GA4 | Meta | Ads | TikTok |
|---|:---:|:---:|:---:|:---:|
| `google_ads` | ✓ | ✗ | ✓ | ✗ |
| `meta` | ✓ | ✓ | ✗ | ✗ |
| `tiktok` | ✓ | ✗ | ✗ | ✓ |
| `direct` | ✓ | ✓ | ✓ | ✓ |
| `organic` | ✓ | ✓ | ✓ | ✓ |
| `email` | ✓ | ✗ | ✗ | ✗ |
| `broadcast` | ✓ | ✓ | ✓ | ✓ |

(les conversions GA4 ne sont pas affectées par l'attribution, GA4 ayant
son propre modèle data-driven côté Google Analytics)

Pour le `direct`/`organic` on adopte le **broadcast partiel** (tous les
pixels paid fire) — meilleure réconciliation côté Meta/Ads quand ITP a
purgé le cookie de clic. La condition GTM est donc :

```
attribution.channel IN [<provider_canonique>, 'direct', 'organic']
```

## Côté GTM : implémentation conditionnelle

L'exporter génère pour chaque tag de conversion (Meta / Ads / TikTok)
une condition appliquée via `customEventFilter` étendu, ou via un
**Trigger Group** combiné. Détails dans `06-runbook.md`.

Format dataLayer émis par le client :

```js
window.dataLayer.push({
  event: 'purchase',
  event_id: '...',
  ecommerce: { transaction_id, value, currency, items },
  user_data: { sha256_email_address, ... },
  attribution: {
    channel: 'google_ads',         // ⭐ utilisé par la condition GTM
    is_paid: true,
    strategy: 'last_paid_touch',
    click_id: 'EAIaIQ...',
    click_id_field: 'gclid',
    reason: 'last_paid_touch:gclid'
  }
});
```

DLV à exposer dans GTM :
- `DLV - attribution.channel`
- `DLV - attribution.click_id`
- `DLV - attribution.is_paid`
- `DLV - attribution.strategy`

L'exporter les génère automatiquement (idempotent).
