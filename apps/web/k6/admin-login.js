/**
 * Charge sur /api/admin/login pour valider le rate-limit + le hash argon2id.
 * Cible : 50 req/s pendant 30s. La majorité des requêtes doivent
 * être rejetées en 401 (mauvais mot de passe) sans dépasser p95 < 800 ms.
 *
 * Lancer :
 *   k6 run -e BASE_URL=https://staging.femiglow.ma k6/admin-login.js
 */
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
  },
  scenarios: {
    bruteforce: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.post(
    `${BASE_URL}/api/admin/login`,
    JSON.stringify({
      email: 'noexist@femiglow.ma',
      password: 'invalidPassword12',
    }),
    { headers: { 'content-type': 'application/json' } },
  );
  check(res, {
    'rejette avec 401 ou 429': (r) => r.status === 401 || r.status === 429,
  });
}
