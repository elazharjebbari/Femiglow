# Locale detection — algorithme

> Comment décider quelle langue servir à un visiteur sans préférence explicite.

## 1. Algorithme de résolution

```
┌─────────────────────────────────────────────┐
│ Visitor GETs http://femiglow.ma/some-path   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Step 1 — Path contains valid locale?         │
│   /fr/kit, /ar/kit, /en/kit                  │
└──────────────────┬──────────────────────────┘
        Yes ───────┤ Use locale from path → Done
        No │       │
           ▼
┌─────────────────────────────────────────────┐
│ Step 2 — Cookie NEXT_LOCALE exists?          │
│   Cookie set par navigation précédente       │
└──────────────────┬──────────────────────────┘
        Yes ───────┤ Use cookie locale → redirect to /[locale]/path
        No │       │
           ▼
┌─────────────────────────────────────────────┐
│ Step 3 — Accept-Language header              │
│   "ar-MA, ar;q=0.9, fr;q=0.8, en;q=0.5"     │
│   Parse + match against supported locales    │
└──────────────────┬──────────────────────────┘
        Match ─────┤ Use best match → redirect, set cookie
        No │       │
           ▼
┌─────────────────────────────────────────────┐
│ Step 4 — IP geolocation (optional V2)        │
│   ip → country → suggested locale            │
│   MA → 'ar' (since arabophone>francophone?)  │
│                                              │
│   ⚠️ V1 : skip cette step (latency + cost)   │
└──────────────────┬──────────────────────────┘
        Skip V1 ───┤
           │       │
           ▼
┌─────────────────────────────────────────────┐
│ Step 5 — Default locale                      │
│   'fr' (FemiGlow main market)                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼ Use default → redirect, set cookie
                  END
```

## 2. Implémentation Next.js (next-intl)

next-intl fournit la détection out-of-the-box :

```ts
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true, // 👈 Activates steps 1-3-5
});
```

**Behaviour** :
- Step 1 : auto via `matcher` route
- Step 2 : auto via `NEXT_LOCALE` cookie
- Step 3 : auto via `Accept-Language`
- Step 5 : `defaultLocale`

→ Step 4 (IP geo) **non inclus** dans next-intl. Si besoin, custom middleware.

## 3. Parsing Accept-Language

### 3.1 Standard

```
Accept-Language: ar-MA, ar;q=0.9, fr;q=0.8, en;q=0.5
```

Signification :
- ar-MA (preferred, q=1.0 par défaut)
- ar (q=0.9)
- fr (q=0.8)
- en (q=0.5)

### 3.2 Algorithme de matching

```ts
function matchLocale(
  acceptLanguage: string,
  supportedLocales: string[] // ['fr', 'ar', 'en']
): string {
  // 1. Parse Accept-Language → liste ordonnée par quality
  const requested = parseAcceptLanguage(acceptLanguage);
  // [{ locale: 'ar-MA', quality: 1.0 }, { locale: 'ar', quality: 0.9 }, ...]

  // 2. Match exact (ar-MA → ar-MA si supporté)
  for (const req of requested) {
    if (supportedLocales.includes(req.locale)) {
      return req.locale;
    }
  }

  // 3. Match base language (ar-MA → ar)
  for (const req of requested) {
    const base = req.locale.split('-')[0];
    if (supportedLocales.includes(base)) {
      return base;
    }
  }

  // 4. Fallback to default
  return 'fr';
}
```

next-intl fait ça automatiquement, mais on peut customiser via `getRequestConfig`.

## 4. Comportement spécifique FemiGlow

### 4.1 Maroc + AR

Si visiteur Maroc avec navigateur AR :
- Step 3 : `Accept-Language: ar-MA, fr-MA;q=0.5` → match `ar`
- ✅ Servir AR par défaut

### 4.2 Maroc + FR

Si visiteur Maroc avec navigateur FR :
- Step 3 : `Accept-Language: fr-FR, fr;q=0.9` → match `fr`
- ✅ Servir FR

### 4.3 France + FR

Si visiteur France :
- Step 3 : `Accept-Language: fr-FR` → match `fr`
- ✅ Servir FR

### 4.4 USA / UK

