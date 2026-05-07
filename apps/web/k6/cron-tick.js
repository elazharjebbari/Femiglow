/**
 * Charge sur /api/cron/tick avec bearer.
 * Cible : 200 req/s pendant 60s, en preview environment uniquement.
 *
 * Lancer :
 *   k6 run -e BASE_URL=https://staging.femiglow.ma \
 *          -e CRON_SECRET=$CRON_SECRET \
 *          k6/cron-tick.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
  scenarios: {
    cron_tick: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = __ENV.CRON_SECRET || '';

export default function () {
  const res = http.post(
    `${BASE_URL}/api/cron/tick`,
    null,
    { headers: { authorization: `Bearer ${CRON_SECRET}` } },
  );
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has processed field': (r) => {
      try {
        return JSON.parse(r.body).processed !== undefined;
      } catch {
        return false;
      }
    },
  });
  sleep(0.001);
}
