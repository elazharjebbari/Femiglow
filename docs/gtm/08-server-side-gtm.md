# 08 — Server-side GTM (sGTM)

> *Stape / Cloud Run, quand l'utiliser, design hybride GTM web + sGTM*

---

## 1. Pourquoi sGTM (Phase 2 — non bloquant V1)

| Bénéfice                                             | Détail                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Réduction du JS tiers en navigateur                  | Pixels Meta/TikTok deviennent un fetch vers son propre domaine                        |
| Cookies first-party (1y vs 7j ITP)                   | `_fbp`, `_ga`, etc. posés sur `gtm.femiglow.ma` au lieu de `connect.facebook.net`     |
| Match Quality Score Meta amélioré (+1-2 points)      | IP + UA + `fbp` + `fbc` posés serveur                                                  |
| Bypass adblockers (en partie)                        | Le subdomain custom n'est pas dans les listes EasyList                                 |
| Réduction consommation CPU mobile                    | Moins de scripts tiers parsés / exécutés                                               |
| Déduplication CAPI native                            | sGTM peut envoyer client + server avec dedup automatique                              |
| Source unique pour pixels (web + iOS + Android)      | Phase 3 si app mobile                                                                  |

V1 reste en **GTM web only** (90 % du gain est déjà là). sGTM
est une **optimisation** Phase 2 quand le ROAS justifie
l'investissement (~ 200 € / mois Stape ou ~ 50 € Cloud Run).

## 2. Architecture cible Phase 2

```
                  ┌─────────────────────────┐
                  │  Navigateur visiteur     │
                  │                          │
                  │  window.dataLayer.push() │
                  └────────────┬─────────────┘
                               │
                               │ HTTPS POST
                               ▼
              ┌────────────────────────────────────┐
              │  GTM Web (GTM-FEMIGLOW)            │
              │  Tags : Aucun pixel tiers !          │
              │  Tag unique : "Forward to sGTM"     │
              │   → POST https://gtm.femiglow.ma/g/collect │
              └─────────────────┬──────────────────┘
                                │ HTTPS POST
                                ▼
        ┌────────────────────────────────────────────────┐
        │  GTM Server-side (GTM-XXXX-S)                   │
        │  Hôte : Cloud Run / Stape on subdomain          │
        │  Subdomain : gtm.femiglow.ma                    │
        │                                                 │
        │  Clients :                                      │
        │   - GA4 client (built-in)                       │
        │   - Universal Analytics client (legacy)         │
        │                                                 │
        │  Tags :                                         │
        │   - GA4 Server tag                              │
        │   - Meta CAPI tag (template community Stape)    │
        │   - TikTok Events API tag                       │
        │   - Snap CAPI tag                               │
        │   - Google Ads Server tag                       │
        │                                                 │
        │  Variables :                                    │
        │   - Event Data (contenu de la requête)         │
        │   - Cookie _fbp / _fbc / _ga                    │
        │                                                 │
        │  Triggers :                                     │
        │   - Custom Event (event name match)             │
        └─────────────┬──────────────────────────────────┘
                      │
                      ▼
            Providers (Meta, TikTok, GA4, Ads…)
```

## 3. Comparatif client-side vs server-side

| Critère                    | GTM web (V1)                       | GTM server-side (V2)                   |
| -------------------------- | ---------------------------------- | -------------------------------------- |
| Coût hébergement           | 0                                  | ~ 50 € / mois (Cloud Run) ou ~ 200 € (Stape) |
| Complexité setup           | Faible                             | Élevée (DNS, GCP, sGTM container)      |
| Adblock resilience         | Faible                             | Élevée                                 |
| Match Quality              | ~ 6.5 / 10 (avec advanced matching client) | ~ 8.5 / 10 (IP + UA serveur, fbp first-party) |
| Cookies durée              | ITP 7 jours sur certains navigateurs | 1 an, first-party                     |
| Latence ajoutée            | ~ 30 ms                            | ~ 80 ms (mais async)                   |
| Privacy compliance         | Bonne                              | Meilleure (données vues 1 fois côté serveur, vous filtrez) |
| Maintenance                | UI GTM web                         | UI GTM web + UI sGTM + ops Cloud Run   |

## 4. Quand basculer en sGTM

| Trigger                                              | Action                                  |
| ---------------------------------------------------- | --------------------------------------- |
| ROAS Meta < 1.5 alors que budget > 30 000 MAD/mois   | → activer sGTM Meta CAPI                |
| Match Quality Meta < 6                               | → activer sGTM                          |
| Adblock détecté > 30 % du trafic                     | → activer sGTM avec subdomain custom    |
| Compliance demande la donnée auditée serveur          | → activer sGTM                          |
| Coût Vercel scale-out                                | (sGTM ne réduit pas Vercel — facteur neutre) |

## 5. Choix de l'hôte

### 5.1 Stape (managed)

- **Avantages** : prêt en 30 minutes, support, templates
  community, custom subdomain géré.
- **Inconvénients** : ~ 200 € / mois selon volume.
- **Recommandé** : si l'équipe est petite et veut de la vitesse.

