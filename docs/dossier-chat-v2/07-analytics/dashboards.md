# Dashboards — Spécifications & livrables

> 4 dashboards principaux : Health, Business, Editorial, Care. Chacun ses panneaux, ses lecteurs, ses cadences. Tous accessibles depuis `/dashboard/chat-v2/analytics`.

## Dashboard 1 — Health (dev oncall)

**Lecteur principal** : dev oncall, lead tech.
**Auto-refresh** : 30 s.
**URL** : `/dashboard/chat-v2/health`.

### Panneaux

#### H1. Service level real-time

```
┌──────────────────────────────────────┐
│  Service level actuel : ●  0 nominal │
│  Depuis : 14:23:11 (15 min)          │
│  Historique 24h :                    │
│  ────────────────────────────────    │
│  ↑sl                                  │
│  4  ─────────────────────────────    │
│  3  ─────────────────────────────    │
│  2  ─────────────────────────────    │
│  1  ─■─                ─■──          │
│  0  ──────■■■■■■■■■■──────────────   │
│      00h          12h         24h     │
└──────────────────────────────────────┘
```

Source : `service_level_changed` events.

#### H2. Providers status grid

| Provider | Up/Down | Success 1h | Avg latency 1h | Last error |
|---|---|---|---|---|
| OpenAI | ● UP | 99.8% | 612 ms | — |
| Anthropic | ● UP | 99.5% | 891 ms | — |
| Mistral | ⚠ DEGRADED | 97.0% | 1.2 s | 502 il y a 12 min |
| Gemini | ● UP | 100% | 423 ms | — |

Source : `provider_used` + `provider_error` events agrégés.

#### H3. Real-time errors stream

Liste 10 dernières erreurs (Sentry-like).

```
14:38:12  PROVIDER_DOWN  mistral  /api/chat/message  sessionId=...
14:35:01  TOOL_TIMEOUT   search_faq  query="halal..."
14:32:45  RATE_LIMIT     visitorToken=...
```

Source : Sentry feed (interne).

#### H4. Performance KPIs gauges

3 gauges :
- First token latency p50 : 612 ms (cible < 800)
- Delta cadence p50 : 67 ms (cible < 80)
- Steady-state success rate : 99.4% (cible > 99)

#### H5. Budget burn

```
Mois en cours : 142 USD / 300 USD  (47%)
Jour en cours : 4.2 USD (vs avg 12 USD)
Projection 30j : 281 USD ✓ (dans budget)
```

#### H6. KB freshness

Tableau sources avec dernière sync, alerte si > 26h.

## Dashboard 2 — Business (PO + Yasmine)

**Lecteur principal** : Selma (PO), Yasmine (content).
**Auto-refresh** : 5 min.
**URL** : `/dashboard/chat-v2`.

### Panneaux

#### B1. North Star + N1

Big number en haut :
- Conversion rate 30j : 0.27%
- vs précédente : +12%
- vs cible : 90% atteint

Sub-tiles :
- Engagement rate (4 / N1.1)
- Message rate (3.2 / N1.2)
- Lead rate (10.4% / N1.3)
- Lead-to-order rate (28% / N1.4)

#### B2. Funnel principal

```
Visitors                    ████████████████████ 100,000
Chat opened                 ████ 8,500 (8.5%)
≥ 1 message user            ███ 6,200 (73% des opens)
LeadForm offered            █ 1,580 (25% des chats actifs)
Lead submitted              █ 705 (45% des offered)
Order in 7d                 ▌ 198 (28% des leads)
```

#### B3. Intents distribution

Pie chart + tableau :
- pricing 25%
- shipping 17%
- purchase-intent 13%
- ingredient 11%
- ...

#### B4. Suggestions performance

Tableau : pair_key, impressions, clicks, CTR, conversion downstream.

#### B5. Top canned replies (satisfaction)

Tableau : key, language, served_count, +1 rate, -1 rate.
Tri par served_count desc.

#### B6. Conversion par persona estimé

(Si on a une heuristique pour bucketer par lang/audience/ville) :
- B2C FR : 0.29%
- B2C AR-MA : 0.31%
- B2B : 1.4% (volume faible mais cher)

## Dashboard 3 — Editorial (Yasmine)

**Lecteur principal** : Yasmine.
**Auto-refresh** : 1 min.
**URL** : `/dashboard/chat-v2/editorial`.

### Panneaux

#### E1. Suggestions à publier

Liste status=review awaiting publish.

#### E2. FAQ entries à mettre à jour

Liste entries dont avg `feedback < 0` ou dont sim moyenne baisse 7j.

#### E3. Intents à enrichir

Liste intents avec < 10 exemples par langue (signal de couverture pauvre).

#### E4. Conversations à étudier

10 conversations random + 10 avec feedback -1.
Permet à Yasmine de comprendre les ratés.

#### E5. Backlog rédactionnel

Tableau todos issus de feedback ouvert :
- "Réponse erreur livraison Tanger" → FAQ entry à créer.

## Dashboard 4 — Care (Karim)

**Lecteur principal** : Karim.
**Auto-refresh** : 1 min.
**URL** : `/dashboard/chat-v2/leads`.

### Panneaux

#### C1. Leads inbox

Tableau leads `status=new` avec actions inline.

#### C2. Conversion funnel Care

- Leads ce mois : 247
- Contactés sous 24h : 89%
- Convertis : 32%
- Délai moyen contact→commande : 1.4j

#### C3. Hot leads (priorité)

Filtre custom :
- `reason='purchase-intent'`
- ou `intent='frustration'` (escalation)
- ou message contenant mots-clés ("urgent", "annuler", "remboursement")

#### C4. Frustration alerts

Conversations avec ≥ 2 feedback -1 ou intent='frustration' → review immédiat.

## Implémentation technique

### Source unique : Postgres

Tous les KPIs business sont calculés à partir de :
- `chat_session`
- `chat_message`
- `chat_lead`
- `chat_conversation_event`
- `chat_tool_call_log`
- `orders`

Materialized views pour les KPIs lourds, refresh 5 min via cron.

### Server-side rendering pour les dashboards

Dashboards en RSC (Server Components) avec :
- Données chargées server-side (pas de waterfall).
- Streaming UI pour les sections lentes.
- Date range picker URL-driven.

### Charts

Library : Recharts ou tremor.so (préférence tremor : préfab dashboards).

### Exports

Tous les dashboards ont un bouton "Export CSV" qui dump la query en CSV (déjà standard).

## Alertes proactives

### Email digest

Hebdomadaire (lundi 9h) :
- KPI snapshot (NS + 4 N1).
- Top mouvements (positif et négatif).
- Top conversations à étudier.

Destinataires : Selma, Yasmine, Karim.

### Slack alerts

Channel `#chat-alerts` :
- Service level dégrade ≥ 30 s → notif.
- Budget alert ≥ 80% mois → notif.
- Provider error rate > 5% sur 15 min → notif.
- > 5 leads non contactés depuis 24h → notif Karim.

### Sentry integration

Sentry alertes (déjà configurées) :
- 5% INTERNAL errors sur 5 min → on-call.
- 10% PROVIDER_DOWN sur 5 min → dev.

## Cadence de mise à jour de cette doc

Cette spec est revue **à chaque trimestre** :
- Suppression KPIs non utilisés (orphelins).
- Ajout de KPIs émergents.
- Cible recalibrée si baseline a bougé.
- Owner mis à jour si turn-over.