Si visiteur anglophone :
- Step 3 : `Accept-Language: en-US` → match `en`
- ✅ Servir EN (V1+ avec EN actif)

### 4.5 Chine, Japon, autres

Si navigateur ne match aucune locale supportée :
- Step 5 : default `fr`
- ⚠️ UX médiocre mais V1 acceptable

## 5. Cookie `NEXT_LOCALE`

### 5.1 Settings

```ts
// Quand l'utilisateur choisit explicitement une langue
cookies().set('NEXT_LOCALE', 'ar', {
  maxAge: 60 * 60 * 24 * 365, // 1 an
  path: '/',
  sameSite: 'lax',
  secure: true,
  httpOnly: false, // Lisible côté client pour switcher UI
});
```

### 5.2 RGPD / Cookie consent

`NEXT_LOCALE` est un cookie **fonctionnel** (essentiel à l'UX i18n), pas un cookie marketing.

→ **Pas besoin d'opt-in** (cf. CNIL guidance + RGPD art. 7).

Si banner cookies actif, mentionner :
> "Nous utilisons un cookie technique `NEXT_LOCALE` pour mémoriser votre choix de langue. Aucune donnée n'est partagée."

## 6. IP geolocation (V2, optionnel)

### 6.1 Service

Vercel fournit `request.geo`:

```ts
// middleware.ts
const country = request.geo?.country; // 'MA', 'FR', etc.
```

### 6.2 Mapping country → locale

```ts
const COUNTRY_TO_LOCALE: Record<string, string> = {
  MA: 'fr',  // Maroc — défaut FR (changeable selon hypothèse business)
  DZ: 'fr',
  TN: 'fr',
  FR: 'fr',
  BE: 'fr',
  CH: 'fr',
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  US: 'en',
  GB: 'en',
  // ...
};
```

**Décision V1** : skip ce step (Accept-Language suffit dans 99% des cas).

## 7. Edge cases

### 7.1 Bot / crawler (Google, social)

Bots envoient souvent `Accept-Language: */*` → step 3 ne match rien → step 5 default.

**Solution** : pour crawlers, servir toutes les versions via sitemap (Google crawl `/ar/kit` séparément).

### 7.2 User change la langue navigateur

Cookie `NEXT_LOCALE` persiste l'ancien choix → user voit ancienne langue.

**Solution** : pas de problème si user a explicitement switché. Sinon, peut clear cookie via switcher.

### 7.3 Lien partagé entre langues

User A (FR) partage `/fr/kit` à User B (AR sur Maroc).

User B clique → atterrit sur `/fr/kit` (path explicit FR).

**Décision** : on respecte le path explicit. User B peut switcher manuellement.

→ Alternative : afficher banner "Vous êtes en français. Passer en arabe ?" si Accept-Language ≠ path. **V2 optionnel**.

### 7.4 URL crawled before locale prefix existed

URLs Google indexées en `/kit` (sans prefix) → middleware redirige vers `/fr/kit`.

**Décision** : 301 redirect (permanent) pour transmettre le PR Google.

## 8. Testing detection

### 8.1 Tests Vitest

```ts
describe('Locale detection', () => {
  it('matches Accept-Language ar-MA → ar', () => {
    expect(matchLocale('ar-MA, fr;q=0.5', ['fr', 'ar', 'en'])).toBe('ar');
  });

  it('falls back to fr if no match', () => {
    expect(matchLocale('zh-CN', ['fr', 'ar', 'en'])).toBe('fr');
  });

  it('respects cookie over header', () => {
    // Mock cookie + header
    // Assert cookie wins
  });
});
```

### 8.2 Tests Playwright

```ts
test('redirect / to /fr/ for Accept-Language fr-FR', async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR' });
  const page = await context.newPage();
  await page.goto('/');
  expect(page.url()).toContain('/fr/');
});
```

## 9. Monitoring

### 9.1 Events à tracker

- `locale_detected` (path, cookie, header, default)
- `locale_changed_manually` (from, to)
- `locale_redirect` (path before, after)

### 9.2 Métriques

- % visites par locale détectée (vs choisie explicitement)
- Top countries par locale
- Taux d'utilisation du switcher

→ Cf. [`10-monitoring/locale-detection-analytics.md`](../10-monitoring/locale-detection-analytics.md).
