/**
 * CHA-143 — Charge sur /api/chat/message (SSE streaming).
 *
 * Objectif :
 *  - Vérifier que le rate-limit (60/min IP, 30/min session) tient.
 *  - p95 latence avant le 1er token < 1500 ms.
 *  - Aucune erreur 5xx.
 *
 * Lancer :
 *   k6 run -e BASE_URL=https://staging.femiglow.ma k6/chat-message.js
 *
 * NB : k6 ne déstreame pas le SSE proprement ; on mesure le TTFB
 * (`http_req_waiting`) qui correspond au délai serveur jusqu'au
 * premier flush.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_waiting: ['p(95)<1500', 'p(99)<3000'],
  },
  scenarios: {
    nominal: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 5,
      maxVUs: 30,
    },
    burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { target: 50, duration: '20s' },
        { target: 50, duration: '20s' },
        { target: 0, duration: '10s' },
      ],
      preAllocatedVUs: 20,
      maxVUs: 100,
      startTime: '70s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PROMPTS = [
  'Comment utiliser le sérum ?',
  'Quel est le délai de livraison ?',
  'bghit nchri kit dyalkom',
  'Y a-t-il des parabens ?',
  'السلام عليكم، كم سعر الكيت ؟',
];

export default function () {
  const body = JSON.stringify({
    message: PROMPTS[Math.floor(Math.random() * PROMPTS.length)],
    pageRoute: '/',
    consent: true,
  });
  const res = http.post(`${BASE_URL}/api/chat/message`, body, {
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    timeout: '10s',
  });
  check(res, {
    'pas d\'erreur 5xx': (r) => r.status < 500,
    'autorisé ou rate-limited': (r) => r.status === 200 || r.status === 429,
  });
  sleep(0.05);
}
