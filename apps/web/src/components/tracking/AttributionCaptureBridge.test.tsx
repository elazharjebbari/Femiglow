/**
 * @vitest-environment jsdom
 *
 * Tests du bridge attribution — capture URL → cookie + POST API.
 * MSW intercepte les requêtes /api/track/attribution.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { AttributionCaptureBridge } from './AttributionCaptureBridge';
import { ATTR_COOKIE_NAME, readAttributionCookie } from '@/lib/tracking/attribution/cookie';

interface CapturedPost {
  visitor_id: string;
  touch: { channel: string; click_id?: string; is_paid: boolean };
}
const captured: CapturedPost[] = [];

const server = setupServer(
  http.post('http://localhost/api/track/attribution', async ({ request }) => {
    const body = (await request.json()) as CapturedPost;
    captured.push(body);
    return HttpResponse.json({ ok: true, snapshot: {} });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

beforeEach(() => {
  captured.length = 0;
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/`;
  // sendBeacon → fallback fetch (msw intercepte fetch, pas sendBeacon)
  Object.defineProperty(navigator, 'sendBeacon', { value: () => false, configurable: true });
  // Consent granted pour activer la capture
  window.localStorage.setItem(
    'fg_consent',
    JSON.stringify({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
      security_storage: 'granted',
    }),
  );
});

afterEach(() => {
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/`;
  window.localStorage.clear();
  server.resetHandlers();
  vi.restoreAllMocks();
});

function setLocation(url: string, referrer = ''): void {
  // Simule window.location et document.referrer
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document, 'referrer', {
    value: referrer,
    configurable: true,
  });
}

describe('AttributionCaptureBridge', () => {
  it('gclid → cookie meta + POST API', async () => {
    setLocation('http://localhost/?gclid=test_gclid_abc');
    render(<AttributionCaptureBridge />);
    await waitFor(() => {
      const snap = readAttributionCookie();
      expect(snap.last_touch?.channel).toBe('google_ads');
      expect(snap.last_touch?.click_id).toBe('test_gclid_abc');
    });
    // POST best-effort → server reçoit l'event
    await waitFor(() => {
      expect(captured.length).toBeGreaterThanOrEqual(1);
      expect(captured[0]?.touch.channel).toBe('google_ads');
    });
  });

  it('fbclid → channel meta', async () => {
    setLocation('http://localhost/?fbclid=test_fb');
    render(<AttributionCaptureBridge />);
    await waitFor(() => {
      expect(readAttributionCookie().last_touch?.channel).toBe('meta');
    });
  });

  it('aucun click ID → direct', async () => {
    setLocation('http://localhost/');
    render(<AttributionCaptureBridge />);
    await waitFor(() => {
      const snap = readAttributionCookie();
      expect(snap.last_touch?.channel).toBe('direct');
      expect(snap.last_touch?.is_paid).toBe(false);
    });
  });

  it('échec réseau POST → cookie OK quand même (best-effort)', async () => {
    server.use(
      http.post('http://localhost/api/track/attribution', () =>
        HttpResponse.error(),
      ),
    );
    setLocation('http://localhost/?gclid=err');
    render(<AttributionCaptureBridge />);
    await waitFor(() => {
      expect(readAttributionCookie().last_touch?.channel).toBe('google_ads');
    });
    // Le POST a échoué mais le cookie est bien écrit
  });

  it('consent denied → pas de capture', async () => {
    window.localStorage.setItem(
      'fg_consent',
      JSON.stringify({
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functional_storage: 'denied',
        security_storage: 'granted',
      }),
    );
    setLocation('http://localhost/?gclid=denied');
    render(<AttributionCaptureBridge />);
    await new Promise((r) => setTimeout(r, 100));
    expect(readAttributionCookie().last_touch).toBeNull();
    expect(captured.length).toBe(0);
  });
});
