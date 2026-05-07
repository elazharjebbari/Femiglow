# 04 — Frontend

## 1. Vue d'ensemble

Trois briques côté client :

1. **DataLayer** — singleton `window.femiglowDataLayer`.
2. **TrackingProvider** — context React + chargement pixels.
3. **API d'instrumentation** — `useTracking()` (hook),
   `<Track>` (wrapper déclaratif), `data-track-*` (attribut auto).

## 2. Bootstrapping

Dans `app/layout.tsx` :

```tsx
import { TrackingProvider } from '@/lib/tracking/client/TrackingProvider';
import { fetchTrackingConfig } from '@/lib/tracking/server/config';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await fetchTrackingConfig(); // RSC, cached 60s
  return (
    <html lang="fr">
      <body>
        <TrackingProvider config={config}>
          {children}
        </TrackingProvider>
      </body>
    </html>
  );
}
```

`fetchTrackingConfig()` lit en BDD :

- liste `tracking_components` (id, enabled).
- liste `tracking_component_events` (componentId, eventName, params,
  providers).
- liste `tracking_providers` enabled.
- consent snapshot par défaut (anonymousId du cookie).

Sortie sérialisable :

```ts
type TrackingConfig = {
  enabled: boolean;
  consent: ConsentState;
  components: Record<string, ComponentConfig>; // keyed by componentId
  providers: ProviderClientConfig[];
  schemaVersion: 1;
};
```

## 3. DataLayer

`src/lib/tracking/client/datalayer.ts`

```ts
declare global {
  interface Window {
    femiglowDataLayer?: TrackingEvent[];
    dataLayer?: unknown[]; // alias GTM
  }
}

const MAX_BUFFER = 500;

export function getDataLayer(): TrackingEvent[] {
  if (typeof window === 'undefined') return [];
  if (!window.femiglowDataLayer) window.femiglowDataLayer = [];
  return window.femiglowDataLayer;
}

export function pushDataLayer(event: TrackingEvent): void {
  const dl = getDataLayer();
  dl.push(event);
  if (dl.length > MAX_BUFFER) dl.splice(0, dl.length - MAX_BUFFER);
  // GTM compat : si l'utilisateur a configuré GTM, on alimente aussi
  // window.dataLayer
  if (window.dataLayer) window.dataLayer.push({ event: event.event, ...event });
}
```

## 4. TrackingProvider

`src/lib/tracking/client/TrackingProvider.tsx` (Client Component) :

```tsx
'use client';
const TrackingContext = createContext<TrackingClient | null>(null);

export function TrackingProvider({ config, children }: Props) {
  const clientRef = useRef<TrackingClient | null>(null);
  if (!clientRef.current) clientRef.current = createClient(config);
  const client = clientRef.current;

  useEffect(() => {
    client.init();
    return () => client.destroy();
  }, [client]);

  // Re-emit page_view sur changement de route
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    client.emit('page_view', { path: pathname, query: search?.toString() ?? '' });
  }, [client, pathname, search]);

  return (
    <TrackingContext.Provider value={client}>
      <ConsentBanner client={client} />
      <PixelsLoader client={client} />
      {children}
      <DebugOverlay client={client} />
    </TrackingContext.Provider>
  );
}

export function useTracking(): TrackingClient {
  const c = useContext(TrackingContext);
  if (!c) throw new Error('useTracking must be inside TrackingProvider');
  return c;
}
```

## 5. TrackingClient

Classe centrale (pas exposée), contient :

```ts
class TrackingClient {
  private dedupCache = new LRU<string, true>({ max: 100, ttl: 5_000 });
  private queue: TrackingEvent[] = [];
  private flushTimer: number | null = null;

  emit(name: string, params: Record<string, unknown>, opts?: EmitOptions): void {
    if (!this.config.enabled) return;
    const def = this.config.events[name];
    if (!def?.enabled) return;
    if (!this.matchesScope(opts?.componentId, def)) return;

    const event = this.buildEvent(name, params, opts);
    if (this.dedupCache.has(event.event_id)) return;
    this.dedupCache.set(event.event_id, true);

    pushDataLayer(event);
    this.dispatchClientPixels(event, def);
    this.enqueueServer(event);
  }

  private enqueueServer(event: TrackingEvent): void {
    this.queue.push(event);
    if (!this.flushTimer) this.flushTimer = window.setTimeout(() => this.flush(), 500);
    if (this.queue.length >= 20) this.flush();
  }

  private flush(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify({ events: batch });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', headers: {'content-type':'application/json'}, body, keepalive: true }).catch(() => {});
    }
  }

  // …
}
```

