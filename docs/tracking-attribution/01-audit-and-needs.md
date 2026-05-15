# 1. Audit du stack actuel + cartographie du besoin

## État actuel (mai 2026)

### Comment les events partent vers les providers

```
emit('purchase', {...})
    ↓
TrackingClient.emit() → dataLayer.push({...})
    ↓
GTM container (importé depuis l'admin tracking plan)
    ├→ GA4 Event tag    → fire toujours (trigger CustomEvent matchant l'event_name)
    ├→ Meta Pixel tag   → fire toujours
    ├→ Google Ads tag   → fire toujours
    └→ TikTok tag       → fire toujours
```

**Aucune logique d'attribution** n'est appliquée. Tous les pixels reçoivent
tous les events de tous les visiteurs. Résultat : 4 plateformes se créditent
chacune 100 % des conversions.

### Données disponibles

Côté serveur (`apps/web/src/lib/tracking/server/enricher.ts`) :
- `referrer` (document.referrer)
- `utm_source`, `utm_medium`, `utm_campaign` (capturés depuis l'URL au mount)
- `visitorId`, `sessionId` (cookies, déjà stables)
- Pas de stockage des **click IDs** (gclid, fbclid, ttclid, etc.) à ce jour
- Pas de table `visitor_attribution`

Côté client :
- `useTrackingClient` lit/écrit le cookie `fg_visitor`
- Pas de capture systématique des paramètres d'URL au landing

### Ce qui manque

| Manque | Impact |
|---|---|
| Détection canal au landing | Impossible de savoir d'où vient le visiteur |
| Stockage attribution (first/last touch) | Impossible d'appliquer une stratégie cross-session |
| Annotation `attribution` dans dataLayer | GTM ne peut pas filtrer |
| Conditions sur les tags GTM | Conversions toujours envoyées à tous |
| UI admin pour la stratégie | Pas de bouton pour basculer first/last touch |

## Besoin métier

### User story 1 — Visiteur direct depuis Google Ads

> En tant qu'opérateur FemiGlow, quand un visiteur arrive via une pub Google Ads
> (clic = `gclid` dans l'URL) et achète, **seul Google Ads doit compter la
> conversion** pour son bidding. Meta peut recevoir un signal d'audience
> (page_view, view_item) mais pas la conversion.

### User story 2 — Visiteur cross-session

> En tant qu'opérateur, quand un visiteur clique d'abord sur une pub Meta
> (jour 1) puis revient en direct un autre jour (jour 5) et achète, **Meta
> doit recevoir la conversion** (dernier canal payant connu).

### User story 3 — Visiteur direct sans historique

> Si un visiteur arrive en direct sans gclid/fbclid/utm et sans historique,
> **aucun canal payant n'est crédité**. La conversion reste tracée côté
> analytics (GA4) mais aucun pixel publicitaire ne la déclenche.

### User story 4 — Configurabilité

> En tant qu'admin, je peux **basculer la stratégie** d'attribution depuis
> les paramètres tracking (last-paid / first-paid / last-touch / first-touch /
> broadcast). Le système recommande `last_paid_touch` par défaut (industrie
> standard).

### User story 5 — Override par-event

> Pour les events de **construction d'audience** (page_view, view_item,
> add_to_cart), je veux qu'ils partent **à tous les pixels** (pour Lookalike
> / Custom Audiences). Pour les events de **conversion** (purchase,
> lead_capture, etc.), je veux qu'ils suivent la stratégie d'attribution.

### User story 6 — Debug + transparence

> En tant qu'admin, je peux voir, pour un visiteur donné (cookie ou
> session_id), **quelle attribution a été calculée** et **quel canal sera
> crédité** s'il convertit maintenant.

## Contraintes

- **GDPR / consentement** : l'attribution ne peut s'appliquer que si le
  `analytics_storage` et `ad_storage` sont accordés. Sinon, dataLayer ne porte
  pas l'attribution (Consent Mode v2 mode anonymisé).
- **Stack existante** : Next.js 14 App Router, Drizzle ORM, Postgres,
  Consent Mode v2 déjà en place. Meta CAPI existe ; Google Ads OCI et
  TikTok Events API ne sont pas en place.
- **Pas en prod** : système de tracking pas encore en live → on peut casser
  l'API.

## Signalètique canaux supportés (priorité de détection)

| # | Détecteur | Canal |
|---|---|---|
| 1 | Param URL `gclid` ou `gbraid`/`wbraid` | `google_ads` |
| 2 | Param URL `fbclid` | `meta` |
| 3 | Param URL `ttclid` | `tiktok` |
| 4 | Param URL `sccid` | `snap` |
| 5 | Param URL `epik` | `pinterest` |
| 6 | Param URL `msclkid` | `bing_ads` |
| 7 | `utm_source=google` & `utm_medium=cpc\|paid\|ppc` | `google_ads` |
| 8 | `utm_source=facebook\|fb\|meta` & `utm_medium=cpc\|paid` | `meta` |
| 9 | `utm_source=tiktok` & `utm_medium=cpc\|paid` | `tiktok` |
| 10 | `utm_source=instagram` & `utm_medium=cpc\|paid` | `meta` (mêmes pixels) |
| 11 | `utm_medium=email\|newsletter` | `email` |
| 12 | `document.referrer` matche search engines | `organic` |
| 13 | `document.referrer` matche social (sans pub) | `social_organic` |
| 14 | Aucun des précédents | `direct` |

Les canaux `direct`, `organic`, `social_organic`, `email` ne sont **pas
payants** → la stratégie `last_paid_touch` les ignore et remonte à l'avant-
dernier touch.
