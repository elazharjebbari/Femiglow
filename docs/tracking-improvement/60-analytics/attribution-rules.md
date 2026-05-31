# 60.4 — Règles d'attribution

## Vue d'ensemble

FemiGlow utilise les modèles d'attribution par défaut de chaque provider :

| Provider | Modèle | Window |
|---|---|---|
| Google Ads | Data-driven (par défaut, recommandé) | 30j post-clic |
| GA4 | Data-driven | 30j post-clic |
| Meta | Last-click | 7j post-clic + 1j post-view |
| TikTok | Last-click | 7j post-clic |
| Snap | Last-click | 7j post-clic |
| Pinterest | Last-click | 30j post-clic |

## Identifiants d'attribution

| Provider | Identifiant primaire | Fallback |
|---|---|---|
| Google Ads | `gclid` | Enhanced Conversions (email/phone hash) |
| GA4 | `client_id` (cookie `_ga`) | `user_id` si logged-in |
| Meta | `fbc` cookie + `event_id` | `external_id` |
| TikTok | `ttclid` | — |
| Snap | `sccid` | — |
| Pinterest | `epik` cookie | — |

## Capture des `clid` cookies

Au landing de l'utilisateur (middleware Next.js), capturer :

```typescript
// middleware.ts
const CLIDS_TO_CAPTURE = {
  gclid: { cookie: '_gclid', maxAge: 90 * 24 * 60 * 60 },
  fbclid: { cookie: '_fbclid', maxAge: 90 * 24 * 60 * 60 },
  ttclid: { cookie: '_ttclid', maxAge: 30 * 24 * 60 * 60 },
  sccid: { cookie: '_sccid', maxAge: 30 * 24 * 60 * 60 },
  epik: { cookie: '_epik', maxAge: 30 * 24 * 60 * 60 },
};

for (const [param, { cookie, maxAge }] of Object.entries(CLIDS_TO_CAPTURE)) {
  if (request.nextUrl.searchParams.has(param)) {
    res.cookies.set(cookie, request.nextUrl.searchParams.get(param)!, {
      maxAge, sameSite: 'lax', httpOnly: false,
    });
  }
}
```

Ces cookies sont ensuite lus par le TrackingClient et envoyés serveur dans
chaque event :
```typescript
{
  event_id: "uuid",
  user: {
    anonymous_id: "ax_...",
    gclid: getCookie('_gclid'),
    fbclid: getCookie('_fbclid'),
    ttclid: getCookie('_ttclid'),
    // ...
  }
}
```

## Pourquoi `event_id` ?

L'`event_id` (UUID généré client) sert à :

1. **Déduplication Meta/Google Ads** quand le tag client ET le serveur
   envoient la même conversion :
   - Meta : prend le premier reçu avec ce `event_id`
   - Google Ads : prend le premier `orderId` (qu'on remplit avec event_id)

2. **Traçabilité interne** : dans `tracking_events_log`, on peut joindre les
   logs serveur aux logs Google Ads via `event_id`.

3. **Audit** : si une conversion semble manquante, on peut chercher par
   `event_id` dans les deux systèmes.

## Cas particulier : long lead funnel

Si un user :
- Jour 1 : clique sur Google Ads → arrive sur /kit avec `gclid=Abc`
- Jour 1 : remplit le formulaire de lead (step 1) → `lead_capture` envoyé
- Jour 5 : finalise la commande (step 2-3) → `purchase` envoyé

Le `gclid=Abc` est conservé en cookie 90j. Les deux events portent ce
`gclid` → Google Ads attribue les deux conversions au même clic.

## Cas particulier : multi-touch attribution

Si l'utilisateur clique sur plusieurs ads avant d'acheter :
- Jour 1 : clique Meta ad → `fbclid=X1` capturé
- Jour 3 : clique Google ad → `gclid=Y2` capturé
- Jour 5 : achète

Meta voit `fbclid=X1`, Google Ads voit `gclid=Y2`. Les deux comptent la
conversion dans leur reporting (sans dédup cross-network). C'est le
comportement attendu.

Pour de la mesure cross-network, utiliser GA4 Data-Driven Attribution qui
prend en compte la séquence complète.

## Conversion windows

Aligner avec les standards de chaque platform :

| Conversion | Provider window | Notre fenêtre cookie |
|---|---|---|
| purchase | 30j post-clic | 90j (cookie) — couvre tous les providers |
| lead_capture | 30j | 90j |
| contact | 30j | 90j |
| view_content | 1-7j | 90j (cookie window large pour analytics) |

## Privacy & consent

- Tous les `clid` cookies sont `sameSite=lax`, `httpOnly=false`
  (besoin de lecture côté JS pour propagation)
- Si consent denied : on garde le cookie technique mais on NE FIRE PAS les
  events serveur (donc pas d'attribution).
- Si user clear cookies : on perd l'attribution pour les nouvelles
  conversions, mais les anciennes restent attribuées côté provider via leur
  propre system (e.g. Google Ads fingerprinting, Meta CAPI matching).

## Reporting interne

Dashboard interne `/admin/tracking/analytics/providers` compte les
conversions **dispatchées** côté serveur. C'est différent des reports
Google Ads / Meta qui comptent les conversions **attribuées** côté provider.

L'écart peut être ~5-15% en faveur du provider (qui peut attribuer une
conversion via fingerprinting même sans `clid` capturé chez nous).

## Décisions à valider avec Marketing

- Faut-il aussi tracker `view_item` comme conversion mineure Google Ads
  (pour optimiser Awareness campaigns) ?
- Faut-il dédupliquer cross-network en utilisant GA4 comme SSOT ?
- Faut-il implémenter un dashboard interne de comparaison
  "what we sent vs what Google Ads attributed" pour identifier les drops ?
