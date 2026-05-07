# 01 — Architecture

## 1. Vue d'ensemble

```
┌────────────────────── Browser ────────────────────────┐
│                                                        │
│  Page (Server Component)                               │
│   └─ <TrackingProvider config> (Client)                │
│       ├─ window.femiglowDataLayer = []                 │
│       ├─ ConsentGate                                   │
│       ├─ <PageViewEmitter>                             │
│       └─ <Component data-track="cta_click" …>          │
│            └─ useTracking().emit(event, params)        │
│                                                        │
│  Pixels (chargés conditionnellement après consent)     │
│   ├─ Meta Pixel (fbq)                                  │
│   ├─ TikTok Pixel (ttq)                                │
│   ├─ Google gtag (Ads + GA4)                           │
│   ├─ Snap (snaptr)                                     │
│   └─ Pinterest (pintrk)                                │
│                                                        │
└────────────────────────┬───────────────────────────────┘
                         │  POST /api/track (batch, beacon)
                         ▼
┌──────────────────── Next.js API ────────────────────────┐
│                                                          │
│  /api/track            (public, rate-limited)            │
│   ├─ Zod validate                                        │
│   ├─ enrich (geo, ua hash, ip anonym)                    │
│   ├─ dedupe (event_id LRU)                               │
│   ├─ persist tracking_events_log (async via queue)       │
│   └─ dispatch CAPI providers (server-side)               │
│                                                          │
│  /api/admin/tracking/* (auth, iron-session)              │
│   ├─ inventory.list                                      │
│   ├─ pages.* / components.* (config CRUD)                │
│   ├─ providers.*                                         │
│   ├─ events.log (timeline)                               │
│   └─ test.dispatch (dry-run)                             │
│                                                          │
└──────────────────────────┬───────────────────────────────┘
                           ▼
┌──────────────────── Postgres (Neon) ────────────────────┐
│  tracking_pages, tracking_components, tracking_events_*  │
│  tracking_providers, tracking_consent_snapshots          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
                    Cron (Vercel) :
                    purge events > 13 mois,
                    aggregat KPI quotidien
```

## 2. Composants logiques

### 2.1 Inventaire (build-time + runtime)

Un script `scripts/scan-tracking-inventory.ts` parse `src/app/**/page.tsx`
et `src/components/**/*.tsx` pour générer un manifeste JSON :

```json
{
  "pages": [
    { "id": "p_home", "route": "/", "title": "Accueil",
      "components": ["Hero", "GestesGrid", "Manifeste", ...] }
  ],
  "components": [
    { "id": "c_hero", "name": "Hero", "category": "section_hero",
      "path": "src/components/sections/Hero.tsx",
      "applicable_events": ["view_promotion", "select_promotion"] }
  ]
}
```

Le manifeste est commité (`apps/web/src/lib/tracking/inventory.generated.json`)
et lu par la console admin pour afficher l'arbre. Un seed initial peuple
`tracking_pages` et `tracking_components`. Ensuite, un check CI compare
le manifeste actuel à la BDD pour détecter les drifts.

### 2.2 DataLayer (client)

Singleton attaché à `window` :

```ts
window.femiglowDataLayer = window.femiglowDataLayer ?? [];
```

API publique :

```ts
femiglowDataLayer.push(event: TrackingEvent);
```

Compatible **GTM** : si la fondatrice ajoute GTM via "code custom",
elle peut renommer le datalayer en `dataLayer` (alias) et tout
fonctionne nativement.

### 2.3 TrackingProvider (React)

Wrapper côté client (mounted dans `app/layout.tsx`) qui :

1. lit la config (depuis le serveur, RSC fetch),
2. expose un Context `TrackingContext` ;
3. émet `page_view` au mount + à chaque changement de route ;
4. monte `<ConsentBanner>` si pas de consent ;
5. charge les scripts pixels après consent (`<Script strategy="lazyOnload">`).

### 2.4 Hook `useTracking()`

```ts
const { emit, isEnabled, getEventConfig } = useTracking();
emit('add_to_cart', { item_id: 'kit', value: 3900, currency: 'EUR' });
```

`emit()` :
- vérifie `isEnabled(componentId, eventName)`,
- valide le payload contre le schéma Zod de l'event,
- déduplique (LRU 100 entrées, TTL 5 s),
- push au datalayer + appel `fetch('/api/track', {keepalive: true})`,
- catch toute erreur → logger.warn (jamais throw).

### 2.5 API ingestion `/api/track`

POST batch de 1..50 events. Retourne `204` (fire-and-forget côté
client). Validation, enrichissement, persistance, dispatch CAPI.

### 2.6 Console admin

Section `/admin/tracking` avec sous-routes :

```
/admin/tracking            → dashboard (KPIs)
/admin/tracking/inventory  → arbre pages × composants
/admin/tracking/components/[id] → éditeur composant
/admin/tracking/providers  → liste pixels
/admin/tracking/providers/[id]  → éditeur pixel
/admin/tracking/events     → timeline log
/admin/tracking/test       → testeur (envoyer event de test)
/admin/tracking/settings   → config globale (consent text, env)
```

