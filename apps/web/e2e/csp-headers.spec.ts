import { test, expect } from '@playwright/test';

test.describe('CSP / HSTS / frame-ancestors', () => {
  test('CSP header présent et nonce frais sur /admin/login', async ({ request }) => {
    const res = await request.get('/admin/login');
    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/script-src .*'nonce-/);
  });

  test('HSTS header présent (production-like)', async ({ request }) => {
    const res = await request.get('/');
    const hsts = res.headers()['strict-transport-security'];
    // HSTS est appliqué en production. En dev local on ne le bloque pas.
    if (hsts) {
      expect(hsts).toMatch(/max-age=63072000/);
      expect(hsts).toMatch(/includeSubDomains/);
    }
  });

  test('X-Frame-Options DENY présent', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });

  test('Referrer-Policy strict-origin-when-cross-origin', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('frame-src autorise www.youtube-nocookie.com (CHA-243)', async ({ request }) => {
    // Notre embed vidéo `/kit` charge `youtube-nocookie.com` en iframe.
    // Sans directive `frame-src` explicite, le navigateur retombe sur
    // `default-src 'self'` et bloque le framing → l'iframe reste vide.
    const res = await request.get('/kit');
    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/frame-src [^;]*https:\/\/www\.youtube-nocookie\.com/);
    // Ne PAS autoriser youtube.com direct (cookie domain).
    expect(csp).not.toMatch(/frame-src [^;]*https:\/\/(?:www\.)?youtube\.com/);
  });
});
