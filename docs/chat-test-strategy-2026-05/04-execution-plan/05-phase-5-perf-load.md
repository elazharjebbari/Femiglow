# Phase 5 — Performance + load + chaos

**Durée** : 3-4 jours

Valider que le système tient la charge réelle + comportement sous panne (chaos).

## Jour 39 — Load test (k6)

### Scénario 1 — `chat-message.js` (50 req/s soutenu)

```javascript
// apps/web/k6/chat-message.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const firstChunkLatency = new Trend('first_chunk_ms');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'first_chunk_ms': ['p(95) < 800', 'p(99) < 2000'],
    'http_req_duration': ['p(95) < 5000'],
    'http_req_failed': ['rate < 0.01'],
  },
};

export default function () {
  const sessionRes = http.post('http://localhost:3001/api/chat/session', JSON.stringify({
    pageUrl: '/kit', language: 'fr-MA',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(sessionRes, { 'session 200': (r) => r.status === 200 });
  const { sessionId } = JSON.parse(sessionRes.body);

  const start = Date.now();
  const msgRes = http.post('http://localhost:3001/api/chat/message', JSON.stringify({
    sessionId, content: 'Combien coûte le kit ?',
  }), {
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    responseType: 'text',
    timeout: '30s',
  });
  const elapsed = Date.now() - start;
  firstChunkLatency.add(elapsed);

  check(msgRes, {
    'msg 200': (r) => r.status === 200,
    'msg is sse': (r) => r.headers['Content-Type']?.includes('text/event-stream'),
  });

  sleep(2 + Math.random() * 3);
}
```

### Scénario 2 — Burst (10× pic sur 30s)

```javascript
export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      stages: [{ duration: '30s', target: 100 }, { duration: '1m', target: 100 }],
      preAllocatedVUs: 50, maxVUs: 200,
    },
  },
};
```

**Gate** : pas de 5xx > 1 %, P95 first chunk < 800 ms, P99 < 2 s.

## Jour 40 — Chaos engineering

### Scénario 1 — Tuer OpenAI mid-test
- Lancer `chat-message.js` à 30 req/s
- Après 30 s, route OpenAI → 500
- Vérifier : breaker OPEN dans <5 s, failover Anthropic, latency < 2× normale

### Scénario 2 — Saturé budget mid-test
- Mock `assertBudget` throw après N requêtes
- Vérifier : (post-ADR-004) bascule CANNED_ONLY, sinon `event: error` propre (pas crash)

### Scénario 3 — Latence DB 5× normale
- `pg_sleep(5)` dans une query critique
- Vérifier : requêtes timeout proprement, pas de cascade

## Jour 41 — Lighthouse CI (frontend)

Configurer `.lighthouserc.json` :
```json
{
  "ci": {
    "collect": { "url": ["http://localhost:3001/kit"], "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
      }
    }
  }
}
```

Run en CI sur main + release.

## Jour 42 — Bundle size monitoring

- Bundle widget client (gzip) < 80 KB
- Diff vs base via `next-bundle-analyzer`
- Alerte CI si delta > 5 % vs base

**Gate sortie Phase 5** :
- k6 thresholds verts
- Lighthouse 95+ a11y, 85+ perf
- Bundle widget < 80 KB gzip
- Chaos scénarios documentés (résultats)

## Livrables phase 5

- 3 scripts k6 + thresholds
- Rapport chaos engineering
- Lighthouse CI configuré
- Bundle size monitoring CI