### 5.2 Cloud Run (Google)

- **Avantages** : ~ 50 € / mois pour < 100 k req/jour, Google
  natif, scaling auto.
- **Inconvénients** : setup manuel (image Docker, DNS, SSL,
  Cloud Run service), monitoring Cloud Run.
- **Recommandé** : si l'équipe a une compétence GCP.

### 5.3 Self-hosted Kubernetes

- Déconseillé hors environnement enterprise. Trop de friction
  pour FemiGlow.

## 6. Workflow d'envoi côté GTM web (Phase 2)

Un **seul tag** dans GTM web, qui transmet l'event au sGTM :

```
Name : Forward to sGTM
Type : Google Analytics: GA4 Event
Configuration tag : GA4 Cfg — Production
Server Container URL : https://gtm.femiglow.ma
Event Name : {{Event}}
Event Parameters :
  - currency               : {{DLV - ecommerce.currency}}
  - value                  : {{DLV - ecommerce.value}}
  - items                  : {{JS - GA4 Items Mapper}}
  - event_id               : {{DLV - event_id}}
  - <tous les params event>
User-provided data :
  - email_sha256           : {{DLV - user_data.email_sha256}}
  - phone_sha256           : {{DLV - user_data.phone_sha256}}

Trigger : CE Group — All Events That Need Server Forwarding
```

Le tag GA4 standard utilise déjà la propriété `Server Container URL`
si on veut router via sGTM. C'est presque transparent.

## 7. Côté sGTM — clients

```
┌─ GA4 Client ────────────────────────────────────────┐
│ Default                                              │
│ Reads requests at /g/collect                          │
│ Routes to:                                            │
│   - GA4 Server tag (forward to GA4)                  │
│   - Meta CAPI tag                                    │
│   - TikTok Events API tag                            │
│   - Pinterest API tag                                │
│   - Snap CAPI tag                                    │
└──────────────────────────────────────────────────────┘
```

## 8. sGTM — tags principaux

### 8.1 GA4 Server tag

```
Type : Google Analytics: GA4 (Server-side)
Configuration : Continue (passe-through)
Trigger : All Events
```

### 8.2 Meta CAPI tag

Utiliser le template **Facebook Conversion API Tag** de la
Community Gallery (ex. par Stape ou Simo Ahava).

```
Pixel ID : {{CONST - Meta Pixel ID Prod}}
Access Token : {{CONST - Meta CAPI Token (encrypted)}}
Event Name : (mapping depuis Event)
Event ID : {{Event Data: event_id}}
User Data :
  - em      : {{Event Data: user_data.email_sha256}}
  - ph      : {{Event Data: user_data.phone_sha256}}
  - external_id : {{Event Data: user.user_id}}
  - client_ip_address : {{Client IP}}
  - client_user_agent : {{Client User Agent}}
  - fbp     : {{Cookie - _fbp}}
  - fbc     : {{Cookie - _fbc}}
Custom Data : (mapping depuis Event Data)

Trigger : Custom Event matches RegEx ^(view_item|add_to_cart|begin_checkout|purchase|generate_lead|sign_up)$
```

## 9. Subdomain custom — DNS

Pour `gtm.femiglow.ma` :

```
Type : CNAME
Name : gtm
Value : <Cloud Run URL ou Stape custom domain>
TTL  : 300
```

SSL : Cloud Run et Stape gèrent automatiquement (Let's Encrypt
ou Google managed certs).

## 10. Statut V1 vs V2

| Élément                            | V1 (GTM web only) | V2 (sGTM)         |
| ---------------------------------- | ----------------- | ----------------- |
| GTM web container                   | Actif             | Actif (forward only) |
| sGTM container                      | Inexistant         | Actif              |
| Pixels client-side (Meta JS, etc.)  | Tous chargés      | Aucun              |
| CAPI server                         | Actif (depuis Vercel) | Migré vers sGTM |
| Match Quality Meta                   | ~ 6.5             | ~ 8.5              |
| Coût hébergement                    | 0                  | ~ 50-200 €/mois     |
| Maintenance                         | Modérée           | Élevée              |

## 11. Migration V1 → V2 (estimation)

| Tâche                                              | Charge           |
| -------------------------------------------------- | ---------------- |
| Provisionner Cloud Run + DNS subdomain              | 0.5 j            |
| Importer container sGTM template                    | 0.5 j            |
| Configurer GA4 Server tag                           | 0.5 j            |
| Configurer Meta CAPI tag                            | 0.5 j            |
| Configurer TikTok Events API tag                    | 0.5 j            |
| Configurer Snap CAPI tag                            | 0.5 j            |
| Configurer Pinterest API tag                        | 0.5 j            |
| Désactiver pixels client (par toggle GTM web)       | 0.5 j            |
| Tests + Tag Assistant + Match Quality observation   | 1 j              |
| **Total**                                           | **~ 5 jours**    |

## 12. Lecture suivante

- [09 — Environnements & versioning](09-environnements-versioning.md)
- [10 — Automatisation](10-automatisation.md)
