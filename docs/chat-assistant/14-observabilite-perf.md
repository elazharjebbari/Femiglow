# 14 — Observabilité & performance

> *Logs structurés, traces, métriques, budgets, alerting*

---

## 1. Trois piliers

| Pilier        | Outil par défaut                              | Émission                              |
| ------------- | --------------------------------------------- | ------------------------------------- |
| Logs          | `pino` JSON → stdout (Vercel logs)            | À chaque opération signifiante        |
| Traces        | OpenTelemetry SDK Node + `@vercel/otel`       | Spans par étape pipeline              |
| Métriques     | Vercel Web Analytics + `web-vitals` + maison  | Côté client + côté serveur            |

## 2. Logs

### 2.1 Logger

```ts
// lib/chat/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'chat', region: process.env.VERCEL_REGION },
  redact: {
    paths: ['*.apiKey', '*.apiKeyEncrypted', '*.cookie', '*.authorization', '*.headers.authorization', '*.token'],
    censor: '[redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

### 2.2 Format d'événement

Chaque message produit une ligne « digest » :

```jsonc
{
  "level": "info",
  "service": "chat",
  "msg": "message_completed",
  "sessionId": "cs_xxx",
  "messageId": "cm_yyy",
  "language": "fr",
  "page": "/kit",
  "providerKind": "openai",
  "model": "gpt-4o-mini",
  "tokensIn": 612,
  "tokensOut": 178,
  "latencyTotalMs": 1840,
  "latencyFirstTokenMs": 720,
  "ragHits": 4,
  "ragSources": ["ck_001","ck_004","ck_023","ck_098"],
  "moderation": { "input": false, "output": false, "rewritten": false },
  "costEur": 0.00214,
  "intent": "product_question",
  "ts": "2026-05-06T14:21:09Z"
}
```

### 2.3 Niveaux

| Niveau   | Quand                                                                |
| -------- | -------------------------------------------------------------------- |
| `debug`  | Détail par span, prompt complet (jamais en prod)                     |
| `info`   | Digest message, ouvertures session, décisions router                  |
| `warn`   | Modération sortie réécrite, fallback provider, quota proche, breaker |
| `error`  | Provider 5xx, panne RAG, modération entrée bloquante                 |
| `fatal`  | Indisponibilité totale providers (offline), panne DB                 |

### 2.4 Environnement

| Env       | Niveau par défaut |
| --------- | ----------------- |
| local     | `debug`           |
| preview   | `info`            |
| prod      | `info`            |

Activable en `debug` par session admin (`X-FG-Debug: <signed>`).

## 3. Traces (OpenTelemetry)

### 3.1 Spans

```
HTTP POST /api/chat/message  [root span]
├─ chat.parse                    1.4 ms
├─ chat.session.upsert           4.2 ms
├─ chat.rate_limit               0.8 ms
├─ chat.lang.detect              1.1 ms
├─ chat.sanitize_pii             0.6 ms
├─ chat.moderation.input         142 ms
├─ chat.memory.recent            8 ms
├─ chat.rag.retrieve             132 ms
│   ├─ chat.rag.embed            96 ms
│   ├─ chat.rag.vector_search    32 ms
│   └─ chat.rag.rerank           4 ms
├─ chat.compose_prompt           2 ms
├─ chat.router.choose            2 ms
├─ chat.provider.stream          1 020 ms
│   ├─ first_token               720 ms
│   └─ stream_complete           300 ms
├─ chat.moderation.output        3 ms
├─ chat.charter_filter           1 ms
├─ chat.persist                  18 ms
└─ chat.events.emit              0.4 ms
```

### 3.2 Attributs

Chaque span porte (au minimum) `chat.session_id`, `chat.message_id`,
`chat.lang`, `chat.provider_kind`, `chat.model`, `chat.cost_eur`.

### 3.3 Propagation

`traceparent` propagé entre Edge → Node → providers (en
log-uniquement, le header n'est pas transmis aux providers
externes).

### 3.4 Export

- **Vercel OpenTelemetry** vers leur backend : OK pour inspection
  rapide, court terme.
- **OTel exporter OTLP** vers backend choisi (Grafana Cloud,
  Honeycomb, Sentry Performance) — Phase 2.

## 4. Métriques

### 4.1 Côté serveur (custom)

Émises via OTel Metrics (counters / histograms) :

| Métrique                                       | Type      | Labels                                  |
| ---------------------------------------------- | --------- | --------------------------------------- |
| `chat.message.total`                           | counter   | `language`, `intent`, `provider`        |
| `chat.message.first_token_ms`                  | histogram | `language`, `provider`                   |
| `chat.message.total_ms`                        | histogram | `language`, `provider`                   |
| `chat.tokens.in`                               | counter   | `provider`, `model`                      |
| `chat.tokens.out`                              | counter   | `provider`, `model`                      |
| `chat.cost.eur`                                | counter   | `provider`, `model`                      |
| `chat.error.total`                             | counter   | `code`, `provider`                       |
| `chat.fallback.total`                          | counter   | `from_provider`, `to_provider`           |
| `chat.moderation.input.flagged.total`          | counter   | `category`                               |
| `chat.moderation.output.rewrite.total`         | counter   | `reason`                                 |
| `chat.rag.hit_at_k`                            | histogram | `k`                                      |
| `chat.session.open.total`                      | counter   | `page`                                   |
| `chat.conversion.attributed.total`             | counter   | `intent_dominant`                        |

### 4.2 Côté client (RUM)

```ts
import { onLCP, onINP, onCLS } from 'web-vitals';

