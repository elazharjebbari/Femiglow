# 30.5 — Consent Mode v2 propagation

## Problème

`saveConsent()` côté frontend appelle `gtag('consent','update', state)`.
Si `Google Ads` a été chargé via un snippet séparé après l'init de GA4, le
`consent.update` peut ne pas l'atteindre.

## Architecture cible

```
USER ACTION (click "Accepter" sur ConsentBanner)
  │
  ▼
consent.ts: saveConsent(state)
  │
  ├─ 1. localStorage[STORAGE_KEY] = JSON.stringify(state)
  ├─ 2. document.cookie = STATE
  ├─ 3. gtag('consent', 'update', state)  ◄── ★ point critique
  └─ 4. window.dispatchEvent('fg:consent-changed', { detail: state })
       │
       ▼
PixelLoader handler
  ├─ 5. fetch /api/track/pixels
  ├─ 6. injectSnippets() pour chaque kind
  └─ 7. Les snippets ré-init avec consent granted
       │
       ▼
Snippets injectés (gtag.js, fbq, gtm.js)
  └─ 8. À leur tour, font gtag('consent','update', state)
       car ils lisent localStorage au load
```

## Risques

1. **Order de race** : si gtag.js charge APRÈS le `gtag('consent','update')`,
   l'update est buffered dans `window.dataLayer` mais doit être rejoué après
   le chargement du script.

2. **Double déclenchement** : si snippet ré-init avec consent granted, on
   peut envoyer un `page_view` deux fois.

## Fix proposé

### 1. Renforcer `saveConsent()`

```typescript
// lib/tracking/consent.ts
export function saveConsent(state: TrackingConsentState): void {
  if (typeof window === 'undefined') return;

  // 1. Persist
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(state))};path=/;max-age=${60*60*24*365};samesite=lax`;
  } catch { /* ignore */ }

  // 2. Push consent update to gtag (whatever its load state)
  //    Si gtag pas encore loaded, le push reste en queue dataLayer et
  //    sera consommé au load de gtag.js
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(['consent', 'update', state]);
  // ALTERNATIVE plus propre si gtag est défini :
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', state);
  }

  // 3. Notify all interested parties (PixelLoader, etc.)
  window.dispatchEvent(new CustomEvent('fg:consent-changed', { detail: state }));
}
```

### 2. PixelLoader : ne PAS ré-injecter si déjà chargé

Le PixelLoader actuel a un `loadedRef` Set qui prévient les double-injections.
Bien.

Mais il fait `fetch('/api/track/pixels')` à chaque changement de consent.
C'est OK pour pull les snippets, mais si rien n'a changé côté DB, c'est
overhead. Optionnel : SWR avec ETag.

### 3. Initialiser les snippets avec `consent default` cohérent

Les snippets servis par `/api/track/pixels` incluent déjà
`gtag('consent','default',{ad_storage:'denied',...})` en début. C'est correct.

Quand `saveConsent()` envoie ensuite un `consent.update`, gtag mémorise le
nouveau state.

### 4. Pour Google Ads spécifiquement

Le snippet google-ads inject :
```javascript
if (!document.querySelector('script[data-gtag-loaded]')) {
  // load gtag.js et init consent default
  ...
  gtag('consent','default',{...});
}
gtag('config', 'AW-...', { send_page_view: false });
```

Quand `saveConsent(granted)` est appelé :
1. `window.dataLayer.push(['consent','update', state])` → gtag récupère
2. `gtag` propage à toutes les configs (`G-...` et `AW-...`)

**Test** : ouvrir DevTools → Network → filter `google-analytics.com` → vérifier
que les `gcs` (Google Consent Signal) param passe de `G100` (denied) à `G110`
(granted) après accept.

## Test E2E

```typescript
test('consent update propage aux providers Google Ads + GA4', async ({ page }) => {
  await page.goto('/kit');
  await page.waitForTimeout(2000); // pixels injectés

  // Avant consent : gcs=G100 (denied)
  const requestsBefore = await capturePixelRequests(page);
  expect(requestsBefore).toContainEqual(expect.stringContaining('gcs=G100'));

  // User accepte
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('fg:consent-changed', { detail: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    }}));
  });
  await page.waitForTimeout(1000);

  // Après consent : gcs=G110 (granted)
  const requestsAfter = await capturePixelRequests(page);
  expect(requestsAfter).toContainEqual(expect.stringContaining('gcs=G110'));
});
```

## Documentation utilisateur (admin)

Dans `/admin/tracking/settings` :

> **Consent Mode v2** est actif. Les tags GA4, Google Ads et GTM démarrent
> avec un consentement par défaut DENIED. Lorsque l'utilisateur accepte
> via la bannière (ou implicitement si `default_granted=true`), tous les
> tags reçoivent l'update via `gtag('consent','update')`.
>
> Pour tester : ouvre Tag Assistant sur ton URL avec `?gtm_debug=1`. Tu
> verras les events `consent_default` puis `consent_update` dans la timeline.