## 3. Séquence — Émission d'un event

```
Utilisateur clique "Ajouter au panier"
    │
    ▼
<AddToCartButton onClick={…}>
    │  emit('add_to_cart', {item_id, value, currency, items[]})
    ▼
useTracking().emit
    │  ├─ getEventConfig('add_to_cart') → { enabled, params, providers }
    │  ├─ Zod validate
    │  ├─ dedupCache.has(event_id)? skip : add
    │  ├─ window.femiglowDataLayer.push(event)
    │  └─ navigator.sendBeacon('/api/track', JSON.stringify([event]))
    │
    ▼ (parallèle, async)
Pixels client (si consent ok)
    ├─ fbq('track', 'AddToCart', {value, currency, content_ids:[…]}, {eventID})
    ├─ ttq.track('AddToCart', {…}, {event_id})
    ├─ gtag('event', 'add_to_cart', {value, currency, items})
    ├─ snaptr('track', 'ADD_CART', {…})
    └─ pintrk('track', 'addtocart', {…})
    │
    ▼
/api/track (server)
    ├─ Zod validate
    ├─ enrich (ua_hash, ip_anon, geo si header CF)
    ├─ persist tracking_events_log
    ├─ dispatch CAPI :
    │   ├─ Meta CAPI POST graph.facebook.com/events
    │   └─ TikTok Events API POST business-api.tiktok.com
    │
    └─ 204 No Content
```

## 4. Modèle d'événement (canonique)

```ts
interface TrackingEvent {
  schema_version: 1;
  event: string;                  // GA4 name
  event_id: string;               // UUID v7 (déduplication)
  timestamp: string;              // ISO 8601
  consent: {
    ad_storage: 'granted' | 'denied';
    analytics_storage: 'granted' | 'denied';
    ad_user_data: 'granted' | 'denied';
    ad_personalization: 'granted' | 'denied';
  };
  page: {
    url: string;
    path: string;
    title: string;
    referrer: string | null;
    locale: string;
  };
  user: {
    anonymous_id: string;         // 1st-party cookie 13 mois
    session_id: string;           // sliding 30min
    user_id: string | null;       // si lead identifié
    email_sha256: string | null;  // si consent + identifié
  };
  source: {
    component_id: string | null;  // tc_xxx
    component_name: string | null;
    page_id: string;              // tp_xxx
  };
  context: {
    user_agent_hash: string;
    viewport: { w: number; h: number };
    device: 'mobile' | 'tablet' | 'desktop';
    locale: string;
    utm: Partial<Record<'source'|'medium'|'campaign'|'term'|'content', string>>;
  };
  ecommerce?: EcommercePayload;   // view_item, add_to_cart, purchase…
  engagement?: EngagementPayload; // scroll, video_progress, file_download…
  custom?: Record<string, JsonValue>;
}
```

## 5. Anti-redondance

Trois niveaux de dédup :

1. **Client** : LRU 100 events × 5 s (TTL). Clé = `event_id`.
2. **Serveur** : table `tracking_events_log` UNIQUE (`event_id`),
   INSERT … ON CONFLICT DO NOTHING.
3. **CAPI** : `event_id` partagé client/server → Meta/TikTok dédupent
   automatiquement.

Cas typiques évités :

- `page_view` émis 2× au mount + au useEffect → dédup par event_id.
- `view_item` émis sur SSR + hydration → idem.
- `add_to_cart` rapidement double-cliqué → dédup 5 s sur (event,
  item_id, user.session_id).

## 6. Dépendances

- **uuidv7** (npm: `uuidv7`) — 7 KB, génère des IDs triés
  chronologiquement (utile dedup + indexation).
- **next/script** — déjà présent.
- **zod** — déjà présent.

Pas d'ajout SaaS analytique. GTM est **optionnel** (la fondatrice peut
l'ajouter via la fonction "code custom").

## 7. Frontière server / client

| Préoccupation | Server | Client |
|---|---|---|
| Lecture config (admin) | RSC fetch | non |
| Validation event | Zod | Zod (léger) |
| Dispatch pixels client | non | oui (si consent) |
| Dispatch CAPI | oui | non |
| Persistance | oui | non |
| Dedup mémoire | oui (queue) | oui (LRU) |
| UI admin | RSC | Client (interactivité) |

## 8. Découpage en phases

Voir [10-plan-action.md](10-plan-action.md). Vue rapide :

| Phase | Thème | Sortie |
|---|---|---|
| 1 | Inventaire + data | scan, schéma BDD, seed |
| 2 | Datalayer + hook client | `<TrackingProvider>`, `useTracking` |
| 3 | API ingestion + persist | `/api/track`, dedup, retention |
| 4 | Providers + CAPI | Meta, TikTok, Google, Snap, Pinterest |
| 5 | Console admin (CRUD) | pages, components, providers |
| 6 | Console admin (viz/test/logs) | tree, timeline, debug |
| 7 | Polish + tests + go-live | E2E, a11y, perfs, doc |