// CLS contribué par chat
const observer = new PerformanceObserver((list) => {
  // ...
});
observer.observe({ type: 'layout-shift', buffered: true });
```

| Métrique RUM                       | Cible             |
| ---------------------------------- | ----------------- |
| LCP page (avec chat)               | ≤ 2.5 s p75       |
| INP (avec chat ouvert)             | ≤ 200 ms p75      |
| CLS contribué par chat             | ≤ 0.001 p99       |
| Bundle JS chat (gzip)              | ≤ 35 kB           |
| Time-to-interactive widget         | ≤ 200 ms          |

Remontées via `navigator.sendBeacon('/api/chat/event', ...)`.

## 5. Dashboards

### 5.1 Dashboard exécutif (admin `/admin/chat`)

Cf. doc 08. Lecture rapide pour la maison.

### 5.2 Dashboard SRE (Phase 2)

Externe (Grafana / Datadog). Panneaux :

- Latence p50/p95/p99 first-token, full-response — par provider.
- Taux d'erreur — par provider, par code.
- Taux de fallback — Sankey provider primaire → secondaire.
- Coût quotidien — stack par provider.
- Heatmap usage par heure de Casablanca.

## 6. Alerting

| Alerte                                                | Seuil                       | Canal      | Sévérité |
| ----------------------------------------------------- | --------------------------- | ---------- | -------- |
| Latence first-token p95 > 2.5 s pendant 10 min        | jour ouvré                  | Slack      | warn     |
| Provider primaire en erreur > 10 % sur 5 min          | 24/7                        | Slack + SMS | high   |
| Quota provider > 90 %                                 | -                           | Slack      | warn     |
| CLS contribué par chat > 0.005 sur 24 h               | -                           | Slack      | warn     |
| Modération entrée bloquée > 1 % du trafic / 1 h       | -                           | Slack      | info     |
| Aucune conversation enregistrée depuis 30 min         | en heures ouvrées           | Slack + SMS | high   |
| Erreur DB / pgvector                                  | -                           | Slack + SMS | high   |
| Détection fuite prompt système                        | dès la 1re                  | Slack + SMS | high   |
| Coût mensuel projeté > budget × 1.2                   | dès estimation              | Slack + email | high  |

Alertes implémentées Phase 1 via Vercel monitor + webhooks Slack.
Phase 2 : intégration outil dédié.

## 7. Budgets de performance

| Surface                           | Budget                        |
| --------------------------------- | ----------------------------- |
| Bundle JS chat (gzip)             | 35 kB                         |
| Bundle CSS chat                   | 8 kB                          |
| Time-to-interactive widget        | 200 ms après hydratation page |
| First-paint launcher              | 60 ms après mount             |
| First-token médian                | 1.2 s                         |
| First-token p95                   | 2.5 s                         |
| Full-response p95                 | 6 s                           |
| RAG retrieve p95                  | 350 ms                        |
| Recherche admin plein texte p95   | 600 ms                        |
| Cold start route handler          | 200 ms                        |

Mesures en CI :
- `size-limit` pour le bundle.
- `lighthouse-ci` pour les Web Vitals (fichier `.lighthouserc.json`
  existant à étendre).
- Suite k6 pour les latences API.

## 8. Coûts et accounting

- Coût exact par message (cf. `lib/chat/billing.ts`).
- Vue agrégée par provider, par jour.
- Projection mensuelle vs budget en haut du dashboard admin.

## 9. Échantillonnage qualité

Tâche cron quotidienne :

```
GET /api/admin/chat/quality/sample
→ tire 1 % des messages d'hier (max 50)
→ marque pour relecture
```

Page admin dédiée affiche les conversations échantillonnées,
permet d'attribuer un score qualité (1-5) et un tag (« bonne »,
« hallucination », « hors-charte », « excellent »).

Les scores nourrissent un KPI long-terme.

## 10. Tests d'observabilité

| Test                                            | Outil      |
| ----------------------------------------------- | ---------- |
| Le span `chat.provider.stream` est créé        | Vitest + OTel test exporter |
| Aucune clé n'apparaît en log (assert redact)    | Vitest     |
| `chat.cost.eur` incrémente après message        | Vitest     |
| Web Vitals envoyés via beacon                   | Playwright (intercept) |
| Alerte déclenche webhook                        | k6 + mock receiver |

## 11. Lecture suivante

- [11 — Visualisation système](11-visualisation-systeme.md) consomme
  les traces de cette section.
- [16 — Runbook](16-runbook.md) pour la réaction aux alertes.
- [12 — Tests](12-tests.md) pour les tests de perf.
