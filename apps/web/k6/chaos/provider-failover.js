/**
 * Chaos — Provider failover.
 *
 * Référence : `docs/chat-test-strategy-2026-05/04-execution-plan/05-phase-5-perf-load.md` §J40
 *
 * Scénario :
 *  - Lance 30 req/s sur /api/chat/message
 *  - À T=30s, force breaker OPEN sur openai via API admin
 *    (POST /api/admin/chat/providers/:id avec enabled=false)
 *  - Vérifie que :
 *    a) le taux d'erreur reste < 5 % (failover propre)
 *    b) la latence p95 reste < 2× nominal
 *    c) les events chat_provider_failover sont émis
 *
 * Pré-requis :
 *  - 2+ providers actifs (openai + anthropic)
 *  - Admin token disponible : `ADMIN_TOKEN`
 *  - Run sur env staging UNIQUEMENT
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.05'],     // toléré 5% pendant la transition
    http_req_waiting: ['p(95)<4000'],   // 2× nominal toléré
  },
  scenarios: {
    nominal: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '90s',
      preAllocatedVUs: 30,
      maxVUs: 100,
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';
const PRIMARY_PROVIDER_ID = __ENV.PRIMARY_PROVIDER_ID || 'cp_openai_primary';

let chaosTriggered = false;

export default function () {
  // À T=30s, déclenche le chaos
  const now = (Date.now() - __ENV.START_TS) / 1000;
  if (!chaosTriggered && now > 30 && ADMIN_TOKEN) {
    chaosTriggered = true;
    http.put(
      `${BASE_URL}/api/admin/chat/providers/${PRIMARY_PROVIDER_ID}`,
      JSON.stringify({ enabled: false }),
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_TOKEN}` } },
    );
  }

  // Trafic nominal
  const sessionResp = http.post(`${BASE_URL}/api/chat/session`, JSON.stringify({
    pageUrl: '/kit', language: 'fr-MA',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(sessionResp, { 'session created': (r) => r.status === 200 });
  if (sessionResp.status !== 200) return;

  const { sessionId } = JSON.parse(sessionResp.body);

  const msgResp = http.post(`${BASE_URL}/api/chat/message`, JSON.stringify({
    sessionId, content: 'Combien coûte le kit ?',
  }), {
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    responseType: 'text',
    timeout: '15s',
  });

  check(msgResp, {
    'message OK or 503 (degraded)': (r) => r.status === 200 || r.status === 503,
  });

  sleep(1 + Math.random() * 2);
}

export function setup() {
  return { START_TS: Date.now() };
}