Hook visibility / unload pour flush :

```ts
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
window.addEventListener('pagehide', () => this.flush());
```

## 6. API d'instrumentation

### 6.1 Hook `useTracking`

```tsx
function AddToCartButton({ item }: Props) {
  const { emit } = useTracking();
  return (
    <button
      onClick={() => emit('add_to_cart', {
        currency: 'EUR',
        value: item.priceCents / 100,
        items: [{ item_id: item.sku, item_name: item.name, price: item.priceCents/100, quantity: 1 }],
      }, { componentId: 'tc_add_to_cart_button' })}
    >Ajouter au panier</button>
  );
}
```

### 6.2 Composant déclaratif `<Track>`

```tsx
<Track
  componentId="tc_hero_kit"
  on="visible"          // 'mount' | 'visible' | 'click' | 'submit' | 'play'
  event="view_promotion"
  params={{ promotion_id: 'kit-hero', promotion_name: 'Le kit FemiGlow' }}
>
  <HeroProduit … />
</Track>
```

Sous le capot : IntersectionObserver pour `visible`, DOM listener
pour `click`/`submit`. Évite la duplication d'événements via une
sentinelle `data-tracked-id`.

### 6.3 Attribut auto `data-track-*`

Pour les composants tiers ou rapidement instrumentables :

```tsx
<a data-track-event="select_item" data-track-component="tc_product_card" data-track-params='{"item_id":"kit"}'>…</a>
```

Un listener global capture `click` (event delegation) et émet l'event.

### 6.4 Middleware d'auto-tracking

Le `TrackingProvider` installe :

- listener `click` global pour `data-track-event`.
- listener `submit` global pour les `<form data-track-event>`.
- IntersectionObserver pour `data-track-on="visible"`.
- listener `play`/`pause`/`ended` pour `<video data-track-event>`.

## 7. Consentement

`src/lib/tracking/client/consent.ts` :

```ts
export function loadConsent(): ConsentState {
  const raw = localStorage.getItem('femiglow_consent_v1');
  if (!raw) return DEFAULT_DENIED;
  try { return JSON.parse(raw); } catch { return DEFAULT_DENIED; }
}

export function saveConsent(state: ConsentState): void {
  localStorage.setItem('femiglow_consent_v1', JSON.stringify(state));
  // Sync server (audit) + emit gtag consent update si gtag chargé
  fetch('/api/track/consent', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(state) });
  if (window.gtag) window.gtag('consent', 'update', state);
}
```

`<ConsentBanner>` affiche 3 boutons : "Tout accepter", "Refuser",
"Personnaliser". Layout discret, banner basse, bouton "préférences"
toujours accessible via footer.

## 8. Pixels chargés conditionnellement

`src/lib/tracking/client/pixels/*.ts` — un fichier par provider.
Pattern :

```ts
// pixels/meta.ts
export function loadMetaPixel(pixelId: string, consent: ConsentState): void {
  if (consent.ad_storage !== 'granted') return;
  if (window.fbq) return;
  // snippet officiel inlined (signed by CSP nonce)
  // …
  fbq('init', pixelId);
  fbq('track', 'PageView');
}

export function trackMeta(event: TrackingEvent, mappedName: string): void {
  if (!window.fbq) return;
  window.fbq('track', mappedName, event.payload, { eventID: event.event_id });
}
```

Le chargement est différé (`<Script strategy="lazyOnload">` ou
manuel après `requestIdleCallback`).

## 9. Anti-redondance détaillé

Stratégies par event :

