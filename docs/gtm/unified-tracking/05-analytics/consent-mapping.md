# Politique de consentement

## 1. Modèle Consent Mode v2

FemiGlow respecte Google Consent Mode v2 et le RGPD. Deux dimensions critiques :

| Catégorie | Description |
|---|---|
| `analytics_storage` | Permet le stockage analytics (GA4, mesures internes). |
| `ad_storage` | Permet le stockage publicitaire (Meta Pixel, Google Ads conversions). |
| `ad_user_data` | Permet l'envoi de données utilisateur aux providers ad (CAPI Meta). |
| `ad_personalization` | Permet la personnalisation des ads. |

Avant consentement explicite : tous = `denied`. GA4 reçoit alors uniquement des "pings" anonymisés (cookieless ping mode).

## 2. Mapping events → consent requis

Chaque événement déclare dans son entrée `events.[eventName].consent` :

| Event | analytics_storage requis | ad_storage requis | Justification |
|---|---|---|---|
| `page_view` | non (auto même sans consent) | non | Cookieless ping suffit pour mesure agrégée |
| `view_content` | oui | non | Mesure d'engagement |
| `add_to_cart` | oui | oui | Conversion-related → Meta + Ads remarketing |
| `lead_form_submit` | oui | oui | Conversion → Ads + Meta |
| `purchase` | oui | oui | Conversion principale |
| `chat_open` | oui | non | Mesure engagement uniquement |
| `wizard_step_complete` | oui | non | Funnel analytics |
| `form_submit_error` | oui | non | Diagnostic, pas d'usage ad |

## 3. Comportement runtime

### 3.1 Client-side (gtag / dataLayer)

Le snippet GTM initial est chargé en mode "consent denied". Quand l'utilisateur accepte :
```js
gtag('consent', 'update', {
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  analytics_storage: 'granted',
});
```

GTM rejoue alors les events bufferisés (`url_passthrough: true`).

### 3.2 Server-side (Meta CAPI)

Le dispatcher vérifie `consent.ad_storage === 'granted'` AVANT d'appeler le provider. Sinon : `status: 'skipped', reason: 'consent_denied'`.

```ts
async function dispatchToMeta(event: ResolvedEvent, ctx: DispatchContext): Promise<DispatchResult> {
  if (event.consent.requiresAdStorage && ctx.consent.ad_storage !== 'granted') {
    return { status: 'skipped', reason: 'consent_denied' };
  }
  // ... CAPI call
}
```

## 4. Granularité par event

Le plan permet de définir `consent.requiresAdStorage` et `consent.requiresAnalyticsStorage` au cas par cas. Par défaut :
- Tout event de catégorie `commerce`, `conversion`, `lead` : `ad_storage` requis.
- Tout event de catégorie `engagement`, `funnel`, `lifecycle` : `analytics_storage` requis.
- Events `error` : `analytics_storage` requis (debugging).

## 5. Bannière consentement

FemiGlow utilise actuellement un cookie banner custom. Le wiring du plan est :
1. Banner se monte → ajoute `gtag('consent', 'default', { ... denied })` AVANT GTM init.
2. User accept all → `gtag('consent', 'update', { ... granted })`.
3. User accept selective → `gtag('consent', 'update', { analytics_storage: 'granted' })` seulement.
4. User reject all → consent reste denied (GA4 ping uniquement).

Cf. `apps/web/src/lib/consent/` pour l'implémentation existante (à intégrer au plan v1 si pas déjà).

## 6. Audit consentement

Toute requête vers `/api/track` logge le consent state au moment de l'event :
```
{"evt":"track.dispatch","event":"purchase","consent":{"ad_storage":"granted","analytics_storage":"granted"},"providers":[{"name":"meta","status":"sent"}, ...]}
```

Sert à prouver post-hoc qu'on n'a pas envoyé de données sans consentement.

## 7. Maroc / RGPD

FemiGlow Maroc opère sous **Loi 09-08** marocaine + RGPD si visiteurs UE. La politique de consentement ci-dessus respecte les deux (consent explicite avant cookies non-essentiels).
