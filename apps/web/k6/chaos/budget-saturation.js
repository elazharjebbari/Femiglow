/**
 * Chaos — Budget saturation.
 *
 * Scénario :
 *  - Force quotaUsedEur >= quotaMonthlyEur sur tous les providers via
 *    API admin (POST /api/admin/chat/providers/:id avec quotaUsedEur).
 *  - Lance 20 req/s sur /api/chat/message pendant 60s.
 *  - Vérifie que :
 *    a) (futur ADR-004 level 3) fallback CANNED_ONLY → 200 avec event canned_served
 *    b) (état actuel C4) le système retourne 503 propre (pas crash)
 *  - Aucun crash 5xx > 1 %.
 *
 * Pré-requis :
 *  - ADMIN_TOKEN
 *  - Run staging only
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    'http_req_failed': ['rate<0.01'],   // pas de crash
    'http_req_duration': ['p(99)<10000'],
  },
  scenarios: {
    saturated: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 20,
      maxVUs: 80,
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

export function setup() {
  // Saturer tous les providers
  const r = http.get(`${BASE_URL}/api/admin/chat/providers`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
  });
  if (r.status !== 200) {
    console.error('Cannot list providers — admin token invalid?');
    return { providers: [] };
  }
  const providers = JSON.parse(r.body);
  for (const p of providers) {
    http.put(`${BASE_URL}/api/admin/chat/providers/${p.id}`, JSON.stringify({
      quotaUsedEur: p.quotaMonthlyEur,  // 100%
    }), {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    });
  }
  return { providers };
}

export default function () {
  const sessionResp = http.post(`${BASE_URL}/api/chat/session`, JSON.stringify({
    pageUrl: '/kit',
  }), { headers: { 'Content-Type': 'application/json' } });
  if (sessionResp.status !== 200) return;

  const { sessionId } = JSON.parse(sessionResp.body);

  const msgResp = http.post(`${BASE_URL}/api/chat/message`, JSON.stringify({
    sessionId, content: 'Combien coute le pack ?',
  }), {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
    timeout: '10s',
  });

  check(msgResp, {
    'response is 200 (canned) or 503 (clean refusal)': (r) =>
      r.status === 200 || r.status === 503,
    'no 500 crash': (r) => r.status !== 500,
  });

  sleep(1);
}

export function teardown(data) {
  // Reset quotas
  for (const p of data.providers || []) {
    http.put(`${BASE_URL}/api/admin/chat/providers/${p.id}`, JSON.stringify({
      quotaUsedEur: 0,
    }), {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    });
  }
}