| Event | Clé dedup | Fenêtre |
|---|---|---|
| `page_view` | `page.url + sessionId` | infinie tant que session |
| `view_item` | `item_id + sessionId` | 30 s |
| `add_to_cart` | `item_id + sessionId` | 5 s |
| `begin_checkout` | `sessionId + cart_hash` | 60 s |
| `purchase` | `transaction_id` | infinie |
| `scroll_depth` | `pagePath + depthBucket(25/50/75/90)` | par page |
| `video_progress` | `videoId + progressBucket(25/50/75/100)` | par vidéo |

## 10. Performance

- Bundle TrackingProvider + client core : **≤ 8 KB gzip**.
- Pixels : **lazy** (after first user interaction OR 3 s post-mount,
  selon `priority` de l'event critique attendu sur la page).
- `view_item` & `page_view` : émis directement dans le RSC payload
  serialisé pour éviter le delay d'hydration sur des pages produit
  (utile au "Time to first event" pour Meta).
- Code-split provider : `pixels/meta.ts` chargé uniquement si Meta
  enabled.

## 11. TypeScript : type-safe events

`src/lib/tracking/client/events.types.ts`

```ts
type EventParams = {
  view_item: { currency: string; value: number; items: Item[] };
  add_to_cart: { currency: string; value: number; items: Item[] };
  begin_checkout: { currency: string; value: number; items: Item[]; coupon?: string };
  purchase: { transaction_id: string; currency: string; value: number; items: Item[]; tax?: number; shipping?: number };
  view_promotion: { promotion_id: string; promotion_name: string; creative_name?: string };
  generate_lead: { value?: number; currency?: string; method: string };
  fg_journal_read_75: { article_id: string; article_slug: string; reading_time_seconds: number };
  // … etc
};

type EmitFn = <K extends keyof EventParams>(name: K, params: EventParams[K], opts?: EmitOptions) => void;
```

Le hook `useTracking()` retourne `{ emit: EmitFn }`. Erreurs
TypeScript dès qu'un dev oublie un paramètre.

## 12. Server Components et événements automatiques

Les Server Components ne peuvent pas appeler `useTracking`. Pour
les events SSR (`view_item` sur la page produit), on utilise un
**composant mince client** :

```tsx
// src/components/tracking/AutoEvent.tsx
'use client';
export function AutoEvent({ event, params, componentId }: Props) {
  const { emit } = useTracking();
  useEffect(() => { emit(event, params, { componentId }); }, []);
  return null;
}
```

Et dans la page Server :

```tsx
export default async function KitPage() {
  const item = await getItem('kit');
  return (
    <>
      <AutoEvent event="view_item" params={{ currency:'EUR', value: item.price, items: [serializeItem(item)] }} componentId="tp_kit_page" />
      <HeroProduit item={item} />
      …
    </>
  );
}
```

## 13. DebugOverlay

`<DebugOverlay>` (uniquement si `?fg_debug=1` dans l'URL OU admin
session active) :

- Affiche un panneau bottom-right avec les derniers 20 events.
- Surligne les composants instrumentés (overlay rouge/vert selon
  status).
- Bouton "Vider" / "Replay last".

## 14. Robustesse / SSR

- Tout accès à `window` gardé par `typeof window !== 'undefined'`.
- Test SSR : `<TrackingProvider>` doit rendre ses children sans
  émettre quoi que ce soit côté server.
- Erreurs : `try/catch` dans `emit`, log via Sentry breadcrumb,
  jamais throw.

## 15. Bundle / code-split

```
src/lib/tracking/client/
  index.ts                ← entry public (TrackingProvider, useTracking)
  datalayer.ts            ← <1 KB
  client.ts               ← ~3 KB (TrackingClient)
  consent.ts              ← <1 KB
  pixels/
    meta.ts               ← lazy-loaded
    tiktok.ts             ← lazy-loaded
    google.ts             ← lazy-loaded
    snap.ts               ← lazy-loaded
    pinterest.ts          ← lazy-loaded
  hooks/
    useTracking.ts
  components/
    Track.tsx             ← déclaratif
    AutoEvent.tsx         ← SSR helper
    ConsentBanner.tsx
    DebugOverlay.tsx
```

Vérification budget : check `next build` analyze. Cible globale
chargée sur le first paint : ≤ 8 KB gzip.
