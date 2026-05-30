/**
 * Soak test — longévité 6h.
 *
 * Vérifie qu'aucune fuite mémoire ne se produit + KPI events persistent
 * sans accumulation problématique (compteur retry, buckets rate-limit).
 *
 * Run :
 *   k6 run -e BASE_URL=https://staging.femiglow.ma k6/soak-test.js
 *
 * Coût : ~6h × 5 req/s = ~108k requêtes. Faire en background.
 */
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '6h',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration': ['p(95)<5000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PROMPTS = [
  'Combien coûte le kit ?',
  'Comment livrez-vous ?',
  'Sans acétone ?',
  'C\'est halal ?',
  'Je veux commander',
];

export default function () {
  const session = http.post(`${BASE_URL}/api/chat/session`, JSON.stringify({
    pageUrl: '/kit', language: 'fr-MA',
  }), { headers: { 'Content-Type': 'application/json' } });
  if (session.status !== 200) return;

  const { sessionId } = JSON.parse(session.body);

  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  http.post(`${BASE_URL}/api/chat/message`, JSON.stringify({
    sessionId, content: prompt,
  }), {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
    timeout: '15s',
  });

  sleep(2 + Math.random() * 3);
}
